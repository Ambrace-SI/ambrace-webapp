import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, test } from "vitest";

import { APIError } from "@/lib/api/axios";
import { reportPath, VIVA_PATH } from "@/lib/auth/routes";
import {
  MOMENT_LABELS,
  liveMoment,
  type LiveSnapshot,
} from "@/lib/viva/live-state";
import { describeStartError } from "@/lib/viva/start-error";
import {
  ConversationState,
  MicrophoneState,
  PlaybackState,
  SessionState,
} from "@/types/viva";

/** A viva in full flow: connected, microphone open, nobody speaking. */
const snapshot = (changes: Partial<LiveSnapshot> = {}): LiveSnapshot => ({
  sessionState: SessionState.ACTIVE,
  connectionStatus: "connected",
  microphoneState: MicrophoneState.ACTIVE,
  conversationState: ConversationState.LISTENING,
  playbackState: PlaybackState.IDLE,
  isMuted: false,
  ...changes,
});

describe("whose turn it is", () => {
  test("the student is being listened to when the line is quiet", () => {
    expect(liveMoment(snapshot())).toBe("listening");
  });

  test("the examiner has the floor whenever its voice is playing", () => {
    expect(
      liveMoment(
        snapshot({
          playbackState: PlaybackState.PLAYING,
          conversationState: ConversationState.THINKING,
          isMuted: true,
        }),
      ),
    ).toBe("speaking");
  });

  test("a pause while an answer is worked out is thinking", () => {
    expect(
      liveMoment(snapshot({ conversationState: ConversationState.THINKING })),
    ).toBe("thinking");
  });

  test("before the microphone opens, the student is not told they are heard", () => {
    expect(
      liveMoment(snapshot({ microphoneState: MicrophoneState.IDLE })),
    ).toBe("thinking");
  });

  test("a muted student is told so, not that they are being listened to", () => {
    expect(liveMoment(snapshot({ isMuted: true }))).toBe("muted");
  });

  test("a dropped line is shown ahead of anything else in the conversation", () => {
    expect(
      liveMoment(
        snapshot({
          connectionStatus: "reconnecting",
          playbackState: PlaybackState.PLAYING,
        }),
      ),
    ).toBe("reconnecting");
  });

  test.each([
    [SessionState.STARTING, "connecting"],
    [SessionState.CONCLUDING, "concluding"],
    [SessionState.COMPLETED, "completed"],
    [SessionState.ERROR, "error"],
    [SessionState.IDLE, "leaving"],
  ] as const)("a session that is %s shows as %s", (sessionState, moment) => {
    // Whatever the audio is doing, the state of the session wins.
    expect(
      liveMoment(
        snapshot({ sessionState, playbackState: PlaybackState.PLAYING }),
      ),
    ).toBe(moment);
  });

  test("every moment has words for the screen", () => {
    for (const label of Object.values(MOMENT_LABELS)) {
      expect(label.trim()).not.toBe("");
    }
  });
});

describe("why a viva would not start", () => {
  const refused = (status: number) =>
    new APIError("Internal detail that must not be shown", status);

  test("no answer at all is a connection problem", () => {
    expect(describeStartError(new APIError("Network Error"))).toMatch(
      /connection/,
    );
    expect(describeStartError(new Error("boom"))).toMatch(/connection/);
  });

  test.each([
    [401, /Sign in again/],
    [429, /Wait a minute/],
    [422, /chapter/],
    [500, /Try again in a moment/],
  ])("a %s is explained in plain words", (status, wording) => {
    const message = describeStartError(refused(status));

    expect(message).toMatch(wording);
    expect(message).not.toMatch(/Internal detail/);
  });

  test("a raw network library error is read the same way", () => {
    const error = new AxiosError("failed", undefined, undefined, undefined, {
      status: 429,
      statusText: "",
      data: {},
      headers: {},
      config: { headers: new AxiosHeaders() },
    });

    expect(describeStartError(error)).toMatch(/Wait a minute/);
  });
});

describe("addresses", () => {
  test("the viva lives where the voice engine expects", () => {
    expect(VIVA_PATH).toBe("/viva");
  });

  test("a report is one page, told which viva by the address after the ?", () => {
    expect(reportPath("abc-123")).toBe("/v?id=abc-123");
    expect(reportPath("a b&c")).toBe("/v?id=a%20b%26c");
  });
});
