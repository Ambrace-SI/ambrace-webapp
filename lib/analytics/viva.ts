/**
 * The life of one viva, as analytics sees it: it begins, then it ends exactly
 * one way (finished, stopped, or abandoned).
 *
 * How it ends is read from the viva's own state, the same store the voice
 * engine writes to, so it is noticed whichever screen happens to be showing.
 * Nothing here reaches into the engine: the engine's `voice_*` measurements
 * pick up the viva's ID because it is attached to every event while a viva is
 * on.
 *
 * A viva that begins and never ends was lost with the tab: the browser was
 * closed, or the device went to sleep. That gap is itself the signal.
 */

import { useVivaStore } from "@/lib/store/viva-store";
import { voiceTelemetry } from "@/lib/telemetry/voice-telemetry";
import { SessionState } from "@/types/viva";

import { track, type VivaChoiceProperties } from "./events";
import { withPostHog } from "./posthog";

/** The property that ties any event to one viva, including the voice engine's. */
export const VIVA_SESSION_PROPERTY = "viva_session_id";

/** One viva being followed. The room holds it for as long as the viva is on. */
export type VivaTracking = {
  /** The microphone has delivered nothing on the student's turn. Counted once. */
  microphoneUnheard: () => void;
  /**
   * The student is no longer in the room. Call it before the viva's state is
   * cleared: a viva that had not ended by then was walked out of. Calling it
   * again does nothing.
   */
  leave: () => void;
};

/**
 * Begins following a viva: every event from here carries its ID, and its
 * ending is reported once, however it comes.
 */
export function trackViva(
  vivaSessionId: string,
  choice: VivaChoiceProperties,
): VivaTracking {
  const beganAt = performance.now();
  let ended = false;
  let left = false;
  let unheardReported = false;

  const measured = () => ({
    viva_session_id: vivaSessionId,
    duration_seconds: Math.round((performance.now() - beganAt) / 1000),
    turns: voiceTelemetry.getSnapshot().currentTurn,
  });

  /** The ending is said once; whatever comes after it is not another one. */
  const end = (report: () => void) => {
    if (ended) return;
    ended = true;
    report();
  };

  withPostHog((client) =>
    client.register({ [VIVA_SESSION_PROPERTY]: vivaSessionId }),
  );
  track("viva_started", { ...choice, viva_session_id: vivaSessionId });

  const stopWatching = useVivaStore.subscribe(
    ({ sessionState, conclusionData }) => {
      if (sessionState === SessionState.ERROR) {
        end(() => track("viva_stopped", measured()));
      } else if (sessionState === SessionState.COMPLETED && conclusionData) {
        // The score can arrive a moment after the viva completes. Waiting for
        // it here means a finish is never recorded without one it had.
        end(() =>
          track("viva_finished", {
            ...measured(),
            score: conclusionData.score,
            total: conclusionData.total,
          }),
        );
      }
    },
  );

  return {
    microphoneUnheard() {
      if (unheardReported) return;
      unheardReported = true;
      track("microphone_unheard", { viva_session_id: vivaSessionId });
    },

    leave() {
      if (left) return;
      left = true;
      stopWatching();
      const { sessionState } = useVivaStore.getState();
      end(() =>
        sessionState === SessionState.COMPLETED
          ? // Completed, and the score never came.
            track("viva_finished", { ...measured(), score: null, total: null })
          : track("viva_abandoned", { ...measured(), stage: sessionState }),
      );
      withPostHog((client) => client.unregister(VIVA_SESSION_PROPERTY));
    },
  };
}
