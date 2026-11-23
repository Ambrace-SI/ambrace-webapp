// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { LiveCaptions } from "@/components/viva/live-captions";
import { LiveSession } from "@/components/viva/live-session";
import { SessionClock } from "@/components/viva/session-clock";
import { VoiceOrb } from "@/components/viva/voice-orb";
import type { useVivaSession } from "@/lib/hooks/useVivaSession";
import { useVivaStore, type Transcript } from "@/lib/store/viva-store";
import { UNHEARD_AFTER_SECONDS } from "@/lib/viva/microphone-health";
import {
  ConversationState,
  MicrophoneState,
  PlaybackState,
  SessionState,
} from "@/types/viva";
import { privateContentLeaks } from "./helpers/private-content";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

// The microphone's measurements, as the voice engine would report them.
const microphone = vi.hoisted(() => ({ rmsDbfs: -30 }));
vi.mock("@/lib/telemetry/voice-telemetry", () => ({
  voiceTelemetry: {
    getSnapshot: () => ({
      connectionState: "connected",
      currentTurn: 0,
      totalInputPackets: 0,
      inputPacketsDropped: 0,
      inputContinuity: {
        dropCounts: {},
        maxCaptureToMainAgeMs: null,
        maxAcceptedSendIntervalMs: null,
      },
      microphoneLevel: { rmsDbfs: microphone.rmsDbfs },
      microphoneFormat: null,
      microphoneErrorCode: null,
      totalOutputChunks: 0,
      sessionPlaybackUnderrunCount: 0,
      connectionRetryCount: 0,
    }),
  },
}));

type Session = ReturnType<typeof useVivaSession>;

const requestConclusion = vi.fn(async () => undefined);
const toggleMute = vi.fn();
const onChooseAgain = vi.fn();
const onMicrophoneUnheard = vi.fn();

/** A viva in full flow, as the hook would hand it to the screen. */
function session(changes: Partial<Session> = {}): Session {
  return {
    ...useVivaStore.getState(),
    sessionId: "session-1",
    sessionState: SessionState.ACTIVE,
    connectionStatus: "connected",
    microphoneState: MicrophoneState.ACTIVE,
    conversationState: ConversationState.LISTENING,
    playbackState: PlaybackState.IDLE,
    requestConclusion,
    toggleMute,
    ...changes,
  } as Session;
}

function renderLive(changes: Partial<Session> = {}) {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const view = render(
    <QueryClientProvider client={client}>
      <LiveSession
        session={session(changes)}
        scope={{ subject: "Science", chapter: "Cell" }}
        onChooseAgain={onChooseAgain}
        onMicrophoneUnheard={onMicrophoneUnheard}
      />
    </QueryClientProvider>,
  );
  return { ...view, invalidate };
}

const line = (
  id: string,
  role: Transcript["role"],
  text: string,
): Transcript => ({
  id,
  role,
  text,
  timestamp: 0,
  isFinal: true,
});

beforeEach(() => {
  requestConclusion.mockClear();
  toggleMute.mockClear();
  onChooseAgain.mockClear();
  onMicrophoneUnheard.mockClear();
  useVivaStore.getState().resetSession();
  microphone.rmsDbfs = -30;
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

describe("during the conversation", () => {
  test("says what the viva is about and whose turn it is", () => {
    const { container } = renderLive();

    expect(screen.getByText("Science · Cell")).toBeTruthy();
    expect(screen.getByText("Listening").getAttribute("role")).toBe("status");
    expect(
      container.querySelector("svg[data-moment]")?.getAttribute("data-moment"),
    ).toBe("listening");
  });

  test("it follows the student's theme, with no header to wander off through", () => {
    const { container } = renderLive();

    // Not forced to Ink: a student who chose light gets a light viva.
    expect(container.firstElementChild?.classList.contains("dark")).toBe(false);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button", { name: /sign out/i })).toBeNull();
  });

  test("the examiner's turn is named", () => {
    renderLive({ playbackState: PlaybackState.PLAYING });

    expect(screen.getByText("Your examiner is speaking")).toBeTruthy();
  });

  test("mute is a toggle that says what pressing it will do", async () => {
    const user = userEvent.setup();
    const view = renderLive();
    const mute = screen.getByRole("button", { name: "Mute microphone" });
    expect(mute.getAttribute("aria-pressed")).toBe("false");

    await user.click(mute);
    expect(toggleMute).toHaveBeenCalledTimes(1);

    view.unmount();
    renderLive({ isMuted: true });
    expect(
      screen
        .getByRole("button", { name: "Unmute microphone" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByText("You are muted")).toBeTruthy();
  });

  test("finishing asks the examiner to wrap up", async () => {
    renderLive();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Finish and get my report" }));

    expect(requestConclusion).toHaveBeenCalledTimes(1);
  });

  test("a press that takes time to be acknowledged shows that it was taken", async () => {
    let acknowledge: () => void = () => undefined;
    requestConclusion.mockImplementationOnce(
      () =>
        new Promise<undefined>(
          (resolve) => (acknowledge = () => resolve(undefined)),
        ),
    );
    renderLive();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Finish and get my report" }));

    const waiting = screen.getByRole("button", {
      name: "One moment",
    }) as HTMLButtonElement;
    expect(waiting.disabled).toBe(true);
    expect(waiting.getAttribute("aria-busy")).toBe("true");

    await act(async () => acknowledge());
    expect(
      screen.getByRole("button", { name: "Finish and get my report" }),
    ).toBeTruthy();
  });

  test("a microphone that delivers nothing is pointed out, gently", () => {
    vi.useFakeTimers();
    microphone.rmsDbfs = -120;
    renderLive();
    expect(screen.queryByText(/can't hear anything/)).toBeNull();

    act(() => void vi.advanceTimersByTime((UNHEARD_AFTER_SECONDS + 1) * 1000));

    expect(screen.getByText(/can't hear anything/).getAttribute("role")).toBe(
      "status",
    );
    expect(console.info).toHaveBeenCalledWith(
      "[Viva] voice summary (microphone unheard)",
      expect.anything(),
    );
    vi.useRealTimers();
  });

  test("silence while the examiner is speaking is not the student's problem", () => {
    vi.useFakeTimers();
    microphone.rmsDbfs = -120;
    renderLive({ playbackState: PlaybackState.PLAYING });

    act(() => void vi.advanceTimersByTime((UNHEARD_AFTER_SECONDS + 5) * 1000));

    expect(screen.queryByText(/can't hear anything/)).toBeNull();
    vi.useRealTimers();
  });

  test("a wobble on the line and a recoverable fault are both shown", () => {
    renderLive({
      connectionStatus: "reconnecting",
      connectionNotice: "Reconnecting to your examiner",
      error: "Could not end the session. Please try again.",
    });

    expect(screen.getByText("Reconnecting")).toBeTruthy();
    expect(screen.getByText("Reconnecting to your examiner")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/Could not end/);
  });
});

describe("before and after the conversation", () => {
  test("while connecting, the only thing to do is cancel", async () => {
    renderLive({ sessionState: SessionState.STARTING });

    expect(screen.getByText("Connecting")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Mute microphone",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Cancel" }));
    expect(requestConclusion).toHaveBeenCalledTimes(1);
  });

  test("while the report is written, nothing can be pressed twice", () => {
    renderLive({ sessionState: SessionState.CONCLUDING });

    const finish = screen.getByRole("button", {
      name: "Preparing your report",
    }) as HTMLButtonElement;
    expect(finish.disabled).toBe(true);
    expect(finish.getAttribute("aria-busy")).toBe("true");
    expect(
      (
        screen.getByRole("button", {
          name: "Mute microphone",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  test("a finished viva shows the score and leads to the report", () => {
    const { invalidate } = renderLive({
      sessionState: SessionState.COMPLETED,
      conclusionData: { score: 7, total: 10, feedback: "Clear on cells." },
    });

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "7 / 10",
    );
    expect(screen.getByText("Clear on cells.")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "See the full report" })
        .getAttribute("href"),
    ).toBe("/v?id=session-1");
    // Home is this same page, so going back is a step, not a link.
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Back to home",
    ]);
    // The controls and the clock are gone: there is nothing left to control.
    expect(screen.queryByRole("button", { name: /mute/i })).toBeNull();
    expect(screen.queryByRole("timer")).toBeNull();
    // The history list is told there is something new.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["history"] });
    // While developing, what the audio did is left in the console.
    expect(console.info).toHaveBeenCalledWith(
      "[Viva] voice summary (viva over)",
      expect.objectContaining({ packetsSent: 0 }),
    );
  });

  test("back to home returns to the welcome on this same page", async () => {
    renderLive({ sessionState: SessionState.COMPLETED, conclusionData: null });

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Back to home" }));

    expect(onChooseAgain).toHaveBeenCalledTimes(1);
  });

  test("a viva that broke offers one way on, since home is where it starts again", () => {
    renderLive({ sessionState: SessionState.ERROR, error: "Lost." });

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Start again",
    ]);
  });

  test("a viva completed elsewhere, with no score to hand, still leads to the report", () => {
    renderLive({ sessionState: SessionState.COMPLETED, conclusionData: null });

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Your report is ready.",
    );
  });

  test("a viva that broke says why and offers a fresh start", async () => {
    renderLive({
      sessionState: SessionState.ERROR,
      error: "Microphone access was blocked.",
    });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/Microphone access was blocked\./);
    expect(alert.textContent).toMatch(/Nothing has been marked against you/);

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Start again" }));
    expect(onChooseAgain).toHaveBeenCalledTimes(1);
  });

  test("a break with no stated reason still says something", () => {
    renderLive({ sessionState: SessionState.ERROR, error: null });

    expect(screen.getByRole("alert").textContent).toMatch(
      /Something went wrong on the line/,
    );
  });

  test("being taken home after ending early is not shown as a fault", () => {
    renderLive({ sessionState: SessionState.IDLE });

    expect(screen.getByText("One moment")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("the orbit", () => {
  const moving = (container: HTMLElement) =>
    [...container.querySelectorAll("[class*='animate-']")].map((element) =>
      [...element.classList].find((name) => name.startsWith("animate-")),
    );

  test.each([
    ["speaking", ["animate-speak"]],
    ["listening", ["animate-breathe"]],
    ["thinking", ["animate-turn"]],
    ["concluding", ["animate-turn"]],
    ["muted", []],
    ["connecting", []],
  ] as const)("while %s, only one thing moves", (moment, expected) => {
    const { container } = render(<VoiceOrb moment={moment} />);

    expect(moving(container)).toEqual(expected);
  });

  test("the student's point goes hollow when muted", () => {
    const { container } = render(<VoiceOrb moment="muted" />);

    expect(container.querySelectorAll("circle")[1].getAttribute("fill")).toBe(
      "none",
    );
  });

  test("it fades back while there is no line", () => {
    const { container } = render(<VoiceOrb moment="reconnecting" />);

    expect(
      container.querySelector("svg")?.classList.contains("opacity-40"),
    ).toBe(true);
  });

  test("it is decoration: the words beside it carry the meaning", () => {
    const { container } = render(<VoiceOrb moment="listening" />);

    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });
});

describe("the captions", () => {
  test("before anyone speaks, it says what will appear", () => {
    render(<LiveCaptions transcripts={[]} />);

    expect(screen.getByText(/will appear here/)).toBeTruthy();
    expect(screen.queryByRole("log")).toBeNull();
  });

  test("each line says who spoke; blank lines are left out", () => {
    render(
      <LiveCaptions
        transcripts={[
          line("1", "assistant", "What is a cell?"),
          line("2", "user", "   "),
          line("3", "user", "The basic unit of life."),
        ]}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "ExaminerWhat is a cell?",
      "YouThe basic unit of life.",
    ]);
  });

  test("the newest line is kept in view, unless the student has scrolled up to re-read", () => {
    const first = [line("1", "assistant", "What is a cell?")];
    const view = render(<LiveCaptions transcripts={first} />);
    const log = screen.getByRole("log");
    Object.defineProperties(log, {
      scrollHeight: { configurable: true, value: 500 },
      clientHeight: { configurable: true, value: 100 },
    });

    view.rerender(
      <LiveCaptions transcripts={[...first, line("2", "user", "A unit.")]} />,
    );
    expect(log.scrollTop).toBe(500);

    // The student scrolls back up to the start.
    log.scrollTop = 0;
    act(() => {
      log.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    view.rerender(
      <LiveCaptions
        transcripts={[
          ...first,
          line("2", "user", "A unit."),
          line("3", "assistant", "Go on."),
        ]}
      />,
    );
    expect(log.scrollTop).toBe(0);

    // Back at the bottom, it follows again.
    log.scrollTop = 400;
    act(() => {
      log.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    Object.defineProperty(log, "scrollHeight", {
      configurable: true,
      value: 700,
    });
    view.rerender(
      <LiveCaptions
        transcripts={[
          ...first,
          line("2", "user", "A unit."),
          line("3", "assistant", "Go on."),
          line("4", "user", "Of life."),
        ]}
      />,
    );
    expect(log.scrollTop).toBe(700);
  });
});

describe("the clock", () => {
  function showClock(timeRemaining: number) {
    useVivaStore.setState({ timeRemaining, sessionState: SessionState.IDLE });
    render(<SessionClock onTimeLimit={() => undefined} />);
    return screen.getByRole("timer");
  }

  test("is quiet for most of the session", () => {
    const timer = showClock(245);

    expect(timer.textContent).toBe("04:05");
    expect(timer.parentElement?.textContent).toBe("04:05");
    expect(
      timer.parentElement?.classList.contains("text-muted-foreground"),
    ).toBe(true);
  });

  test("warns in words, not only colour, for the last two minutes", () => {
    const timer = showClock(120);

    expect(timer.parentElement?.textContent).toBe("Almost time02:00");
    expect(timer.parentElement?.classList.contains("text-warning")).toBe(true);
  });

  test("says it is ending in the last minute", () => {
    const timer = showClock(60);

    expect(timer.parentElement?.textContent).toBe("Ending soon01:00");
    expect(timer.parentElement?.classList.contains("text-destructive")).toBe(
      true,
    );
  });

  test("when time runs out, the examiner is asked to wrap up", () => {
    vi.useFakeTimers();
    try {
      const onTimeLimit = vi.fn();
      useVivaStore.setState({
        timeRemaining: 1,
        sessionDeadlineAt: null,
        sessionState: SessionState.ACTIVE,
      });
      render(<SessionClock onTimeLimit={onTimeLimit} />);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onTimeLimit).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("timer").textContent).toBe("00:00");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("a microphone that goes unheard", () => {
  test("is reported to whoever is following the viva", () => {
    vi.useFakeTimers();
    microphone.rmsDbfs = -120;
    renderLive();
    expect(onMicrophoneUnheard).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime((UNHEARD_AFTER_SECONDS + 1) * 1000));

    expect(onMicrophoneUnheard).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  test("is not reported while it is the examiner's turn", () => {
    vi.useFakeTimers();
    microphone.rmsDbfs = -120;
    renderLive({ playbackState: PlaybackState.PLAYING });

    act(() => void vi.advanceTimersByTime((UNHEARD_AFTER_SECONDS + 1) * 1000));

    expect(onMicrophoneUnheard).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("what a recording of the viva must not show", () => {
  test("the captions: what the student and the examiner said", () => {
    renderLive({
      transcripts: [
        line("1", "assistant", "What does the nucleus do?"),
        line("2", "user", "The nucleus controls the cell."),
      ],
    });

    expect(
      privateContentLeaks(document.body, [
        "What does the nucleus do?",
        "The nucleus controls the cell.",
      ]),
    ).toEqual([]);
  });

  test("the examiner's closing words about the student, while the score stays visible", () => {
    renderLive({
      sessionState: SessionState.COMPLETED,
      conclusionData: { score: 7, total: 10, feedback: "Clear on cells." },
    });

    expect(privateContentLeaks(document.body, ["Clear on cells."])).toEqual([]);
    // The score is what the recording is for.
    expect(privateContentLeaks(document.body, ["7"])).not.toEqual([]);
  });
});
