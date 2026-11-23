// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { VivaRoom } from "@/components/viva/viva-room";
import { APIError } from "@/lib/api/axios";
import { WholeScreenContext } from "@/lib/app/whole-screen";
import type { CurriculumSelection } from "@/lib/curriculum/types";
import { useVivaStore } from "@/lib/store/viva-store";
import type { Me } from "@/types/profile";
import { SessionState } from "@/types/viva";

/**
 * The room joins three things that are each tested on their own: the setup
 * screen, the live screen and the voice engine. Here they are stand-ins, and
 * what is checked is the order in which the room uses them.
 */
const SELECTION: CurriculumSelection = {
  catalog_id: "ncert-cbse",
  catalog_version: "v1",
  class_level: 9,
  subject_id: "science",
  subject_name: "Science",
  chapters: [{ id: "cell", name: "Cell", topics: [] }],
};

// What the room reports to analytics, recorded here instead of sent. The
// following of one viva is tested on its own (analytics-viva.test.ts); here
// it is a stand-in, and what is checked is when the room starts and ends it.
const analytics = vi.hoisted(() => ({
  track: vi.fn(),
  trackViva: vi.fn(),
  leave: vi.fn(),
  microphoneUnheard: vi.fn(),
}));
vi.mock("@/lib/analytics/events", () => ({ track: analytics.track }));
vi.mock("@/lib/analytics/viva", () => ({
  trackViva: (...given: unknown[]) => {
    analytics.trackViva(...given);
    return {
      leave: analytics.leave,
      microphoneUnheard: analytics.microphoneUnheard,
    };
  },
}));

vi.mock("@/components/viva/viva-setup", () => ({
  VivaSetup: (props: {
    profile: { name: string };
    starting: boolean;
    error: string | null;
    onStart: (choice: unknown) => void;
  }) => (
    <div>
      <p>setup for {props.profile.name}</p>
      {props.starting ? <p>starting</p> : null}
      {props.error ? <p role="alert">{props.error}</p> : null}
      <button
        onClick={() =>
          props.onStart({ selection: SELECTION, voiceName: "Puck" })
        }
      >
        start
      </button>
    </div>
  ),
}));
vi.mock("@/components/viva/live-session", () => ({
  LiveSession: (props: {
    scope: { subject: string; chapter: string };
    onChooseAgain: () => void;
    onMicrophoneUnheard: () => void;
  }) => (
    <div>
      <p>
        live: {props.scope.subject} / {props.scope.chapter}
      </p>
      <button onClick={props.onChooseAgain}>choose again</button>
      <button onClick={props.onMicrophoneUnheard}>microphone unheard</button>
    </div>
  ),
}));

const calls: string[] = [];
const engine = {
  resetSession: vi.fn(() => void calls.push("reset")),
  setSessionData: vi.fn(() => void calls.push("session data")),
  initializeSession: vi.fn(async () => void calls.push("initialise")),
};
vi.mock("@/lib/hooks/useVivaSession", () => ({
  useVivaSession: () => engine,
}));

const startVivaSession = vi.fn();
const abandonViva = vi.fn();
vi.mock("@/lib/api/axios", async (original) => ({
  ...(await original<typeof import("@/lib/api/axios")>()),
  abandonViva: (id: string) => abandonViva(id),
  startVivaSession: (request: unknown) => {
    calls.push("start request");
    return startVivaSession(request);
  },
}));

// With no profile cached the room asks for it; here that request never answers.
vi.mock("@/lib/api/me", () => ({
  ME_PATH: "/api/v1/me",
  getMe: () => new Promise(() => undefined),
  saveProfile: vi.fn(),
}));

const ME: Me = {
  user_id: "user-1",
  onboarding_complete: true,
  profile: {
    name: "  Asha Rao ",
    class_level: 9,
    board: null,
    school_name: null,
    school_address: null,
    created_at: "2026-11-21T10:00:00Z",
    updated_at: "2026-11-21T10:00:00Z",
  },
};

/** What the room asked of the frame around it, in order. */
const wholeScreen = vi.fn();
/** Each time the side panel's list was told to fetch itself again. */
let listRefreshed: ReturnType<typeof vi.spyOn>;

function renderRoom(me: Me | null = ME) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  if (me) client.setQueryData(["me"], me);
  listRefreshed = vi.spyOn(client, "invalidateQueries");

  return render(
    <QueryClientProvider client={client}>
      <WholeScreenContext value={wholeScreen}>
        <VivaRoom />
      </WholeScreenContext>
    </QueryClientProvider>,
  );
}

const pressStart = () =>
  userEvent.setup().click(screen.getByRole("button", { name: "start" }));

beforeEach(() => {
  calls.length = 0;
  startVivaSession.mockReset();
  startVivaSession.mockResolvedValue({ viva_session_id: "session-1" });
  abandonViva.mockReset();
  abandonViva.mockResolvedValue({ status: "abandoned" });
  wholeScreen.mockReset();
  useVivaStore.getState().resetSession();
  for (const mock of Object.values(engine)) mock.mockClear();
});

describe("arriving", () => {
  test("shows an outline until the profile is known", () => {
    renderRoom(null);

    expect(screen.getByRole("status").textContent).toBe("Getting ready");
    expect(screen.queryByText(/setup for/)).toBeNull();
  });

  test("then opens on choosing what to talk about", () => {
    renderRoom();

    expect(screen.getByText(/setup for\s+Asha Rao/)).toBeTruthy();
  });
});

describe("starting a viva", () => {
  test("clears the last viva, creates the session, then connects, in that order", async () => {
    renderRoom();

    await pressStart();

    await screen.findByText("live: Science / Cell");
    expect(calls).toEqual([
      "reset",
      "start request",
      "session data",
      "initialise",
    ]);
    expect(engine.setSessionData).toHaveBeenCalledWith({
      viva_session_id: "session-1",
    });
  });

  test("the name and class sent are the profile's, with the chosen chapter and voice", async () => {
    renderRoom();

    await pressStart();

    await waitFor(() => expect(startVivaSession).toHaveBeenCalledTimes(1));
    expect(startVivaSession.mock.calls[0][0]).toMatchObject({
      student_name: "Asha Rao",
      class_level: "9",
      topic: "Cell",
      voice_name: "Puck",
      session_type: "viva",
      curriculum_selection: SELECTION,
    });
  });

  test("shows that it is starting while the session is created", async () => {
    startVivaSession.mockReturnValue(new Promise(() => undefined));
    renderRoom();

    await pressStart();

    expect(await screen.findByText("starting")).toBeTruthy();
    expect(engine.initializeSession).not.toHaveBeenCalled();
  });

  test("a refused start stays on setup with a reason, and never touches the microphone", async () => {
    startVivaSession.mockRejectedValue(new APIError("Too many requests", 429));
    renderRoom();

    await pressStart();

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /Wait a minute/,
    );
    expect(screen.queryByText(/^live:/)).toBeNull();
    expect(screen.queryByText("starting")).toBeNull();
    expect(engine.initializeSession).not.toHaveBeenCalled();
  });

  test("trying again clears the earlier reason", async () => {
    startVivaSession.mockRejectedValueOnce(new APIError("down", 500));
    renderRoom();
    await pressStart();
    await screen.findByRole("alert");

    await pressStart();

    await screen.findByText("live: Science / Cell");
  });
});

describe("the side panel around the room", () => {
  test("stays while the student is choosing", () => {
    renderRoom();

    expect(wholeScreen).not.toHaveBeenCalled();
  });

  test("is still there while the session is being created", async () => {
    startVivaSession.mockReturnValue(new Promise(() => undefined));
    renderRoom();

    await pressStart();
    await screen.findByText("starting");

    expect(wholeScreen).not.toHaveBeenCalled();
  });

  test("is put away for the viva itself", async () => {
    renderRoom();

    await pressStart();
    await screen.findByText("live: Science / Cell");

    expect(wholeScreen.mock.calls).toEqual([[true]]);
  });

  test("comes back when the student returns to choosing, with its list refreshed", async () => {
    renderRoom();
    await pressStart();
    await screen.findByText("live: Science / Cell");

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "choose again" }));

    expect(wholeScreen.mock.calls).toEqual([[true], [false]]);
    expect(listRefreshed).toHaveBeenCalledWith({ queryKey: ["history"] });
  });

  test("comes back when the student leaves in the middle of a viva", async () => {
    const view = renderRoom();
    await pressStart();
    await screen.findByText("live: Science / Cell");

    view.unmount();

    expect(wholeScreen.mock.calls).toEqual([[true], [false]]);
  });
});

describe("after a viva that broke", () => {
  test("starting again clears the session and returns to choosing", async () => {
    renderRoom();
    await pressStart();
    await screen.findByText("live: Science / Cell");
    engine.resetSession.mockClear();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "choose again" }));

    expect(engine.resetSession).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/setup for/)).toBeTruthy();
  });
});

describe("the room is the home page", () => {
  /** The engine's reset, here really clearing the store, as the engine's does. */
  const resetThatClearsTheStore = () =>
    engine.resetSession.mockImplementation(() => {
      calls.push("reset");
      useVivaStore.getState().resetSession();
    });
  // Undone after every test, even one that fails part way.
  afterEach(() => {
    engine.resetSession.mockImplementation(() => void calls.push("reset"));
  });

  /** The engine's state, as the voice engine would set it in the store. */
  const engineSets = (
    changes: Partial<ReturnType<typeof useVivaStore.getState>>,
  ) => act(() => useVivaStore.setState(changes));

  async function inLiveViva() {
    renderRoom();
    await pressStart();
    await screen.findByText("live: Science / Cell");
    engineSets({ sessionId: "session-1", sessionState: SessionState.ACTIVE });
  }

  test("when the engine ends a viva early and heads home, the student is back at the welcome", async () => {
    // The engine sends the student to "/", which is this page, so nothing
    // is unmounted: the room has to notice and step back itself.
    await inLiveViva();
    resetThatClearsTheStore();

    engineSets({
      sessionState: SessionState.IDLE,
      error: "Microphone access is blocked.",
    });

    expect(await screen.findByText(/setup for/)).toBeTruthy();
    expect(screen.queryByText(/^live:/)).toBeNull();
    expect(engine.resetSession).toHaveBeenCalled();
    // The reason stays for the welcome screen to show.
    expect(useVivaStore.getState().error).toBe("Microphone access is blocked.");
    expect(wholeScreen).toHaveBeenLastCalledWith(false);
    expect(listRefreshed).toHaveBeenCalledWith({ queryKey: ["history"] });
  });

  test("the quiet moment before the engine starts is not mistaken for heading home", async () => {
    renderRoom();
    await pressStart();
    await screen.findByText("live: Science / Cell");

    // The store is still idle until the engine begins connecting.
    engineSets({ sessionId: "session-1", sessionState: SessionState.IDLE });

    expect(screen.getByText("live: Science / Cell")).toBeTruthy();
  });

  test("going back by choice does not carry the reason the student already read", async () => {
    await inLiveViva();
    resetThatClearsTheStore();
    engineSets({
      sessionState: SessionState.ERROR,
      error: "The line dropped.",
    });

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "choose again" }));

    expect(screen.getByText(/setup for/)).toBeTruthy();
    expect(useVivaStore.getState().error).toBeNull();
  });
});

describe("leaving the page", () => {
  /** The live session as the voice engine would have left it in the store. */
  const engineState = (
    changes: Partial<ReturnType<typeof useVivaStore.getState>>,
  ) => act(() => useVivaStore.setState({ sessionId: "session-1", ...changes }));

  async function inLiveViva() {
    const view = renderRoom();
    await pressStart();
    await screen.findByText("live: Science / Cell");
    return view;
  }

  test("coming back starts fresh, not on the last viva's screen", async () => {
    // Next hides this page on navigation rather than destroying it, then
    // hands it back exactly as it was.
    const client = new QueryClient();
    client.setQueryData(["me"], ME);
    const page = (mode: "visible" | "hidden") => (
      <QueryClientProvider client={client}>
        <Activity mode={mode}>
          <VivaRoom />
        </Activity>
      </QueryClientProvider>
    );
    const view = render(page("visible"));
    await pressStart();
    await screen.findByText("live: Science / Cell");
    engineState({ sessionState: SessionState.COMPLETED });

    view.rerender(page("hidden"));
    view.rerender(page("visible"));

    expect(screen.getByText(/setup for/)).toBeTruthy();
    expect(screen.queryByText(/^live:/)).toBeNull();
    expect(useVivaStore.getState().sessionId).toBeNull();
    expect(useVivaStore.getState().sessionState).toBe(SessionState.IDLE);
  });

  test.each([
    SessionState.STARTING,
    SessionState.ACTIVE,
    SessionState.CONCLUDING,
  ])("a viva still running (%s) is released on the server", async (running) => {
    const view = await inLiveViva();
    engineState({ sessionState: running });

    view.unmount();

    expect(abandonViva).toHaveBeenCalledWith("session-1");
    expect(useVivaStore.getState().sessionId).toBeNull();
    // Once the server knows, the side panel's list is fetched again.
    await waitFor(() =>
      expect(listRefreshed).toHaveBeenCalledWith({ queryKey: ["history"] }),
    );
  });

  test("a viva whose report is saved is left as it is", async () => {
    const view = await inLiveViva();
    engineState({
      sessionState: SessionState.CONCLUDING,
      conclusionData: { score: 7, total: 10, feedback: "Clear." },
    });

    view.unmount();

    expect(abandonViva).not.toHaveBeenCalled();
  });

  test("a failed release does not stop the student leaving", async () => {
    abandonViva.mockRejectedValue(new Error("offline"));
    const view = await inLiveViva();
    engineState({ sessionState: SessionState.ACTIVE });

    expect(() => view.unmount()).not.toThrow();
    expect(useVivaStore.getState().sessionState).toBe(SessionState.IDLE);
    await waitFor(() => expect(listRefreshed).toHaveBeenCalled());
  });

  test("when the engine sends the student home, the reason goes with them", async () => {
    const view = await inLiveViva();
    engineState({
      sessionState: SessionState.IDLE,
      error: "Microphone access is blocked.",
    });

    view.unmount();

    expect(useVivaStore.getState().error).toBe("Microphone access is blocked.");
    expect(abandonViva).not.toHaveBeenCalled();
  });

  test("a fault the student has already read on screen is not repeated at home", async () => {
    const view = await inLiveViva();
    engineState({
      sessionState: SessionState.ERROR,
      error: "The line dropped.",
    });

    view.unmount();

    expect(useVivaStore.getState().error).toBeNull();
  });

  test("leaving while the session is being created releases it and never connects", async () => {
    let created: (response: { viva_session_id: string }) => void = () =>
      undefined;
    startVivaSession.mockReturnValue(
      new Promise((resolve) => {
        created = resolve;
      }),
    );
    const view = renderRoom();
    await pressStart();
    await screen.findByText("starting");

    view.unmount();
    await act(async () => created({ viva_session_id: "session-9" }));

    expect(abandonViva).toHaveBeenCalledWith("session-9");
    expect(engine.setSessionData).not.toHaveBeenCalled();
    expect(engine.initializeSession).not.toHaveBeenCalled();
  });

  test("a start that fails after the student has left says nothing", async () => {
    let fail: (error: Error) => void = () => undefined;
    startVivaSession.mockReturnValue(
      new Promise((_, reject) => {
        fail = reject;
      }),
    );
    const view = renderRoom();
    await pressStart();
    await screen.findByText("starting");

    view.unmount();
    await act(async () => fail(new APIError("down", 500)));

    expect(abandonViva).not.toHaveBeenCalled();
  });
});

describe("what analytics is told", () => {
  const CHOICE = {
    class_level: 9,
    subject_id: "science",
    subject: "Science",
    chapter_id: "cell",
    chapter: "Cell",
    topic_count: 0,
    voice: "Puck",
  };

  beforeEach(() => {
    for (const mock of Object.values(analytics)) mock.mockClear();
  });

  test("what was asked for, then the viva is followed, with nothing that names the student", async () => {
    renderRoom();

    await pressStart();
    await screen.findByText("live: Science / Cell");

    expect(analytics.track.mock.calls).toEqual([["viva_requested", CHOICE]]);
    expect(analytics.trackViva.mock.calls).toEqual([["session-1", CHOICE]]);
    expect(
      JSON.stringify([
        analytics.track.mock.calls,
        analytics.trackViva.mock.calls,
      ]),
    ).not.toMatch(/Asha/);
  });

  test("a refused start is counted with the server's status, and no viva is followed", async () => {
    startVivaSession.mockRejectedValue(new APIError("Too many requests", 429));
    renderRoom();

    await pressStart();
    await screen.findByRole("alert");

    expect(analytics.track.mock.calls).toEqual([
      ["viva_requested", CHOICE],
      ["viva_start_failed", { ...CHOICE, status: 429 }],
    ]);
    expect(analytics.trackViva).not.toHaveBeenCalled();
  });

  test("a start that never reached the server has no status to give", async () => {
    startVivaSession.mockRejectedValue(new Error("offline"));
    renderRoom();

    await pressStart();
    await screen.findByRole("alert");

    expect(analytics.track.mock.calls[1]).toEqual([
      "viva_start_failed",
      { ...CHOICE, status: null },
    ]);
  });

  test("a fault after the room opened belongs to the viva, not to the start", async () => {
    engine.initializeSession.mockRejectedValueOnce(new Error("no microphone"));
    renderRoom();

    await pressStart();
    await screen.findByText("live: Science / Cell");

    expect(analytics.trackViva).toHaveBeenCalledTimes(1);
    expect(analytics.track.mock.calls).toEqual([["viva_requested", CHOICE]]);
  });

  test("a viva created after the student had left is released, and never followed", async () => {
    let answer: (response: unknown) => void = () => undefined;
    startVivaSession.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const view = renderRoom();
    await pressStart();

    view.unmount();
    await act(async () => answer({ viva_session_id: "session-1" }));

    expect(abandonViva).toHaveBeenCalledWith("session-1");
    expect(analytics.trackViva).not.toHaveBeenCalled();
  });

  test("an unheard microphone is passed on to the viva being followed", async () => {
    renderRoom();
    await pressStart();
    await screen.findByText("live: Science / Cell");

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "microphone unheard" }));

    expect(analytics.microphoneUnheard).toHaveBeenCalledTimes(1);
  });

  test("stepping back to the welcome leaves the viva, before its state is cleared", async () => {
    renderRoom();
    await pressStart();
    await screen.findByText("live: Science / Cell");
    act(() => useVivaStore.setState({ sessionState: SessionState.COMPLETED }));
    let stateWhenLeft: SessionState | null = null;
    analytics.leave.mockImplementation(() => {
      stateWhenLeft = useVivaStore.getState().sessionState;
    });

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "choose again" }));

    expect(analytics.leave).toHaveBeenCalledTimes(1);
    expect(stateWhenLeft).toBe(SessionState.COMPLETED);
  });

  test("walking away from the page mid-viva leaves it, exactly once", async () => {
    const view = renderRoom();
    await pressStart();
    await screen.findByText("live: Science / Cell");
    act(() =>
      useVivaStore.setState({
        sessionId: "session-1",
        sessionState: SessionState.ACTIVE,
      }),
    );

    view.unmount();

    expect(analytics.leave).toHaveBeenCalledTimes(1);
  });

  test("nothing is left when no viva was ever started", () => {
    const view = renderRoom();

    view.unmount();

    expect(analytics.leave).not.toHaveBeenCalled();
  });
});
