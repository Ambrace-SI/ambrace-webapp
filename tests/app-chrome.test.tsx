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
    signOut.mockReset();
    signOut.mockResolvedValue(undefined);
    assign.mockReset();
    vi.stubGlobal("location", { ...window.location, assign });
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
