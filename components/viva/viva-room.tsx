"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { LiveSession, type VivaScope } from "@/components/viva/live-session";
import { VivaSetup, type VivaChoice } from "@/components/viva/viva-setup";
import type { VivaChoiceProperties } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/events";
import { trackViva, type VivaTracking } from "@/lib/analytics/viva";
import { httpStatus } from "@/lib/api/errors";
import { abandonViva, startVivaSession } from "@/lib/api/axios";
import { useWholeScreen } from "@/lib/app/whole-screen";
import { startAssignment } from "@/lib/groups/api";
import { ASSIGNED_KEY } from "@/lib/groups/use-groups";
import { mapVivaRequest } from "@/lib/curriculum/selection";
import { HISTORY_KEY } from "@/lib/hooks/use-history";
import { useMe } from "@/lib/hooks/use-me";
import { useVivaSession } from "@/lib/hooks/useVivaSession";
import { useVivaStore } from "@/lib/store/viva-store";
import { describeStartError } from "@/lib/viva/start-error";
import type { CurriculumSelection } from "@/lib/curriculum/types";
import type { StudentAssignment } from "@/types/assignments";
import {
  DEFAULT_VOICE,
  SessionState,
  type VivaStartResponse,
} from "@/types/viva";

/** A viva the server still believes is running. */
const IN_FLIGHT: ReadonlySet<SessionState> = new Set([
  SessionState.STARTING,
  SessionState.ACTIVE,
  SessionState.CONCLUDING,
]);

/**
 * The side panel lists every viva and outlives this page, so it is told
 * whenever one of them stops being what the list last said it was.
 */
function refreshHistory(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: HISTORY_KEY });
  // A set viva that was just finished is no longer waiting.
  void queryClient.invalidateQueries({ queryKey: ASSIGNED_KEY });
}

/**
 * Tells the server nobody is in the room. If that fails there is nothing more
 * to do from here; the list is refreshed either way.
 */
function releaseViva(queryClient: QueryClient, sessionId: string) {
  void abandonViva(sessionId)
    .catch(() => {})
    .finally(() => refreshHistory(queryClient));
}

/**
 * Home: one address, two moments. The welcome, where the student chooses what
 * to talk about, then the viva itself.
 *
 * They share a page because the live session owns the microphone, the speaker
 * and the connection, and all three must be released the moment the student
 * leaves. Keeping them in one place means leaving the page always cleans up.
 *
 * Choosing happens beside the side panel, like any other page. Talking takes
 * the whole screen, so nothing on it can end the viva by accident.
 *
 * Because this page is home, "back to home" never leaves it: the room steps
 * back to the welcome itself, including when the voice engine ends a viva
 * early and heads for home on its own.
 */
export function VivaRoom() {
  const { data: me } = useMe();
  const session = useVivaSession();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<VivaScope | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Counts departures, so work begun on one visit cannot finish on the next.
  const visit = useRef(0);
  // Whether the engine has begun the viva on screen. Until it has, an idle
  // engine is just one that has not started yet.
  const engineBegan = useRef(false);
  // The viva in the room, as analytics follows it. None while choosing.
  const tracking = useRef<VivaTracking | null>(null);

  /** Told before the viva's state is cleared, so its ending can still be read. */
  function leaveViva() {
    tracking.current?.leave();
    tracking.current = null;
  }

  useWholeScreen(scope !== null);

  /**
   * Back to the welcome on this same page. `keepReason` carries the engine's
   * last error there; a reason the student already read on screen is not
   * shown twice.
   */
  function backToWelcome({ keepReason }: { keepReason: boolean }) {
    engineBegan.current = false;
    const { error } = useVivaStore.getState();
    leaveViva();
    session.resetSession();
    if (keepReason && error) useVivaStore.getState().setError(error);
    setScope(null);
    // The viva that stopped is in the list, and the list is back.
    refreshHistory(queryClient);
  }

  const engineHeadedHome = useEffectEvent(() =>
    backToWelcome({ keepReason: true }),
  );

  // When the engine ends a viva early it goes idle and sends the student to
  // "/". That is this page, so nothing unmounts: notice it here instead.
  useEffect(() => {
    if (!scope) return;
    engineBegan.current = false;
    return useVivaStore.subscribe(({ sessionState }) => {
      if (sessionState !== SessionState.IDLE) {
        engineBegan.current = true;
      } else if (engineBegan.current) {
        engineHeadedHome();
      }
    });
  }, [scope]);

  // Leaving ends the visit, however the student leaves. Next keeps this page
  // alive (hidden) after navigation and hands it back as it was, so without
  // this a return would land on the last viva's screen instead of a new start.
  useLayoutEffect(
    () => () => {
      visit.current++;
      const { sessionId, sessionState, conclusionData, error } =
        useVivaStore.getState();
      // A viva still running has nobody in the room: release it on the server.
      if (sessionId && !conclusionData && IN_FLIGHT.has(sessionState))
        releaseViva(queryClient, sessionId);
      leaveViva();
      useVivaStore.getState().resetSession();
      // When the engine itself sent the student home, the reason goes with them.
      if (error && sessionState === SessionState.IDLE)
        useVivaStore.getState().setError(error);
      setScope(null);
      setStarting(false);
      setStartError(null);
    },
    // The same client for as long as the app is open: this runs on leaving only.
    [queryClient],
  );

  const profile = me?.profile;
  if (!profile) return <RoomOutline />;

  /** Practice: the student chose the chapter themselves. */
  function start({ selection, voiceName }: VivaChoice) {
    // Name and class come from the profile, never from the form.
    return begin(selection, voiceName, () =>
      startVivaSession(mapVivaRequest(profile!.name, voiceName, selection)),
    );
  }

  /** A viva a teacher or parent set: the server builds it from the assignment. */
  function startAssigned(assignment: StudentAssignment) {
    return begin(assignment.curriculum_selection, DEFAULT_VOICE, () =>
      startAssignment(assignment.group_id, assignment.assignment_id),
    );
  }

  async function begin(
    selection: CurriculumSelection,
    voiceName: string,
    create: () => Promise<VivaStartResponse>,
  ) {
    const thisVisit = visit.current;
    const stillHere = () => visit.current === thisVisit;
    const chapter = selection.chapters[0];
    const choice: VivaChoiceProperties = {
      class_level: selection.class_level,
      subject_id: selection.subject_id,
      subject: selection.subject_name,
      chapter_id: chapter.id,
      chapter: chapter.name,
      topic_count: chapter.topics.length,
      voice: voiceName,
    };
    setStartError(null);
    setStarting(true);
    track("viva_requested", choice);

    // First the viva is created. If that fails, there never was one.
    let response: VivaStartResponse;
    try {
      // Nothing from an earlier viva may leak into this one.
      session.resetSession();
      response = await create();
    } catch (error) {
      track("viva_start_failed", {
        ...choice,
        status: httpStatus(error) ?? null,
      });
      if (stillHere()) {
        setStartError(describeStartError(error));
        setStarting(false);
      }
      return;
    }
    if (!stillHere()) {
      // The student left while the session was being created.
      releaseViva(queryClient, response.viva_session_id);
      return;
    }

    // Then the room opens. From here a failure is the viva's own.
    try {
      tracking.current = trackViva(response.viva_session_id, choice);
      session.setSessionData(response);
      setScope({ subject: selection.subject_name, chapter: chapter.name });
      // Asks for the microphone, then connects. Its own failures are shown
      // on the live screen, where the student now is.
      await session.initializeSession();
    } catch (error) {
      if (stillHere()) setStartError(describeStartError(error));
    } finally {
      if (stillHere()) setStarting(false);
    }
  }

  if (scope) {
    return (
      <LiveSession
        session={session}
        scope={scope}
        onChooseAgain={() => backToWelcome({ keepReason: false })}
        onMicrophoneUnheard={() => tracking.current?.microphoneUnheard()}
      />
    );
  }

  return (
    <VivaSetup
      profile={profile}
      starting={starting}
      error={startError}
      onStart={(choice) => void start(choice)}
      onStartAssigned={(assignment) => void startAssigned(assignment)}
    />
  );
}

/**
 * The shape of the welcome while the profile loads: the same blocks in the
 * same places, so nothing jumps when the real content arrives.
 */
function RoomOutline() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy="true">
      <p className="sr-only" role="status">
        Getting ready
      </p>
      <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-10">
        <div className="aspect-square w-48 animate-pulse rounded-full bg-muted sm:w-60" />
        <div className="flex flex-col items-center gap-3">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-12 w-72 max-w-full animate-pulse rounded bg-muted sm:h-15" />
        </div>
      </main>
      <div className="mx-auto w-full max-w-4xl px-3 pb-4 sm:px-6 sm:pb-6">
        <div className="h-72 animate-pulse glass-card rounded-[24px] md:h-[4.375rem]" />
      </div>
    </div>
  );
}
