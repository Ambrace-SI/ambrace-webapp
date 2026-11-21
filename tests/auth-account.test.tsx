// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { changePassword, getSignInAccount } from "@/lib/auth/account";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useMe } from "@/lib/hooks/use-me";
import { useSignInAccount } from "@/lib/hooks/use-sign-in-account";
import type { Me } from "@/types/profile";

const amplify = vi.hoisted(() => ({
  fetchAuthSession: vi.fn(),
  updatePassword: vi.fn(),
}));
vi.mock("aws-amplify/auth", () => amplify);
const configureAuth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/client", () => ({ configureAuth }));

vi.mock("@/lib/api/me", () => ({
  ME_PATH: "/api/v1/me",
  getMe: () => new Promise(() => undefined),
  saveProfile: vi.fn(),
}));

/** A session whose ID token carries these claims. */
const sessionWith = (claims: Record<string, unknown>) => ({
  tokens: { idToken: { payload: claims } },
});

beforeEach(() => {
  amplify.fetchAuthSession.mockReset();
  amplify.updatePassword.mockReset();
  configureAuth.mockReset();
});

describe("reading how the student signs in", () => {
  test("an email-and-password account has a password of ours", async () => {
    amplify.fetchAuthSession.mockResolvedValue(
      sessionWith({ email: "asha@example.com" }),
    );

    expect(await getSignInAccount()).toEqual({
      email: "asha@example.com",
      method: "password",
    });
    expect(configureAuth).toHaveBeenCalled();
  });

  test("an account that came from Google does not", async () => {
    amplify.fetchAuthSession.mockResolvedValue(
      sessionWith({
        email: "asha@example.com",
        identities: [{ providerName: "Google" }],
      }),
    );

    expect((await getSignInAccount()).method).toBe("google");
  });

  test.each([
    ["an empty list of other sign-ins", { identities: [] }],
    ["something that is not a list", { identities: "Google" }],
  ])("%s is not taken for Google", async (_, claims) => {
    amplify.fetchAuthSession.mockResolvedValue(sessionWith(claims));

    expect((await getSignInAccount()).method).toBe("password");
  });

  test.each([
    ["missing", {}],
    ["empty", { email: "" }],
    ["not text", { email: 42 }],
  ])("an email that is %s is reported as none", async (_, claims) => {
    amplify.fetchAuthSession.mockResolvedValue(sessionWith(claims));

    expect((await getSignInAccount()).email).toBeNull();
  });

  test("with nobody signed in there is no account to describe", async () => {
    amplify.fetchAuthSession.mockResolvedValue({});

    await expect(getSignInAccount()).rejects.toThrow("Nobody is signed in.");
  });
});

describe("changing the password", () => {
  test("hands the sign-in service the current password and the new one", async () => {
    amplify.updatePassword.mockResolvedValue(undefined);

    await changePassword("OldPass123", "NewPass456");

    expect(configureAuth).toHaveBeenCalled();
    expect(amplify.updatePassword).toHaveBeenCalledWith({
      oldPassword: "OldPass123",
      newPassword: "NewPass456",
    });
  });

  test("a refusal is passed on for the screen to explain", async () => {
    const refusal = { name: "NotAuthorizedException" };
    amplify.updatePassword.mockRejectedValue(refusal);

    await expect(changePassword("a", "b")).rejects.toBe(refusal);
  });
});

function withQueries(client = new QueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("the account, for a screen", () => {
  test("is read once and not asked for again", async () => {
    amplify.fetchAuthSession.mockResolvedValue(
      sessionWith({ email: "asha@example.com" }),
    );
    const wrapper = withQueries();

    const first = renderHook(() => useSignInAccount(), { wrapper });
    await waitFor(() => expect(first.result.current.data).toBeDefined());
    const second = renderHook(() => useSignInAccount(), { wrapper });

    expect(second.result.current.data?.email).toBe("asha@example.com");
    expect(amplify.fetchAuthSession).toHaveBeenCalledTimes(1);
  });

  test("a failure is reported once, not retried", async () => {
    amplify.fetchAuthSession.mockRejectedValue(new Error("no session"));

    const { result } = renderHook(() => useSignInAccount(), {
      wrapper: withQueries(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(amplify.fetchAuthSession).toHaveBeenCalledTimes(1);
  });
});

describe("a page the server sent, while React takes it over", () => {
  const ME: Me = {
    user_id: "user-1",
    onboarding_complete: true,
    profile: {
      name: "Asha Rao",
      class_level: 9,
      board: null,
      school_name: null,
      school_address: null,
      created_at: "2026-11-21T10:00:00Z",
      updated_at: "2026-11-21T10:00:00Z",
    },
  };

  function Greeting() {
    const { data: me, error } = useMe();
    const hydrated = useHydrated();
    return (
      <p data-hydrated={hydrated}>
        {error ? "failed" : me ? `Hello, ${me.profile?.name}` : "Loading"}
      </p>
    );
  }

  test("a page built in the browser has the profile at once", () => {
    const client = new QueryClient();
    client.setQueryData(["me"], ME);

    render(<Greeting />, { wrapper: withQueries(client) });

    expect(screen.getByText("Hello, Asha Rao")).toBeTruthy();
  });

  test("on the server nothing about the student is known", () => {
    const client = new QueryClient();
    client.setQueryData(["me"], ME);
    const Wrapper = withQueries(client);

    const html = renderToString(
      <Wrapper>
        <Greeting />
      </Wrapper>,
    );

    expect(html).toContain("Loading");
    expect(html).toContain('data-hydrated="false"');
  });

  test("the profile is held back until the takeover is done, so the two never disagree", async () => {
    // The frame around the page can have the profile before the page inside
    // has been taken over. Drawing it early would not match the server.
    const client = new QueryClient();
    client.setQueryData(["me"], ME);
    const Wrapper = withQueries(client);
    const page = (
      <Wrapper>
        <Greeting />
      </Wrapper>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(page);
    document.body.appendChild(container);
    const complaints = vi.spyOn(console, "error").mockImplementation(() => {});
    const mismatches: unknown[] = [];

    await act(async () => {
      hydrateRoot(container, page, {
        onRecoverableError: (error) => mismatches.push(error),
      });
    });

    expect(mismatches).toEqual([]);
    expect(complaints).not.toHaveBeenCalled();
    expect(container.textContent).toBe("Hello, Asha Rao");
    container.remove();
  });
});
