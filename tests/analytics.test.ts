// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  PRIVATE_CLASS,
  scrubSecrets,
  withoutQuery,
} from "@/lib/analytics/privacy";
import type { Me } from "@/types/profile";

/**
 * PostHog's own code is replaced by a stand-in that records what it is asked.
 * The app loads it on demand, so each test starts from a fresh copy of our
 * adapter (`freshAnalytics`) with the settings it wants.
 */
const vendor = vi.hoisted(() => {
  const state = { identified: null as string | null };
  const client = {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn((id: string) => {
      state.identified = id;
    }),
    reset: vi.fn(() => {
      state.identified = null;
    }),
    register: vi.fn(),
    unregister: vi.fn(),
    get_distinct_id: vi.fn(() => state.identified ?? "anonymous-device"),
    get_property: vi.fn((name: string) =>
      name === "$user_state"
        ? state.identified
          ? "identified"
          : "anonymous"
        : undefined,
    ),
  };
  return { client, state };
});
vi.mock("posthog-js/dist/module.full.no-external", () => ({
  default: vendor.client,
}));

const ME: Me = {
  user_id: "user-1",
  onboarding_complete: true,
  profile: {
    name: "Asha Rao",
    class_level: 9,
    board: "CBSE",
    school_name: "Hill View School",
    school_address: "12 Lake Road",
    created_at: "2026-11-21T10:00:00Z",
    updated_at: "2026-11-21T10:00:00Z",
  },
};

const SETTINGS = {
  NEXT_PUBLIC_POSTHOG_KEY: "phc_test_dummy_key",
  NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
  NEXT_PUBLIC_APP_VERSION: "abc1234",
};

function configure(settings: Record<string, string | undefined>) {
  for (const name of Object.keys(SETTINGS)) delete process.env[name];
  for (const [name, value] of Object.entries(settings))
    if (value !== undefined) process.env[name] = value;
}

/** A fresh copy of the adapter and what is built on it, not yet loaded. */
async function freshAnalytics(
  settings: Record<string, string | undefined> = SETTINGS,
) {
  configure(settings);
  vi.resetModules();
  return {
    posthog: await import("@/lib/analytics/posthog"),
    events: await import("@/lib/analytics/events"),
    identity: await import("@/lib/analytics/identity"),
  };
}

beforeEach(() => {
  vendor.state.identified = null;
  for (const mock of Object.values(vendor.client)) mock.mockClear();
});

afterEach(() => {
  configure({});
  vi.restoreAllMocks();
});

describe("whether analytics are on", () => {
  test("with a project key and an address, they are", async () => {
    const { posthog } = await freshAnalytics();

    expect(posthog.readAnalyticsSettings()).toEqual({
      apiKey: "phc_test_dummy_key",
      apiHost: "https://us.i.posthog.com",
      appVersion: "abc1234",
    });
  });

  test.each([
    ["no key", { ...SETTINGS, NEXT_PUBLIC_POSTHOG_KEY: undefined }],
    ["a key of only spaces", { ...SETTINGS, NEXT_PUBLIC_POSTHOG_KEY: "   " }],
    [
      "the placeholder a new environment starts with",
      { ...SETTINGS, NEXT_PUBLIC_POSTHOG_KEY: "unset" },
    ],
    ["no address", { ...SETTINGS, NEXT_PUBLIC_POSTHOG_HOST: undefined }],
    [
      "an address that is not HTTPS",
      { ...SETTINGS, NEXT_PUBLIC_POSTHOG_HOST: "http://us.i.posthog.com" },
    ],
  ])("with %s, they are off and nothing is loaded", async (_, settings) => {
    const { posthog, events } = await freshAnalytics(settings);

    expect(posthog.readAnalyticsSettings()).toBeNull();
    expect(posthog.initPostHog()).toBe(false);
    events.track("signed_out");

    expect(await posthog.loadPostHog()).toBeNull();
    expect(vendor.client.init).not.toHaveBeenCalled();
  });

  test("the key and address are used as given, without stray spaces", async () => {
    const { posthog } = await freshAnalytics({
      ...SETTINGS,
      NEXT_PUBLIC_POSTHOG_KEY: " phc_test_dummy_key ",
      NEXT_PUBLIC_POSTHOG_HOST: " https://us.i.posthog.com ",
    });

    await posthog.loadPostHog();

    expect(vendor.client.init.mock.calls[0][0]).toBe("phc_test_dummy_key");
    expect(vendor.client.init.mock.calls[0][1].api_host).toBe(
      "https://us.i.posthog.com",
    );
  });
});

describe("loading PostHog", () => {
  test("asking to start returns at once; the code arrives afterwards", async () => {
    const { posthog } = await freshAnalytics();

    expect(posthog.initPostHog()).toBe(true);
    expect(vendor.client.init).not.toHaveBeenCalled();

    await posthog.loadPostHog();
    expect(vendor.client.init).toHaveBeenCalledTimes(1);
  });

  test("it is loaded and started once, however often it is asked for", async () => {
    const { posthog, events } = await freshAnalytics();

    posthog.initPostHog();
    events.track("signed_out");
    await Promise.all([posthog.loadPostHog(), posthog.loadPostHog()]);
    events.track("signed_out");

    expect(vendor.client.init).toHaveBeenCalledTimes(1);
  });

  test("every event says which build sent it", async () => {
    const { posthog } = await freshAnalytics();

    await posthog.loadPostHog();

    expect(vendor.client.register).toHaveBeenCalledWith({
      app_version: "abc1234",
    });
  });

  test("a build that was not told its version says nothing about it", async () => {
    const { posthog } = await freshAnalytics({
      ...SETTINGS,
      NEXT_PUBLIC_APP_VERSION: undefined,
    });

    await posthog.loadPostHog();

    expect(vendor.client.register).not.toHaveBeenCalled();
  });

  test("what is reported before it arrives is held, then sent in order with the time it happened", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-23T10:00:00Z"));
    const { posthog, events } = await freshAnalytics();

    events.track("google_sign_in_started", { from: "sign_in" });
    vi.setSystemTime(new Date("2026-11-23T10:00:05Z"));
    events.track("signed_out");
    expect(vendor.client.capture).not.toHaveBeenCalled();

    vi.setSystemTime(new Date("2026-11-23T10:00:30Z"));
    await posthog.loadPostHog();
    vi.useRealTimers();

    expect(vendor.client.capture.mock.calls).toEqual([
      [
        "google_sign_in_started",
        { from: "sign_in" },
        { timestamp: new Date("2026-11-23T10:00:00Z") },
      ],
      ["signed_out", {}, { timestamp: new Date("2026-11-23T10:00:05Z") }],
    ]);
  });

  test("once it has arrived, an event is sent straight away", async () => {
    const { posthog, events } = await freshAnalytics();
    await posthog.loadPostHog();

    events.track("signed_out");

    expect(vendor.client.capture).toHaveBeenCalledTimes(1);
  });

  test("if it cannot be started, analytics stay off and the app carries on", async () => {
    vendor.client.init.mockImplementationOnce(() => {
      throw new Error("blocked");
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { posthog, events } = await freshAnalytics();

    events.track("signed_out");

    expect(await posthog.loadPostHog()).toBeNull();
    expect(() => events.track("signed_out")).not.toThrow();
    expect(vendor.client.capture).not.toHaveBeenCalled();
  });

  test("a failure inside PostHog never reaches the app", async () => {
    const { posthog, events } = await freshAnalytics();
    await posthog.loadPostHog();
    vendor.client.capture.mockImplementationOnce(() => {
      throw new Error("blocked");
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(() => events.track("signed_out")).not.toThrow();
  });

  test("only so much is held while waiting, so a load that never ends cannot fill the memory", async () => {
    const { posthog, events } = await freshAnalytics();

    for (let sent = 0; sent < 600; sent++) events.track("signed_out");
    await posthog.loadPostHog();

    expect(vendor.client.capture).toHaveBeenCalledTimes(500);
  });
});

describe("what PostHog is asked to do", () => {
  async function options() {
    const { posthog } = await freshAnalytics();
    return posthog.buildPostHogOptions("https://us.i.posthog.com");
  }

  test("a profile exists only for someone who signed in", async () => {
    expect((await options()).person_profiles).toBe("identified_only");
  });

  test("pages, clicks and errors are captured without being asked for one by one", async () => {
    expect(await options()).toMatchObject({
      capture_pageview: "history_change",
      capture_pageleave: true,
      autocapture: true,
      capture_exceptions: true,
    });
  });

  test("screens are recorded, with every typed input masked", async () => {
    const given = await options();

    expect(given.disable_session_recording).toBe(false);
    expect(given.session_recording).toMatchObject({
      maskAllInputs: true,
      maskInputOptions: { password: true },
    });
  });

  test("the recorder's own rule for private content is left alone", async () => {
    // PostHog blocks elements with its `ph-no-capture` class by default, and
    // its click capture ignores them. Our mark is that class; overriding the
    // recorder's rule here would un-hide everything marked with it.
    const recording = (await options()).session_recording ?? {};

    expect(PRIVATE_CLASS).toBe("ph-no-capture");
    expect(recording).not.toHaveProperty("blockClass");
    expect(recording).not.toHaveProperty("blockSelector");
  });

  test("the console, request bodies and request headers are not recorded", async () => {
    const given = await options();

    expect(given.enable_recording_console_log).toBe(false);
    expect(given.session_recording?.recordBody).toBe(false);
    expect(given.session_recording?.recordHeaders).toBe(false);
  });

  test("a recorded request keeps its path and loses its query, where the live token is", async () => {
    const mask = (await options()).session_recording
      ?.maskCapturedNetworkRequestFn;
    const request = {
      name: "wss://generativelanguage.googleapis.com/ws/live?access_token=secret",
    } as Parameters<NonNullable<typeof mask>>[0];

    expect(mask?.(request)?.name).toBe(
      "wss://generativelanguage.googleapis.com/ws/live",
    );
  });

  test("the request that tells the recorder where to send is left on", async () => {
    // Session replay cannot start without it.
    const given = await options();

    expect(given).not.toHaveProperty("advanced_disable_flags");
    expect(given).not.toHaveProperty("advanced_disable_decide");
  });

  test("the defaults are pinned to a date, so an upgrade changes nothing by itself", async () => {
    expect((await options()).defaults).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("every event is scrubbed on its way out", async () => {
    const beforeSend = (await options()).before_send as (event: unknown) => {
      properties: Record<string, string>;
    };

    const event = beforeSend({
      event: "$pageview",
      properties: {
        $current_url: "https://app.ambrace.in/auth/callback?code=abc&state=xyz",
      },
    });

    expect(event.properties.$current_url).toBe(
      "https://app.ambrace.in/auth/callback?code=[REDACTED]&state=[REDACTED]",
    );
  });
});

describe("removing credentials", () => {
  test("a sign-in code and state in an address", () => {
    expect(scrubSecrets("https://x.test/cb?code=abc123&state=s1&next=/v")).toBe(
      "https://x.test/cb?code=[REDACTED]&state=[REDACTED]&next=/v",
    );
  });

  test("a report address is left alone", () => {
    expect(scrubSecrets("https://x.test/v?id=session-1")).toBe(
      "https://x.test/v?id=session-1",
    );
  });

  test("a live session token and an API key inside error text", () => {
    expect(
      scrubSecrets("failed: auth_tokens/abc-123.def and AIzaSyExample_key-1"),
    ).toBe("failed: [REDACTED_TOKEN] and [REDACTED_KEY]");
  });

  test("however deeply the text is nested", () => {
    expect(
      scrubSecrets({
        list: [{ value: "wss://live.test/?access_token=tok" }],
        count: 3,
        nothing: null,
      }),
    ).toEqual({
      list: [{ value: "wss://live.test/?access_token=[REDACTED]" }],
      count: 3,
      nothing: null,
    });
  });

  test("an address is cut at its query or its fragment, whichever comes first", () => {
    expect(withoutQuery("https://x.test/a?b=1#c")).toBe("https://x.test/a");
    expect(withoutQuery("https://x.test/a#c")).toBe("https://x.test/a");
    expect(withoutQuery("https://x.test/a")).toBe("https://x.test/a");
  });
});

describe("what an event may carry", () => {
  test("anything that names the student, or repeats what they said, is dropped", async () => {
    const { posthog } = await freshAnalytics();
    await posthog.loadPostHog();

    posthog.captureEvent("example", {
      subject: "Science",
      name: "Asha Rao",
      email: "asha@example.com",
      transcript: "the nucleus is...",
      token: "secret",
      missing: undefined,
      nothing: null,
    });

    expect(vendor.client.capture.mock.calls[0].slice(0, 2)).toEqual([
      "example",
      { subject: "Science" },
    ]);
  });
});

describe("who the events belong to", () => {
  test("a student is a person: their account ID, with name, email, class, board and school", async () => {
    const { posthog, identity } = await freshAnalytics();
    await posthog.loadPostHog();

    identity.identifyStudent(ME, "asha@example.com");

    expect(vendor.client.identify).toHaveBeenCalledWith("user-1", {
      onboarding_complete: true,
      name: "Asha Rao",
      email: "asha@example.com",
      class_level: 9,
      board: "CBSE",
      school_name: "Hill View School",
    });
    expect(vendor.client.reset).not.toHaveBeenCalled();
  });

  test("the school's address is not kept: nothing is read by it", async () => {
    const { identity } = await freshAnalytics();

    expect(JSON.stringify(identity.personProperties(ME, null))).not.toMatch(
      /Lake Road/,
    );
  });

  test("an email not yet known is left out, so it never erases one already stored", async () => {
    const { identity } = await freshAnalytics();

    expect(identity.personProperties(ME, null)).not.toHaveProperty("email");
  });

  test("before onboarding there is no name, class or school to give", async () => {
    const { identity } = await freshAnalytics();

    expect(
      identity.personProperties(
        { user_id: "user-2", onboarding_complete: false, profile: null },
        "new@example.com",
      ),
    ).toEqual({
      onboarding_complete: false,
      name: null,
      email: "new@example.com",
      class_level: null,
      board: null,
      school_name: null,
    });
  });

  test("the same student again is not forgotten first", async () => {
    const { posthog, identity } = await freshAnalytics();
    await posthog.loadPostHog();
    identity.identifyStudent(ME, null);

    identity.identifyStudent(ME, "asha@example.com");

    expect(vendor.client.reset).not.toHaveBeenCalled();
    expect(vendor.client.identify).toHaveBeenCalledTimes(2);
  });

  test("a different student on the same browser starts clean, so two students never share a visit", async () => {
    const { posthog, identity } = await freshAnalytics();
    await posthog.loadPostHog();
    identity.identifyStudent(ME, null);
    const order: string[] = [];
    vendor.client.reset.mockImplementationOnce(() => {
      order.push("reset");
      vendor.state.identified = null;
    });
    vendor.client.identify.mockImplementationOnce((id: string) => {
      order.push(`identify ${id}`);
      vendor.state.identified = id;
    });

    identity.identifyStudent({ ...ME, user_id: "user-2" }, null);

    expect(order).toEqual(["reset", "identify user-2"]);
  });

  test("signing out forgets the student on this device", async () => {
    const { posthog, identity } = await freshAnalytics();
    await posthog.loadPostHog();

    identity.forgetStudent();

    expect(vendor.client.reset).toHaveBeenCalledTimes(1);
  });
});
