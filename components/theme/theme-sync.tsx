"use client";

import { useTheme } from "@/lib/hooks/use-theme";

/**
 * Keeps the theme live on every page, including ones that never show a
 * switch (onboarding, not found): while it is mounted, a device that changes
 * between light and dark is followed, and so is a choice made in another tab.
 * It draws nothing.
 */
export function ThemeSync() {
  useTheme();
  return null;
}
