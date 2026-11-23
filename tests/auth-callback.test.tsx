// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { AuthCallback } from "@/components/auth/auth-callback";

// What the screen reports to analytics, recorded here instead of sent.
const analytics = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@/lib/analytics/events", () => ({ track: analytics.track }));

vi.mock("aws-amplify/auth/enable-oauth-listener", () => ({}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

const getCurrentUser = vi.fn();
vi.mock("aws-amplify/auth", () => ({
  getCurrentUser: () => getCurrentUser(),
}));
vi.mock("@/lib/auth/client", () => ({ configureAuth: vi.fn() }));

type Listener = (event: { payload: { event: string } }) => void;
let listener: Listener | null = null;
const stopListening = vi.fn();
vi.mock("aws-amplify/utils", () => ({
  Hub: {
    listen: (_channel: string, callback: Listener) => {
      listener = callback;
      return stopListening;
    },
  },
}));

const replace = vi.fn();

function arriveAt(search: string) {
  vi.stubGlobal("location", { ...window.location, search, replace });
}

function announce(event: string) {
  act(() => listener?.({ payload: { event } }));
}

beforeEach(() => {
  listener = null;
  stopListening.mockReset();
  replace.mockReset();
  getCurrentUser.mockReset();
  getCurrentUser.mockRejectedValue(new Error("not signed in yet"));
  window.sessionStorage.clear();
  arriveAt("?code=abc&state=xyz");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("while Google's answer is being exchanged, the student sees that it is working", () => {
  const { container } = render(<AuthCallback />);

  expect(screen.getByRole("status").textContent).toMatch(/Signing you in/);
  expect(replace).not.toHaveBeenCalled();
  // The frame around it already shows the mark; a second one would stack
  // under it on a phone.
  expect(container.querySelector("svg")).toBeNull();
});

test("a finished sign-in opens the page the student was heading to", () => {
  window.sessionStorage.setItem("ambrace.auth.return", "/v/123");
  render(<AuthCallback />);

  announce("signInWithRedirect");

  expect(replace).toHaveBeenCalledWith("/v/123");
  // The note is used once and then forgotten.
  expect(window.sessionStorage.getItem("ambrace.auth.return")).toBeNull();
});

test("with nowhere remembered, a finished sign-in opens home", () => {
  render(<AuthCallback />);

  announce("signInWithRedirect");

  expect(replace).toHaveBeenCalledWith("/");
});

test("a sign-in that finished before we started listening is still noticed", async () => {
  getCurrentUser.mockResolvedValue({ userId: "user-1" });

  render(<AuthCallback />);

  await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
});

test("a failed exchange is explained, with a way back", () => {
  render(<AuthCallback />);

  announce("signInWithRedirect_failure");

  expect(screen.getByRole("alert").textContent).toMatch(
    /couldn't finish signing you in/,
  );
  expect(
    screen.getByRole("link", { name: "Back to sign in" }).getAttribute("href"),
  ).toBe("/sign-in");
  expect(replace).not.toHaveBeenCalled();
});

test("pressing Cancel at Google is treated as a failure, not a hang", () => {
  arriveAt("?error=access_denied");

  render(<AuthCallback />);

  expect(screen.getByRole("alert")).toBeTruthy();
});

test("a late success cannot override a failure already shown", () => {
  render(<AuthCallback />);

  announce("signInWithRedirect_failure");
  announce("signInWithRedirect");

  expect(replace).not.toHaveBeenCalled();
});

test("it gives up after twenty seconds instead of spinning forever", () => {
  vi.useFakeTimers();
  render(<AuthCallback />);

  act(() => vi.advanceTimersByTime(19_000));
  expect(screen.queryByRole("alert")).toBeNull();
  act(() => vi.advanceTimersByTime(1_500));
  expect(screen.getByRole("alert")).toBeTruthy();
});

test("leaving the page stops listening", () => {
  const { unmount } = render(<AuthCallback />);

  unmount();

  expect(stopListening).toHaveBeenCalled();
});

test("what analytics is told: a finished Google sign-in, once", () => {
  analytics.track.mockClear();
  render(<AuthCallback />);

  announce("signInWithRedirect");
  announce("signInWithRedirect");

  expect(analytics.track.mock.calls).toEqual([
    ["signed_in", { method: "google" }],
  ]);
});

test("what analytics is told: a Google sign-in that did not finish", () => {
  analytics.track.mockClear();
  render(<AuthCallback />);

  announce("signInWithRedirect_failure");

  expect(analytics.track.mock.calls).toEqual([
    ["sign_in_failed", { method: "google", reason: "RedirectFailed" }],
  ]);
});
