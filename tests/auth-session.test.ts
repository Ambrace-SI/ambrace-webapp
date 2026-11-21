import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const configure = vi.fn();
vi.mock("aws-amplify", () => ({ Amplify: { configure } }));

const fetchBrowserSession = vi.fn();
vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: () => fetchBrowserSession(),
}));

const SETTINGS = {
  NEXT_PUBLIC_COGNITO_USER_POOL_ID: "ap-south-1_example",
  NEXT_PUBLIC_COGNITO_CLIENT_ID: "client123",
  NEXT_PUBLIC_COGNITO_DOMAIN: "ambrace-dev.auth.ap-south-1.amazoncognito.com",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

function configureEnvironment(settings: Record<string, string> = SETTINGS) {
  for (const name of Object.keys(SETTINGS)) vi.stubEnv(name, "");
  for (const [name, value] of Object.entries(settings)) vi.stubEnv(name, value);
}

beforeEach(() => {
  // The module remembers that it has been set up; start each test fresh.
  vi.resetModules();
  configure.mockReset();
  fetchBrowserSession.mockReset();
  configureEnvironment();
});
afterEach(() => vi.unstubAllEnvs());

describe("the access token used for API calls", () => {
  test("is the access token, never the ID token", async () => {
    fetchBrowserSession.mockResolvedValue({
      tokens: {
        accessToken: { toString: () => "access-token" },
        idToken: { toString: () => "id-token" },
      },
    });
    const { getAccessToken } = await import("@/lib/auth/client");

    expect(await getAccessToken()).toBe("access-token");
  });

  test("is null when nobody is signed in", async () => {
    fetchBrowserSession.mockResolvedValue({ tokens: undefined });
    const { getAccessToken } = await import("@/lib/auth/client");

    expect(await getAccessToken()).toBeNull();
  });

  test("is null, not an exception, when the session cannot be read", async () => {
    fetchBrowserSession.mockRejectedValue(new Error("storage blocked"));
    const { getAccessToken } = await import("@/lib/auth/client");

    expect(await getAccessToken()).toBeNull();
  });

  test("is null when sign-in is not configured, instead of crashing the caller", async () => {
    configureEnvironment({});
    const { getAccessToken } = await import("@/lib/auth/client");

    expect(await getAccessToken()).toBeNull();
    expect(fetchBrowserSession).not.toHaveBeenCalled();
  });

  test("is asked for afresh on every call, so an expired token is replaced", async () => {
    fetchBrowserSession
      .mockResolvedValueOnce({
        tokens: { accessToken: { toString: () => "first" } },
      })
      .mockResolvedValueOnce({
        tokens: { accessToken: { toString: () => "refreshed" } },
      });
    const { getAccessToken } = await import("@/lib/auth/client");

    expect(await getAccessToken()).toBe("first");
    expect(await getAccessToken()).toBe("refreshed");
  });
});

describe("setting up the sign-in library in the browser", () => {
  test("happens once, with the session kept in the browser and not in cookies", async () => {
    const { configureAuth } = await import("@/lib/auth/client");

    configureAuth();
    configureAuth();

    expect(configure).toHaveBeenCalledTimes(1);
    const [config, options] = configure.mock.calls[0];
    expect(config.Auth.Cognito.userPoolClientId).toBe("client123");
    // Cookies would be sent to the file store with every request.
    expect(options).toBeUndefined();
  });

  test("names the missing setting when sign-in is not configured", async () => {
    configureEnvironment({ ...SETTINGS, NEXT_PUBLIC_COGNITO_DOMAIN: "" });
    const { configureAuth } = await import("@/lib/auth/client");

    expect(() => configureAuth()).toThrow(/NEXT_PUBLIC_COGNITO_DOMAIN/);
  });
});
