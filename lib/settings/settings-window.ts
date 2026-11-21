import {
  DEFAULT_SETTINGS_SECTION,
  isSettingsSection,
  type SettingsSectionId,
} from "./sections";

/**
 * Whether the Settings window is open, and on which part.
 *
 * Settings is a window over whatever page the student is on, not a page of
 * its own, so opening it must not disturb that page. It is kept in the last
 * piece of the address (`#settings/profile`), which the browser changes
 * without loading anything. That gives three things a plain on/off switch
 * would not: the phone's Back button closes the window, reloading keeps it
 * open, and a link can open it on a chosen part.
 */

const HASH = "#settings";
/** Marks the history entry we added, so closing knows it can step back. */
const OPENED_HERE = "ambraceSettings";

const listeners = new Set<() => void>();
const tell = () => listeners.forEach((listener) => listener());

function openSection(): SettingsSectionId | null {
  const { hash } = window.location;
  if (hash !== HASH && !hash.startsWith(`${HASH}/`)) return null;
  const asked = hash.slice(HASH.length + 1);
  // An address someone mistyped still opens Settings, on its first part.
  return isSettingsSection(asked) ? asked : DEFAULT_SETTINGS_SECTION;
}

function openedHere(): boolean {
  const state: unknown = window.history.state;
  return (
    typeof state === "object" &&
    state !== null &&
    (state as Record<string, unknown>)[OPENED_HERE] === true
  );
}

export const settingsWindow = {
  /** For React: call `listener` whenever the window opens, closes or turns. */
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    // Back and Forward, and an address edited by hand.
    window.addEventListener("popstate", listener);
    window.addEventListener("hashchange", listener);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("popstate", listener);
      window.removeEventListener("hashchange", listener);
    };
  },

  /** The part that is open, or null when the window is closed. */
  section: openSection,

  /** On the server there is no address to read: the window is closed. */
  sectionOnServer: (): null => null,

  /**
   * Opens the window on a part, or turns an open window to it. Opening adds
   * one step to the browser's history; turning does not, so Back always
   * closes the window in one press however many parts were looked at.
   */
  open(section: SettingsSectionId = DEFAULT_SETTINGS_SECTION): void {
    const address = `${HASH}/${section}`;
    if (openSection() === null)
      window.history.pushState({ [OPENED_HERE]: true }, "", address);
    else
      window.history.replaceState({ [OPENED_HERE]: openedHere() }, "", address);
    tell();
  },

  /**
   * Closes the window. If opening it added a step to the history, that step
   * is taken back, so Back afterwards leaves the page as the student expects.
   * A window opened straight from a link has no such step; the address is
   * simply tidied.
   */
  close(): void {
    if (openSection() === null) return;
    if (openedHere()) {
      // The browser tells us when it is done (popstate).
      window.history.back();
      return;
    }
    const { pathname, search } = window.location;
    window.history.replaceState(null, "", `${pathname}${search}`);
    tell();
  },
};
