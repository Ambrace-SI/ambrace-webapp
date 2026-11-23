// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { VIVA_SESSION_PROPERTY, trackViva } from "@/lib/analytics/viva";
import { useVivaStore } from "@/lib/store/viva-store";
import { SessionState } from "@/types/viva";

/**
 * One viva followed from its start to its one ending. The viva's state is the
 * real store, driven the way the voice engine drives it; what would be sent
 * is recorded instead.
 */
const sent = vi.hoisted(() => ({
  events: [] as [string, Record<string, unknown>][],
  registered: [] as unknown[],
  unregistered: [] as unknown[],
  turns: 0,
}));
vi.mock("@/lib/analytics/events", () => ({
  track: (name: string, properties: Record<string, unknown>) =>
    void sent.events.push([name, properties]),
}));
vi.mock("@/lib/analytics/posthog", () => ({
  withPostHog: (
    action: (client: {
      register: (properties: unknown) => void;
      unregister: (name: unknown) => void;
    }) => void,
  ) =>
    action({
      register: (properties) => void sent.registered.push(properties),
      unregister: (name) => void sent.unregistered.push(name),
    }),
}));
vi.mock("@/lib/telemetry/voice-telemetry", () => ({
  voiceTelemetry: { getSnapshot: () => ({ currentTurn: sent.turns }) },
}));

const CHOICE = {
  class_level: 9,
  subject_id: "science",
  subject: "Science",
  chapter_id: "cell",
  chapter: "Cell",
  topic_count: 0,
  voice: "Puck",
};
const SCORE = { score: 7, total: 10, feedback: "Clear on cells." };

const names = () => sent.events.map(([name]) => name);
const engine = (changes: Partial<ReturnType<typeof useVivaStore.getState>>) =>
  useVivaStore.setState(changes);

let now = 0;

beforeEach(() => {
  sent.events.length = 0;
  sent.registered.length = 0;
  sent.unregistered.length = 0;
  sent.turns = 0;
  now = 1_000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  useVivaStore.getState().resetSession();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("beginning", () => {
  test("attaches the viva's ID to every later event, then says it started", () => {
    trackViva("session-1", CHOICE);

    expect(sent.registered).toEqual([{ [VIVA_SESSION_PROPERTY]: "session-1" }]);
    expect(sent.events).toEqual([
      ["viva_started", { ...CHOICE, viva_session_id: "session-1" }],
    ]);
  });
});

describe("how a viva ends", () => {
  test("finished: the examiner concluded and the score is in", () => {
    trackViva("session-1", CHOICE);
    now += 125_000;
    sent.turns = 6;

    engine({ sessionState: SessionState.COMPLETED, conclusionData: SCORE });

    expect(sent.events.at(-1)).toEqual([
      "viva_finished",
      {
        viva_session_id: "session-1",
        duration_seconds: 125,
        turns: 6,
        score: 7,
        total: 10,
      },
    ]);
  });

  test("a score that arrives a moment after completion is waited for, not lost", () => {
    trackViva("session-1", CHOICE);

    engine({ sessionState: SessionState.COMPLETED });
    expect(names()).toEqual(["viva_started"]);

    engine({ conclusionData: SCORE });
    expect(sent.events.at(-1)?.[1]).toMatchObject({ score: 7, total: 10 });
  });

  test("it is said once, however many times the state changes afterwards", () => {
    trackViva("session-1", CHOICE);

    engine({ sessionState: SessionState.COMPLETED, conclusionData: SCORE });
    engine({ conclusionData: { ...SCORE, score: 8 } });
    engine({ sessionState: SessionState.ERROR });

    expect(names()).toEqual(["viva_started", "viva_finished"]);
  });

  test("stopped: the viva broke and could not continue", () => {
    trackViva("session-1", CHOICE);
    now += 40_000;

    engine({ sessionState: SessionState.ERROR });

    expect(sent.events.at(-1)).toEqual([
      "viva_stopped",
      { viva_session_id: "session-1", duration_seconds: 40, turns: 0 },
    ]);
  });

  test("abandoned: the student left while it was still running, at the stage it had reached", () => {
    const viva = trackViva("session-1", CHOICE);
    engine({ sessionState: SessionState.ACTIVE });
    now += 30_000;

    viva.leave();

    expect(sent.events.at(-1)).toEqual([
      "viva_abandoned",
      {
        viva_session_id: "session-1",
        duration_seconds: 30,
        turns: 0,
        stage: SessionState.ACTIVE,
      },
    ]);
  });

  test("completed, and the score never came: still a finish, with no score claimed", () => {
    const viva = trackViva("session-1", CHOICE);
    engine({ sessionState: SessionState.COMPLETED });

    viva.leave();

    expect(sent.events.at(-1)).toEqual([
      "viva_finished",
      {
        viva_session_id: "session-1",
        duration_seconds: 0,
        turns: 0,
        score: null,
        total: null,
      },
    ]);
  });
});

describe("leaving", () => {
  test("after an ending says nothing more, and detaches the viva's ID", () => {
    const viva = trackViva("session-1", CHOICE);
    engine({ sessionState: SessionState.COMPLETED, conclusionData: SCORE });

    viva.leave();

    expect(names()).toEqual(["viva_started", "viva_finished"]);
    expect(sent.unregistered).toEqual([VIVA_SESSION_PROPERTY]);
  });

  test("twice is the same as once", () => {
    const viva = trackViva("session-1", CHOICE);
    engine({ sessionState: SessionState.ACTIVE });

    viva.leave();
    viva.leave();

    expect(names()).toEqual(["viva_started", "viva_abandoned"]);
    expect(sent.unregistered).toHaveLength(1);
  });

  test("stops the watching: clearing the engine afterwards is not another ending", () => {
    const viva = trackViva("session-1", CHOICE);
    engine({ sessionState: SessionState.ACTIVE });
    viva.leave();

    useVivaStore.getState().resetSession();
    engine({ sessionState: SessionState.ERROR });

    expect(names()).toEqual(["viva_started", "viva_abandoned"]);
  });

  test("one viva's ending is never read as the next one's", () => {
    const first = trackViva("session-1", CHOICE);
    engine({ sessionState: SessionState.COMPLETED, conclusionData: SCORE });
    first.leave();
    useVivaStore.getState().resetSession();

    trackViva("session-2", CHOICE);
    engine({ sessionState: SessionState.ACTIVE });

    expect(names()).toEqual(["viva_started", "viva_finished", "viva_started"]);
  });
});

describe("a microphone that goes unheard", () => {
  test("is counted once per viva, however often it recurs", () => {
    const viva = trackViva("session-1", CHOICE);

    viva.microphoneUnheard();
    viva.microphoneUnheard();

    expect(
      names().filter((name) => name === "microphone_unheard"),
    ).toHaveLength(1);
    expect(sent.events.at(-1)).toEqual([
      "microphone_unheard",
      { viva_session_id: "session-1" },
    ]);
  });
});
