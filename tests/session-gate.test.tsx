// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { SessionGate } from "@/components/app/session-gate";
import type { Me } from "@/types/profile";

const router = { replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const signOut = vi.fn();
vi.mock("aws-amplify/auth", () => ({ signOut: () => signOut() }));
vi.mock("@/lib/auth/client", () => ({ configureAuth: vi.fn() }));

const getMe = vi.fn();
vi.mock("@/lib/api/me", () => ({ getMe: () => getMe() }));

const replaceLocation = vi.fn();

const ONBOARDED: Me = {
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
const NEW_STUDENT: Me = {
  user_id: "user-1",
  onboarding_complete: false,
  profile: null,
};

function failure(status: number) {
  return new AxiosError("failed", undefined, undefined, undefined, {
    status,
    statusText: "",
    data: {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

function renderGate(needs: "profile" | "session") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SessionGate needs={needs}>
        <p>The page</p>
      </SessionGate>
    </QueryClientProvider>,
  );
}

/** Puts the student on a page of the app. */
function visit(pathname: string, search = "") {
  vi.stubGlobal("location", { pathname, search, replace: replaceLocation });
}

beforeEach(() => {
  router.replace.mockReset();
  getMe.mockReset();
  signOut.mockReset();
  signOut.mockResolvedValue(undefined);
  replaceLocation.mockReset();
  visit("/");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("the page is on screen while the profile is still loading", () => {
  getMe.mockReturnValue(new Promise(() => undefined));

  renderGate("profile");

  expect(screen.getByText("The page")).toBeTruthy();
});

test("a student with a profile stays on the page", async () => {
  getMe.mockResolvedValue(ONBOARDED);

  renderGate("profile");

  await waitFor(() => expect(getMe).toHaveBeenCalled());
  expect(screen.getByText("The page")).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalled();
});

test("a student without a profile is sent to onboarding and the page is taken away", async () => {
  getMe.mockResolvedValue(NEW_STUDENT);

  renderGate("profile");

  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith("/onboarding"),
  );
  expect(screen.queryByText("The page")).toBeNull();
});

test("the onboarding screen is not redirected to itself", async () => {
  getMe.mockResolvedValue(NEW_STUDENT);

  renderGate("session");

  await waitFor(() => expect(getMe).toHaveBeenCalled());
  expect(router.replace).not.toHaveBeenCalled();
  expect(screen.getByText("The page")).toBeTruthy();
});

test("a session the backend no longer accepts is cleared and sent to sign-in", async () => {
  getMe.mockRejectedValue(failure(401));

  renderGate("profile");

  await waitFor(() => expect(replaceLocation).toHaveBeenCalledWith("/sign-in"));
  expect(signOut).toHaveBeenCalled();
  expect(screen.queryByText("The page")).toBeNull();
});

test("an outage offers a retry and reassures the student, without signing them out", async () => {
  getMe.mockRejectedValue(failure(503));

  renderGate("profile");

  await screen.findByRole("button", { name: "Try again" });
  expect(screen.getByText(/Your account is fine/)).toBeTruthy();
  expect(signOut).not.toHaveBeenCalled();
});

test("trying again after an outage brings the page back", async () => {
  getMe.mockRejectedValueOnce(failure(503)).mockResolvedValue(ONBOARDED);
  renderGate("profile");

  const retry = await screen.findByRole("button", { name: "Try again" });
  retry.click();

  await screen.findByText("The page");
  expect(getMe).toHaveBeenCalledTimes(2);
});

test("someone sent to sign-in comes back to the page they asked for", async () => {
  getMe.mockRejectedValue(failure(401));
  visit("/v", "?id=abc");

  renderGate("profile");

  await waitFor(() =>
    expect(replaceLocation).toHaveBeenCalledWith(
      "/sign-in?next=%2Fv%3Fid%3Dabc",
    ),
  );
});

test("a failed sign-out during cleanup still returns to sign-in", async () => {
  getMe.mockRejectedValue(failure(401));
  signOut.mockRejectedValue(new Error("offline"));

  renderGate("profile");

  await waitFor(() => expect(replaceLocation).toHaveBeenCalledWith("/sign-in"));
});
