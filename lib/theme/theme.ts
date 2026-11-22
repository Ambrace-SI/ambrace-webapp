/**
 * The theme rules: what a student can choose, and what it means on screen.
 *
 * Pure values and functions only, with no React and no stored state, so the
 * same rules run in the startup script (before React loads), in the shared
 * preference, and in tests.
 */

/** What a student can choose. "system" follows the device's own setting. */
export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/** What is actually drawn: Paper or Ink. */
export type ResolvedTheme = "light" | "dark";

/** Until a student chooses, the app follows their device. */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";

/** Where the choice is remembered on this device. Never sent to the server. */
export const THEME_STORAGE_KEY = "ambrace:theme";

/** The media query a device answers when it is set to dark. */
export const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

/** The class the stylesheet keys its Ink tokens on (see `.dark` in globals.css). */
export const DARK_CLASS = "dark";

export function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference);
}

/** A fixed choice wins; "system" defers to the device. */
export function resolveTheme(
  preference: ThemePreference,
  deviceIsDark: boolean,
): ResolvedTheme {
  if (preference === "system") return deviceIsDark ? "dark" : "light";
  return preference;
}

/**
 * Draws the page in a theme. `color-scheme` is set too, so the browser's own
 * parts (scrollbars, form controls, autofill) match the page.
 */
export function applyTheme(root: HTMLElement, theme: ResolvedTheme): void {
  root.classList.toggle(DARK_CLASS, theme === "dark");
  root.style.colorScheme = theme;
}
