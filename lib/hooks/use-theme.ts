"use client";

import { useSyncExternalStore } from "react";

import type { ThemePreference } from "@/lib/theme/theme";
import { themePreference } from "@/lib/theme/theme-preference";

/**
 * The student's theme: what they chose, what is drawn, and a way to change
 * it. Every screen that reads it agrees, and updates when it changes.
 */
export function useTheme() {
  const { preference, resolved } = useSyncExternalStore(
    themePreference.subscribe,
    themePreference.current,
    themePreference.serverSnapshot,
  );

  return {
    /** What the student chose: light, dark or system (their device). */
    preference,
    /** What is on screen now. */
    resolved,
    choose: (next: ThemePreference) => themePreference.choose(next),
  };
}
