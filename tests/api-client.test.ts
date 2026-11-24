import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { AxiosError, AxiosHeaders } from "axios";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import api, {
  APIError,
  abandonViva,
  concludeViva,
  getAuthToken,
  getVivaSession,
  setTokenGetter,
  setUnauthorizedHandler,
  startVivaSession,
} from "@/lib/api/axios";
import { httpStatus, isSignedOutError } from "@/lib/api/errors";
import { deleteViva, getHistory, renameViva } from "@/lib/api/history";
import { getMe, saveProfile } from "@/lib/api/me";
import type { ConcludeVivaRequest, VivaStartRequest } from "@/types/viva";

type Sent = {
  method?: string;
  url?: string;
  body: unknown;
  params: unknown;
  authorization: unknown;
};

const sent: Sent[] = [];
let respond: (config: InternalAxiosRequestConfig) => {
  status: number;
  data: unknown;
};
const originalAdapter = api.defaults.adapter;

function answer(status: number, data: unknown = {}) {
  respond = () => ({ status, data });
}

beforeEach(() => {
  sent.length = 0;
  answer(200);
  // The real client, with only the network replaced.
  const adapter: AxiosAdapter = async (config) => {
    sent.push({
      method: config.method,
      url: config.url,
      body: config.data ? JSON.parse(config.data as string) : undefined,
      params: config.params,
      authorization: config.headers.get("Authorization"),
    });
    const { status, data } = respond(config);
    const response = {
      status,
      statusText: "",
      data,
      headers: new AxiosHeaders(),
      config,
    };
    if (status >= 400) {
      throw new AxiosError(
        "Request failed",
        undefined,
        config,
        undefined,
        response,
      );
    }
    return response;
  };
  api.defaults.adapter = adapter;
  setTokenGetter(async () => null);
  setUnauthorizedHandler(null);
});
afterEach(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("the access token on API calls", () => {
  test("is sent as a bearer token", async () => {
    setTokenGetter(async () => "access-token");

    await getMe();

    expect(sent[0].authorization).toBe("Bearer access-token");
  });

  test("is fetched again for every request, so a refreshed token is used", async () => {
    const tokens = ["first", "refreshed"];
    setTokenGetter(async () => tokens.shift() ?? null);

    await getMe();
    await getMe();

    expect(sent.map((request) => request.authorization)).toEqual([
      "Bearer first",
      "Bearer refreshed",
    ]);
  });

  test("is left off when nobody is signed in", async () => {
    setTokenGetter(async () => null);

    await getMe();

    expect(sent[0].authorization).toBeUndefined();
    expect(await getAuthToken()).toBeNull();
  });

  test("a token source that fails does not block the request; the server decides", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    setTokenGetter(async () => {
      throw new Error("storage blocked");
    });

    await getMe();

    expect(sent[0].authorization).toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
});

describe("a call refused as signed out", () => {
  test("is reported once, with the address that was refused", async () => {
    const refused = vi.fn();
    setUnauthorizedHandler(refused);
    answer(401);

    await expect(getMe()).rejects.toMatchObject({ response: { status: 401 } });

    expect(refused).toHaveBeenCalledTimes(1);
    expect(refused).toHaveBeenCalledWith("/api/v1/me");
  });

  test("other failures are not reported as signed out", async () => {
    const refused = vi.fn();
    setUnauthorizedHandler(refused);
    answer(503);

    await expect(getMe()).rejects.toBeDefined();

    expect(refused).not.toHaveBeenCalled();
  });

  test("with nobody listening, the failure still reaches the caller", async () => {
    answer(401);

    await expect(getMe()).rejects.toMatchObject({ response: { status: 401 } });
  });
});

describe("profile calls", () => {
  test("reading and saving use /api/v1/me", async () => {
    answer(200, {
      user_id: "user-1",
      onboarding_complete: false,
      profile: null,
    });

    expect((await getMe()).user_id).toBe("user-1");
    await saveProfile({
      name: "Asha Rao",
      account_type: "student",
      class_level: 9,
    });

    expect(sent.map(({ method, url }) => `${method} ${url}`)).toEqual([
      "get /api/v1/me",
      "put /api/v1/me",
    ]);
    expect(sent[1].body).toEqual({
      name: "Asha Rao",
      account_type: "student",
      class_level: 9,
    });
  });

  test("an expired session is recognisable to the screens", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    answer(401, { detail: "Invalid token" });

    const error = await getMe().catch((thrown: unknown) => thrown);

    expect(isSignedOutError(error)).toBe(true);
  });
});

describe("viva session calls", () => {
  test("starting, concluding, abandoning and reading use the viva routes", async () => {
    answer(200, { ok: true });

    await startVivaSession({ topic: "Light" } as unknown as VivaStartRequest);
    await concludeViva({ score: 7 } as unknown as ConcludeVivaRequest);
    await abandonViva("session-1");
    await getVivaSession("session-1");

    expect(sent.map(({ method, url }) => `${method} ${url}`)).toEqual([
      "post /api/v1/viva/start",
      "post /api/v1/viva/conclude-viva",
      "post /api/v1/viva/session-1/abandon",
      "get /api/v1/viva/session-1",
    ]);
    expect(sent[0].body).toEqual({ topic: "Light" });
  });

  test.each([
    ["start", () => startVivaSession({} as VivaStartRequest)],
    ["conclude", () => concludeViva({} as ConcludeVivaRequest)],
    ["abandon", () => abandonViva("session-1")],
    ["read", () => getVivaSession("session-1")],
  ])(
    "a refused %s carries the server's reason and status",
    async (_name, call) => {
      answer(409, { detail: "Session is no longer active" });

      const error = await call().catch((thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).message).toBe("Session is no longer active");
      expect((error as APIError).status).toBe(409);
      expect(httpStatus(error)).toBe(409);
    },
  );

  test("a failure with no reason from the server still has a message", async () => {
    answer(500, {});

    const error = await getVivaSession("session-1").catch(
      (thrown: unknown) => thrown,
    );

    expect((error as APIError).message.length).toBeGreaterThan(0);
    expect((error as APIError).status).toBe(500);
  });

  test("a failure that never reached the server has no status", async () => {
    api.defaults.adapter = async () => {
      throw new Error("socket closed");
    };

    const error = await getVivaSession("session-1").catch(
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(APIError);
    expect((error as APIError).message).toBe("socket closed");
    expect((error as APIError).status).toBeUndefined();
  });
});

describe("history calls", () => {
  test("a page of history asks for twenty sessions from a cursor", async () => {
    answer(200, { sessions: [], next_cursor: null });

    await getHistory("cursor-1");

    expect(sent[0]).toMatchObject({
      method: "get",
      url: "/api/v1/viva/history",
      params: { limit: 20, cursor: "cursor-1" },
    });
  });

  test("renaming sends the new title; deleting names the session", async () => {
    await renameViva("session-1", "Light and optics");
    await deleteViva("session-1");

    expect(sent[0]).toMatchObject({
      method: "patch",
      url: "/api/v1/viva/session-1/rename",
      body: { new_title: "Light and optics" },
    });
    expect(sent[1]).toMatchObject({
      method: "delete",
      url: "/api/v1/viva/session-1",
    });
  });
});

describe("reading the status of other failures", () => {
  test("an error object that carries a status is understood", () => {
    expect(httpStatus({ status: 503 })).toBe(503);
  });

  test("anything else has no status", () => {
    expect(httpStatus({ status: "503" })).toBeUndefined();
    expect(httpStatus(new Error("boom"))).toBeUndefined();
    expect(httpStatus(null)).toBeUndefined();
    expect(httpStatus("boom")).toBeUndefined();
  });
});
