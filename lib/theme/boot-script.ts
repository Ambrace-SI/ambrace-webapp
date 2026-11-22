import {
  DARK_CLASS,
  DARK_SCHEME_QUERY,
  THEME_STORAGE_KEY,
} from "@/lib/theme/theme";

/**
 * Applies the remembered theme before the page is first drawn.
 *
 * The site is plain files, so the server cannot know a student's choice.
 * Without this, a student who chose dark would see a flash of Paper on every
 * load until React started. It runs as an inline script at the top of
 * `<head>`, which the content security policy allows ('unsafe-inline').
 *
 * It must stand alone: it is turned into text, so it can use nothing from
 * outside its own body. Its arguments are the shared constants, which keeps
 * it agreeing with `resolveTheme` and `applyTheme` in `theme.ts`.
 */
function applyRememberedTheme(
  storageKey: string,
  darkQuery: string,
  darkClass: string,
): void {
  try {
    const choice = window.localStorage.getItem(storageKey);
    const dark =
      choice === "dark" ||
      (choice !== "light" && window.matchMedia(darkQuery).matches);
    const root = document.documentElement;
    root.classList.toggle(darkClass, dark);
    root.style.colorScheme = dark ? "dark" : "light";
  } catch {
    // Storage can be refused (private browsing). The page then starts in
    // Paper, and the theme is applied once the app loads.
  }
}

/** The script's text, ready to inline. */
export const THEME_BOOT_SCRIPT = `(${applyRememberedTheme.toString()})(${[
  THEME_STORAGE_KEY,
  DARK_SCHEME_QUERY,
  DARK_CLASS,
]
  .map((value) => JSON.stringify(value))
  .join(",")});`;
