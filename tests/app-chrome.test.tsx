// @vitest-environment jsdom
import { render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { useIsMobile } from "@/lib/hooks/use-mobile";

/**
 * The small pieces around the pages: the pages shown when an address is wrong
 * or something breaks, signing out, and the two things the side panel has to
 * know about the device (its width, and whether the panel was left folded).
 */
// What signing out reports to analytics, recorded here instead of sent.
const analytics = vi.hoisted(() => ({ order: [] as string[] }));
vi.mock("@/lib/analytics/events", () => ({
  track: (name: string) => void analytics.order.push(name),
}));
vi.mock("@/lib/analytics/identity", () => ({
  forgetStudent: () => void analytics.order.push("forget"),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span>{alt}</span>,
}));

const signOut = vi.fn();
vi.mock("aws-amplify/auth", () => ({ signOut: () => signOut() }));
const configureAuth = vi.fn();
vi.mock("@/lib/auth/client", () => ({
  configureAuth: () => configureAuth(),
}));
const getSignInAccount = vi.fn();
vi.mock("@/lib/auth/account", () => ({
  getSignInAccount: () => getSignInAccount(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("a wrong address", () => {
  test("says the page does not exist and offers the way home", async () => {
    const page = await import("@/app/not-found");

    render(<page.default />);

    expect(page.metadata.title).toBe("Page not found");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "This page doesn't exist",
    );
    const home = screen.getByRole("link", { name: "Go to Home" });
    expect(home.getAttribute("href")).toBe("/");
    // The logo is a second way home.
    expect(
      screen.getByRole("link", { name: "Ambrace" }).getAttribute("href"),
    ).toBe("/");
  });
});

describe("a page that breaks", () => {
  let logged: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  test.each([
    ["outside the app frame", "@/app/error"],
    ["inside the app frame", "@/app/(app)/error"],
  ] as const)("%s: owns the fault and offers to try again", async (_, path) => {
    const { default: ErrorPage } = await import(path);
    const fault = new Error("boom");
    const retry = vi.fn();

    render(<ErrorPage error={fault} retry={retry} />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "That didn't work",
    );
    // The student is never shown the technical detail.
    expect(screen.queryByText(/boom/)).toBeNull();
    expect(logged).toHaveBeenCalledWith(expect.any(String), fault);
    expect(
      screen.getByRole("link", { name: "Go to Home" }).getAttribute("href"),
    ).toBe("/");

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Try again" }));

    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe("signing out", () => {
  const assign = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    signOut.mockReset();
    signOut.mockResolvedValue(undefined);
    getSignInAccount.mockReset();
    getSignInAccount.mockResolvedValue({ email: null, method: "password" });
    assign.mockReset();
    vi.stubGlobal("location", { ...window.location, assign });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("ends the session, then returns to the sign-in screen", async () => {
    const { leaveAmbrace } = await import("@/lib/app/sign-out");

    await leaveAmbrace();

    expect(configureAuth).toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/sign-in");
  });

  test("still leaves the app if ending the session fails", async () => {
    signOut.mockRejectedValue(new Error("offline"));
    const { leaveAmbrace } = await import("@/lib/app/sign-out");

    await leaveAmbrace();

    expect(assign).toHaveBeenCalledWith("/sign-in");
  });

  test("a Google account is left to the sign-in service, which brings the browser back itself", async () => {
    // Going anywhere ourselves would cancel the trip that ends the session
    // there, and the next person to press "Continue with Google" on this
    // computer would be signed in as this student.
    getSignInAccount.mockResolvedValue({ email: null, method: "google" });
    const { leaveAmbrace } = await import("@/lib/app/sign-out");

    await leaveAmbrace();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
  });

  test("a Google account whose trip never starts is still returned to sign-in", async () => {
    getSignInAccount.mockResolvedValue({ email: null, method: "google" });
    const { leaveAmbrace } = await import("@/lib/app/sign-out");

    await leaveAmbrace();
    vi.advanceTimersByTime(5_000);

    expect(assign).toHaveBeenCalledWith("/sign-in");
  });

  test("a Google account still leaves at once if ending the session fails", async () => {
    getSignInAccount.mockResolvedValue({ email: null, method: "google" });
    signOut.mockRejectedValue(new Error("offline"));
    const { leaveAmbrace } = await import("@/lib/app/sign-out");

    await leaveAmbrace();

    expect(assign).toHaveBeenCalledWith("/sign-in");
  });

  test("an account that cannot be read is treated as an Ambrace password", async () => {
    getSignInAccount.mockRejectedValue(new Error("Nobody is signed in."));
    const { leaveAmbrace } = await import("@/lib/app/sign-out");

    await leaveAmbrace();

    expect(assign).toHaveBeenCalledWith("/sign-in");
  });
});

describe("remembering whether the side panel is folded", () => {
  // The preference is read from storage once per visit, so each test starts
  // a new visit by loading the module afresh.
  const load = async () => {
    vi.resetModules();
    return (await import("@/lib/app/panel-preference")).panelPreference;
  };

  test("a new visitor starts with the panel open", async () => {
    expect((await load()).isOpen()).toBe(true);
  });

  test("folding it is remembered on the next visit", async () => {
    (await load()).remember(false);

    expect((await load()).isOpen()).toBe(false);
  });

  test("opening it again is remembered too", async () => {
    const preference = await load();
    preference.remember(false);
    preference.remember(true);

    expect((await load()).isOpen()).toBe(true);
  });

  test("everyone listening is told when it changes, until they stop", async () => {
    const preference = await load();
    const listener = vi.fn();
    const stop = preference.subscribe(listener);

    preference.remember(false);
    stop();
    preference.remember(true);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("a browser that refuses storage still folds for this visit", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const preference = await load();

    expect(preference.isOpen()).toBe(true);
    preference.remember(false);

    expect(preference.isOpen()).toBe(false);
  });
});

describe("knowing a phone from a laptop", () => {
  function screenOf(narrow: boolean) {
    const listeners = new Set<() => void>();
    const media = {
      matches: narrow,
      addEventListener: (_: string, listener: () => void) =>
        listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) =>
        listeners.delete(listener),
    };
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => media),
    );
    return {
      listeners,
      turn(toNarrow: boolean) {
        media.matches = toNarrow;
        listeners.forEach((listener) => listener());
      },
    };
  }

  test("asks about the width the drawer switches at", () => {
    screenOf(true);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
    expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 767px)");
  });

  test("follows the screen when it is resized or turned", async () => {
    const device = screenOf(false);
    const { result, rerender } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    device.turn(true);
    rerender();

    expect(result.current).toBe(true);
  });

  test("stops listening when no longer needed", () => {
    const device = screenOf(false);
    const { unmount } = renderHook(() => useIsMobile());
    expect(device.listeners.size).toBe(1);

    unmount();

    expect(device.listeners.size).toBe(0);
  });
});

describe("what analytics is told on signing out", () => {
  beforeEach(() => {
    analytics.order.length = 0;
    signOut.mockReset();
    signOut.mockImplementation(async () => void analytics.order.push("ended"));
    getSignInAccount.mockReset();
    getSignInAccount.mockResolvedValue({ email: null, method: "password" });
    vi.stubGlobal("location", { ...window.location, assign: vi.fn() });
  });

  test("the sign-out is counted while the student is still known, then the device forgets them, then the session ends", async () => {
    const { leaveAmbrace } = await import("@/lib/app/sign-out");

    await leaveAmbrace();

    expect(analytics.order).toEqual(["signed_out", "forget", "ended"]);
  });

  test("the device forgets the student even when ending the session fails", async () => {
    signOut.mockRejectedValue(new Error("offline"));
    const { leaveAmbrace } = await import("@/lib/app/sign-out");

    await leaveAmbrace();

    expect(analytics.order).toEqual(["signed_out", "forget"]);
  });
});
