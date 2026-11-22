// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { useTheme } from "@/lib/hooks/use-theme";
import { THEME_BOOT_SCRIPT } from "@/lib/theme/boot-script";
import {
  THEME_STORAGE_KEY,
  isThemePreference,
  resolveTheme,
} from "@/lib/theme/theme";
import { themePreference } from "@/lib/theme/theme-preference";

/** A device whose colour scheme can be flipped while a test runs. */
function deviceIs(scheme: "light" | "dark") {
  let dark = scheme === "dark";
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      get matches() {
        return query.includes("dark") && dark;
      },
      addEventListener: (_: string, listener: () => void) =>
        listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) =>
        listeners.delete(listener),
    })),
  );
  return {
    switchTo(next: "light" | "dark") {
      dark = next === "dark";
      listeners.forEach((listener) => listener());
    },
  };
}

const root = () => document.documentElement;
const isDark = () => root().classList.contains("dark");

beforeEach(() => {
  localStorage.clear();
  root().classList.remove("dark");
  root().style.colorScheme = "";
  themePreference.reset();
  deviceIs("light");
});
afterEach(() => vi.unstubAllGlobals());

describe("the rules", () => {
  test("light and dark are kept as chosen; device follows the device", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  test("only the three known choices are accepted from storage", () => {
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("system")).toBe(true);
    expect(isThemePreference("sepia")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });
});

describe("before the page is drawn", () => {
  const runBootScript = () => new Function(THEME_BOOT_SCRIPT)();

  test("a remembered dark choice is applied at once, so there is no flash", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");

    runBootScript();

    expect(isDark()).toBe(true);
    expect(root().style.colorScheme).toBe("dark");
  });

  test("with nothing remembered, it follows the device", () => {
    deviceIs("dark");

    runBootScript();

    expect(isDark()).toBe(true);
  });

  test("a light choice wins over a dark device", () => {
    deviceIs("dark");
    localStorage.setItem(THEME_STORAGE_KEY, "light");

    runBootScript();

    expect(isDark()).toBe(false);
    expect(root().style.colorScheme).toBe("light");
  });

  test("storage that refuses to be read does not stop the page", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(runBootScript).not.toThrow();
    vi.restoreAllMocks();
  });
});

describe("choosing a theme", () => {
  test("starts on device, which follows the device", () => {
    deviceIs("dark");
    const { result } = renderHook(() => useTheme());

    expect(result.current.preference).toBe("system");
    expect(result.current.resolved).toBe("dark");
    expect(isDark()).toBe(true);
  });

  test("a choice is applied straight away and remembered on this device", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.choose("dark"));

    expect(result.current.preference).toBe("dark");
    expect(result.current.resolved).toBe("dark");
    expect(isDark()).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  test("on device, a change on the device is followed while the page is open", () => {
    const device = deviceIs("light");
    const { result } = renderHook(() => useTheme());
    expect(isDark()).toBe(false);

    act(() => device.switchTo("dark"));

    expect(result.current.resolved).toBe("dark");
    expect(isDark()).toBe(true);
  });

  test("a fixed choice ignores the device changing", () => {
    const device = deviceIs("light");
    const { result } = renderHook(() => useTheme());
    act(() => result.current.choose("light"));

    act(() => device.switchTo("dark"));

    expect(isDark()).toBe(false);
  });

  test("a choice made in another tab reaches this one", () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      localStorage.setItem(THEME_STORAGE_KEY, "dark");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: THEME_STORAGE_KEY,
          newValue: "dark",
        }),
      );
    });

    expect(result.current.preference).toBe("dark");
    expect(isDark()).toBe(true);
  });

  test("storage that refuses to be written still changes the theme for this visit", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    const { result } = renderHook(() => useTheme());

    act(() => result.current.choose("dark"));

    expect(isDark()).toBe(true);
    vi.restoreAllMocks();
  });
});
