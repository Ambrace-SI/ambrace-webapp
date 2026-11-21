// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { MicrophoneError } from "@/lib/gemini/audio-recorder";
import { CONCLUSION_PATIENCE_MS } from "@/lib/hooks/viva/conclusion-watchdog";
import type { GeminiLiveEventHandlers } from "@/lib/gemini/live-client-sdk";
import { useVivaSession } from "@/lib/hooks/useVivaSession";
import { useVivaStore } from "@/lib/store/viva-store";
import {
  ConversationState,
  MicrophoneState,
  PlaybackState,
  SessionState,
} from "@/types/viva";

/**
 * The hook that runs a live viva: it owns the microphone, the speaker and the
 * connection, and keeps the three in step. The real parts are each tested on
 * their own; here they are stand-ins that record what the hook asked of them
 * and let a test play the part of the microphone, the speaker or the line.
 */
const { parts, FakeClient, FakeRecorder, FakePlayer } = vi.hoisted(() => {
  type AudioCallback = (
    data: ArrayBuffer,
    timing: { sequence: number },
  ) => void;

  const parts = {
    clients: [] as FakeClient[],
    recorders: [] as FakeRecorder[],
    players: [] as FakePlayer[],
    /** Set by a test to make the next part fail the way a real one would. */
    recorderInitialize: null as null | (() => Promise<void>),
    connect: null as null | (() => Promise<void>),
    sendText: null as null | ((text: string) => boolean),
  };

  class FakeClient {
    sent: string[] = [];
    audio: ArrayBuffer[] = [];
    disconnect = vi.fn();
    stopRecovery = vi.fn();
    endAudioStream = vi.fn(() => true);
    constructor(
      public token: string,
      public handlers: GeminiLiveEventHandlers,
      public model: string | undefined,
      _unused: unknown,
      public options: Record<string, unknown>,
    ) {
      parts.clients.push(this);
    }
    connect() {
      return parts.connect ? parts.connect() : Promise.resolve();
    }
    sendText(text: string) {
      this.sent.push(text);
      return parts.sendText ? parts.sendText(text) : true;
    }
    sendAudio(data: ArrayBuffer) {
      this.audio.push(data);
      return true;
    }
  }

  class FakeRecorder {
    onUnexpectedEnd: (() => void) | undefined;
    onAudio: AudioCallback | undefined;
    cleanup = vi.fn();
    constructor() {
      parts.recorders.push(this);
    }
    async initialize(onUnexpectedEnd?: () => void) {
      this.onUnexpectedEnd = onUnexpectedEnd;
      if (parts.recorderInitialize) await parts.recorderInitialize();
    }
    getMicrophoneDiagnostics() {
      return { label: "Built-in microphone" };
    }
    async startRecording(onAudio: AudioCallback) {
      this.onAudio = onAudio;
    }
  }

  class FakePlayer {
    pending = false;
    played: string[] = [];
    stop = vi.fn();
    completeTurn = vi.fn();
    cleanup = vi.fn();
    constructor(public callbacks: Record<string, (...input: never[]) => void>) {
      parts.players.push(this);
    }
    async initialize() {}
    async playAudio(audio: string) {
      this.played.push(audio);
    }
    hasPendingAudio() {
      return this.pending;
    }
  }

  return { parts, FakeClient, FakeRecorder, FakePlayer };
});

vi.mock("@/lib/gemini/live-client-sdk", () => ({
  GeminiLiveClientSDK: FakeClient,
}));
vi.mock("@/lib/gemini/audio-recorder", async (original) => ({
  ...(await original<typeof import("@/lib/gemini/audio-recorder")>()),
  AudioRecorder: FakeRecorder,
}));
vi.mock("@/lib/gemini/audio-player", () => ({ AudioPlayer: FakePlayer }));

// Telemetry is observed elsewhere; here every call is accepted and ignored.
vi.mock("@/lib/telemetry/voice-telemetry", () => ({
  voiceTelemetry: new Proxy({}, { get: () => () => undefined }),
}));

const router = { push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const abandonViva = vi.fn();
const concludeViva = vi.fn();
vi.mock("@/lib/api/axios", async (original) => ({
  ...(await original<typeof import("@/lib/api/axios")>()),
  abandonViva: (id: string) => abandonViva(id),
  concludeViva: (request: unknown) => concludeViva(request),
}));

const KICKOFF = "Application control: Begin the viva now.";

const state = () => useVivaStore.getState();

/** A session the backend has just created, ready to connect. */
function sessionCreated() {
  state().setSessionData({
    viva_session_id: "session-1",
    ephemeral_token: "ephemeral-token",
    google_model: "gemini-live",
    session_duration_minutes: 5,
    voice_name: "Kore",
    google_api_version: "v1alpha",
    session_resumption_enabled: true,
  });
}

async function connect() {
  sessionCreated();
  const hook = renderHook(() => useVivaSession());
  await act(() => hook.result.current.initializeSession());
  return hook;
}

/** Connect, let the examiner give its opening, and open the microphone. */
async function inConversation() {
  const hook = await connect();
  const [client] = parts.clients;
  const [player] = parts.players;
  await act(async () => {
    client.handlers.onSetupComplete?.();
    client.handlers.onTurnComplete?.();
    player.callbacks.onPlayEnd();
  });
  return { hook, client, player, recorder: parts.recorders[0] };
}

const REPORT = {
  score: 7,
  summary: "Clear on cells.",
  strong_points: ["Named the nucleus."],
  areas_of_improvement: ["Organelles."],
};

beforeEach(() => {
  parts.clients.length = 0;
  parts.recorders.length = 0;
  parts.players.length = 0;
  parts.recorderInitialize = null;
  parts.connect = null;
  parts.sendText = null;
  router.push.mockReset();
  abandonViva.mockReset();
  abandonViva.mockResolvedValue({ status: "abandoned" });
  concludeViva.mockReset();
  concludeViva.mockResolvedValue({ status: "completed" });
  state().resetSession();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("connecting", () => {
  test("does nothing until the backend has created a session", async () => {
    const { result } = renderHook(() => useVivaSession());

    await act(() => result.current.initializeSession());

    expect(parts.clients).toHaveLength(0);
    expect(parts.recorders).toHaveLength(0);
    expect(state().sessionState).toBe(SessionState.IDLE);
  });

  test("asks for the microphone first, then the speaker, then the line", async () => {
    await connect();

    expect(parts.recorders).toHaveLength(1);
    expect(parts.players).toHaveLength(1);
    const [client] = parts.clients;
    expect(client.token).toBe("ephemeral-token");
    expect(client.model).toBe("gemini-live");
    expect(client.options).toMatchObject({
      apiVersion: "v1alpha",
      resumptionEnabled: true,
    });
    expect(state().sessionState).toBe(SessionState.STARTING);
    // Nothing is said to the examiner until the line confirms it is ready.
    expect(client.sent).toEqual([]);
  });

  test("the same session is never connected twice", async () => {
    const { result } = await connect();

    await act(() => result.current.initializeSession());

    expect(parts.clients).toHaveLength(1);
  });

  test("once the line is ready the examiner is asked to begin, exactly once", async () => {
    await connect();
    const [client] = parts.clients;

    act(() => {
      client.handlers.onSetupComplete?.();
      client.handlers.onSetupComplete?.();
    });

    expect(client.sent).toEqual([KICKOFF]);
    expect(state().sessionState).toBe(SessionState.ACTIVE);
    expect(state().conversationState).toBe(ConversationState.THINKING);
    expect(state().connectionStatus).toBe("connected");
  });

  test("the microphone stays closed until the examiner's opening has finished playing", async () => {
    await connect();
    const [client] = parts.clients;
    const [player] = parts.players;
    const [recorder] = parts.recorders;

    await act(async () => {
      client.handlers.onSetupComplete?.();
      await client.handlers.onAudioData?.("opening-audio", "audio/pcm");
      player.callbacks.onPlayStart();
    });
    expect(player.played).toEqual(["opening-audio"]);
    expect(state().playbackState).toBe(PlaybackState.PLAYING);
    expect(state().microphoneState).toBe(MicrophoneState.IDLE);

    // The server says the turn is over, but audio is still in the speaker.
    player.pending = true;
    await act(async () => {
      client.handlers.onTurnComplete?.();
      player.callbacks.onPlayEnd();
    });
    expect(recorder.onAudio).toBeUndefined();

    player.pending = false;
    await act(async () => {
      player.callbacks.onPlayEnd();
    });
    expect(recorder.onAudio).toBeDefined();
    expect(state().microphoneState).toBe(MicrophoneState.ACTIVE);
    expect(state().conversationState).toBe(ConversationState.LISTENING);
  });
});

describe("when connecting fails", () => {
  test("a blocked microphone stops the viva with words the student can act on", async () => {
    // Hold the release of the session open, to look at the moment in between.
    let release: (outcome: { status: string }) => void = () => undefined;
    abandonViva.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    parts.recorderInitialize = () =>
      Promise.reject(new MicrophoneError("permission_denied"));

    await connect();

    expect(state().sessionState).toBe(SessionState.ERROR);
    expect(state().error).toMatch(/Microphone access is blocked/);
    expect(parts.clients).toHaveLength(0);
    // The session the backend created is released rather than left hanging.
    expect(abandonViva).toHaveBeenCalledWith("session-1");

    await act(async () => release({ status: "abandoned" }));

    // Then the student is taken home, and the reason travels with them.
    expect(router.push).toHaveBeenCalledWith("/");
    expect(state().error).toMatch(/Microphone access is blocked/);
  });

  test("an unreachable line ends the session and releases the microphone", async () => {
    parts.connect = () => Promise.reject(new Error("Could not reach Gemini"));

    await connect();

    expect(state().error).toBe("Could not reach Gemini");
    expect(parts.recorders[0].cleanup).toHaveBeenCalled();
    expect(parts.players[0].cleanup).toHaveBeenCalled();
    expect(abandonViva).toHaveBeenCalledWith("session-1");
  });

  test("an examiner that cannot be asked to begin is a failed start, not a silent wait", async () => {
    parts.sendText = () => false;
    await connect();

    act(() => parts.clients[0].handlers.onSetupComplete?.());

    expect(state().error).toBe("Could not start the viva. Please try again.");
    expect(state().sessionState).not.toBe(SessionState.ACTIVE);
    expect(abandonViva).toHaveBeenCalledWith("session-1");
  });
});

describe("speaking and listening", () => {
  test("what the student says is sent to the examiner", async () => {
    const { client, recorder } = await inConversation();
    const packet = new ArrayBuffer(8);

    recorder.onAudio?.(packet, { sequence: 1 });

    expect(client.audio).toEqual([packet]);
  });

  test("a muted student is not heard, and the examiner is told the audio stopped", async () => {
    const { hook, client, recorder } = await inConversation();

    act(() => hook.result.current.toggleMute());
    recorder.onAudio?.(new ArrayBuffer(8), { sequence: 1 });

    expect(state().isMuted).toBe(true);
    expect(client.endAudioStream).toHaveBeenCalledTimes(1);
    expect(client.audio).toEqual([]);

    act(() => hook.result.current.toggleMute());
    recorder.onAudio?.(new ArrayBuffer(8), { sequence: 2 });

    expect(client.endAudioStream).toHaveBeenCalledTimes(1);
    expect(client.audio).toHaveLength(1);
  });

  test("when the student talks over the examiner, its voice stops", async () => {
    const { client, player } = await inConversation();
    await act(async () => {
      await client.handlers.onAudioData?.("answer", "audio/pcm");
      player.callbacks.onPlayStart();
    });

    act(() => client.handlers.onInterrupted?.());

    expect(player.stop).toHaveBeenCalled();
    expect(state().playbackState).toBe(PlaybackState.IDLE);
    expect(state().conversationState).toBe(ConversationState.LISTENING);
  });

  test("the pause after the student stops speaking shows as thinking", async () => {
    const { client } = await inConversation();

    act(() =>
      client.handlers.onEvent?.({ type: "voice_activity", activity: "end" }),
    );
    expect(state().conversationState).toBe(ConversationState.THINKING);

    act(() => client.handlers.onEvent?.({ type: "waiting_for_input" }));
    expect(state().conversationState).toBe(ConversationState.LISTENING);
  });
});

describe("finishing", () => {
  test("asking to finish tells the examiner to wrap up, once", async () => {
    const { hook, client } = await inConversation();

    await act(() => hook.result.current.requestConclusion());
    await act(() => hook.result.current.requestConclusion());

    expect(client.sent).toHaveLength(2);
    expect(client.sent[1]).toMatch(/conclude_viva/);
    expect(state().sessionState).toBe(SessionState.CONCLUDING);
    expect(abandonViva).not.toHaveBeenCalled();
  });

  test("the examiner's report is saved, and the viva completes once its goodbye has played", async () => {
    const { hook, client, player, recorder } = await inConversation();
    await act(() => hook.result.current.requestConclusion());
    // The goodbye is still in the speaker when the report arrives.
    player.pending = true;

    act(() =>
      client.handlers.onEvent?.({
        type: "tool_call",
        name: "conclude_viva",
        args: REPORT,
        id: "call-1",
      }),
    );

    await waitFor(() => expect(state().conclusionData).not.toBeNull());
    expect(concludeViva).toHaveBeenCalledWith({
      viva_session_id: "session-1",
      ...REPORT,
    });
    expect(state().conclusionData).toEqual({
      score: 7,
      total: 10,
      feedback: "Clear on cells.",
    });
    expect(state().sessionState).toBe(SessionState.CONCLUDING);

    act(() => player.callbacks.onPlayEnd());

    expect(state().sessionState).toBe(SessionState.COMPLETED);
    // Everything is released, and the short-lived credential is forgotten.
    expect(client.disconnect).toHaveBeenCalled();
    expect(recorder.cleanup).toHaveBeenCalled();
    expect(player.cleanup).toHaveBeenCalled();
    expect(state().ephemeralToken).toBeNull();
    expect(abandonViva).not.toHaveBeenCalled();
  });

  test("a report that cannot be saved ends the session with an explanation", async () => {
    concludeViva.mockRejectedValue(new Error("offline"));
    const { client } = await inConversation();

    act(() =>
      client.handlers.onEvent?.({
        type: "tool_call",
        name: "conclude_viva",
        args: REPORT,
        id: "call-1",
      }),
    );

    await waitFor(() =>
      expect(state().error).toBe("Failed to save session results."),
    );
    await waitFor(() => expect(abandonViva).toHaveBeenCalledWith("session-1"));
    expect(state().conclusionData).toBeNull();
  });

  test("finishing while the line is down waits, then asks as soon as it is back", async () => {
    const { hook, client } = await inConversation();
    act(() => client.handlers.onReconnecting?.("transport"));
    expect(state().connectionStatus).toBe("reconnecting");

    await act(() => hook.result.current.requestConclusion());
    expect(client.sent).toHaveLength(1);
    // Nothing can be sent yet, but the press is acknowledged straight away.
    expect(state().sessionState).toBe(SessionState.CONCLUDING);

    act(() => client.handlers.onRecovered?.("transport", 1200));

    expect(client.sent).toHaveLength(2);
    expect(client.sent[1]).toMatch(/conclude_viva/);
    expect(state().sessionState).toBe(SessionState.CONCLUDING);
    expect(state().connectionStatus).toBe("connected");
  });

  test("once the ending is asked for, the student is no longer heard", async () => {
    const { hook, client, recorder } = await inConversation();
    recorder.onAudio?.(new ArrayBuffer(8), { sequence: 1 });
    expect(client.audio).toHaveLength(1);

    await act(() => hook.result.current.requestConclusion());
    recorder.onAudio?.(new ArrayBuffer(8), { sequence: 2 });

    // Their audio turn is closed before the request, and nothing follows it:
    // a voice in the room cannot talk over the goodbye or the report.
    expect(client.endAudioStream).toHaveBeenCalledTimes(1);
    expect(client.audio).toHaveLength(1);
  });

  describe("when the examiner does not deliver the report", () => {
    const report = {
      type: "tool_call" as const,
      name: "conclude_viva",
      args: REPORT,
      id: "call-1",
    };

    async function finishRequested() {
      const conversation = await inConversation();
      vi.useFakeTimers();
      await act(() => conversation.hook.result.current.requestConclusion());
      return conversation;
    }
    const wait = (ms: number) =>
      act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

    afterEach(() => vi.useRealTimers());

    test("it is asked once more, then the session is given up with a reason", async () => {
      const { client } = await finishRequested();

      await wait(CONCLUSION_PATIENCE_MS);
      expect(client.sent).toHaveLength(3);
      expect(client.sent[2]).toBe(client.sent[1]);
      expect(abandonViva).not.toHaveBeenCalled();

      await wait(CONCLUSION_PATIENCE_MS);
      expect(abandonViva).toHaveBeenCalledWith("session-1");
      expect(state().error).toMatch(/could not prepare the report/);
      // The student is taken home, and the reason is still there to show.
      expect(router.push).toHaveBeenCalledWith("/");
    });

    test("a report that arrives in time is left to finish in peace", async () => {
      const { client } = await finishRequested();

      act(() => client.handlers.onEvent?.(report));
      await wait(CONCLUSION_PATIENCE_MS * 3);

      expect(client.sent).toHaveLength(2);
      expect(abandonViva).not.toHaveBeenCalled();
      expect(state().sessionState).toBe(SessionState.COMPLETED);
    });

    test("while the line is down, the request is not repeated into nothing", async () => {
      const { client } = await finishRequested();
      act(() => client.handlers.onReconnecting?.("transport"));

      await wait(CONCLUSION_PATIENCE_MS);

      expect(client.sent).toHaveLength(2);
    });
  });

  test("cancelling before the conversation starts gives the session up and goes home", async () => {
    const { result } = await connect();

    await act(() => result.current.requestConclusion());

    expect(abandonViva).toHaveBeenCalledWith("session-1");
    expect(router.push).toHaveBeenCalledWith("/");
    expect(state().sessionState).toBe(SessionState.IDLE);
  });

  test("if the report was already saved, ending goes to it instead of home", async () => {
    abandonViva.mockResolvedValue({ status: "completed" });
    const { result } = await connect();

    await act(() => result.current.requestConclusion());

    expect(router.push).toHaveBeenCalledWith("/v?id=session-1");
    expect(state().sessionState).toBe(SessionState.COMPLETED);
  });

  test("if the session cannot be ended, the student stays put and is told", async () => {
    abandonViva.mockRejectedValue(new Error("offline"));
    const { result } = await connect();

    await act(() => result.current.requestConclusion());

    expect(state().error).toBe("Could not end the session. Please try again.");
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("when something breaks mid-conversation", () => {
  test("a microphone that is unplugged ends the session and says so", async () => {
    const { recorder, client } = await inConversation();

    act(() => recorder.onUnexpectedEnd?.());

    expect(state().sessionState).toBe(SessionState.ERROR);
    expect(state().error).toMatch(/microphone disconnected/);
    expect(client.disconnect).toHaveBeenCalled();
    expect(abandonViva).toHaveBeenCalledWith("session-1");
  });

  test("a speaker that fails ends the session and says so", async () => {
    const { player } = await inConversation();

    act(() => {
      player.callbacks.onPlaybackError();
      player.callbacks.onPlaybackError();
    });

    expect(state().error).toBe(
      "Audio playback could not continue. Please try again.",
    );
    expect(abandonViva).toHaveBeenCalledTimes(1);
  });

  test("a line that fails for good ends the session with the reason", async () => {
    const { client } = await inConversation();

    act(() => client.handlers.onError?.(new Error("Connection lost")));

    expect(state().sessionState).toBe(SessionState.ERROR);
    expect(state().error).toBe("Connection lost");
    expect(abandonViva).toHaveBeenCalledWith("session-1");
  });

  test("a line that simply closes gives the session up", async () => {
    const { client } = await inConversation();

    act(() => client.handlers.onDisconnected?.());

    await waitFor(() => expect(abandonViva).toHaveBeenCalledWith("session-1"));
  });

  test("a line that closes after the report was saved is not a failure", async () => {
    const { hook, client } = await inConversation();
    await act(() => hook.result.current.requestConclusion());
    act(() =>
      client.handlers.onEvent?.({
        type: "tool_call",
        name: "conclude_viva",
        args: REPORT,
        id: "call-1",
      }),
    );
    await waitFor(() =>
      expect(state().sessionState).toBe(SessionState.COMPLETED),
    );

    act(() => client.handlers.onDisconnected?.());

    expect(abandonViva).not.toHaveBeenCalled();
    expect(state().error).toBeNull();
  });
});

describe("leaving the page", () => {
  test("releases the microphone, the speaker and the line", async () => {
    const { hook, client, player, recorder } = await inConversation();

    hook.unmount();

    expect(client.disconnect).toHaveBeenCalled();
    expect(recorder.cleanup).toHaveBeenCalled();
    expect(player.cleanup).toHaveBeenCalled();
    expect(state().microphoneState).toBe(MicrophoneState.IDLE);
  });

  test("a line torn down on the way out cannot change the session afterwards", async () => {
    const { hook, client } = await inConversation();
    hook.unmount();

    client.handlers.onError?.(new Error("late failure"));
    client.handlers.onDisconnected?.();

    expect(state().error).toBeNull();
    expect(abandonViva).not.toHaveBeenCalled();
  });
});
