import {
  DARK_SCHEME_QUERY,
  DEFAULT_THEME_PREFERENCE,
  THEME_STORAGE_KEY,
  applyTheme,
  isThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme/theme";

/**
 * The student's theme choice, shared by every screen on this device.
 *
 * It is a preference, not data, so it lives in the browser and is never sent
 * to the server (the same as the side panel's open or folded state). It is a
 * small external store, read through `useTheme`: every reader agrees, and the
 * page is redrawn the moment the choice changes, here, on the device (while
 * "system" is chosen), or in another tab.
 */

type Snapshot = { preference: ThemePreference; resolved: ResolvedTheme };

const listeners = new Set<() => void>();

/** Read once, then kept, so every reader sees the same object. */
let snapshot: Snapshot | null = null;

/** Undoes the device and other-tab listeners once nobody is reading. */
let stopWatching: (() => void) | null = null;

function deviceIsDark(): boolean {
  return window.matchMedia?.(DARK_SCHEME_QUERY).matches ?? false;
}

function readStoredPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : DEFAULT_THEME_PREFERENCE;
  } catch {
    // Private browsing can refuse storage: follow the device.
    return DEFAULT_THEME_PREFERENCE;
  }
}

/** Works out what to draw for a choice, and draws it. */
function settle(preference: ThemePreference): Snapshot {
  const resolved = resolveTheme(preference, deviceIsDark());
  snapshot = { preference, resolved };
  applyTheme(document.documentElement, resolved);
  return snapshot;
}

/** Settles a changed choice and tells every reader. */
function update(preference: ThemePreference): void {
  settle(preference);
  listeners.forEach((listener) => listener());
}

/** Follows the device (for "system") and choices made in other tabs. */
function watch(): () => void {
  const media = window.matchMedia?.(DARK_SCHEME_QUERY);
  const onDeviceChange = () => {
    if (current().preference === "system") update("system");
  };
  const onOtherTab = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) update(readStoredPreference());
  };

  media?.addEventListener("change", onDeviceChange);
  window.addEventListener("storage", onOtherTab);
  return () => {
    media?.removeEventListener("change", onDeviceChange);
    window.removeEventListener("storage", onOtherTab);
  };
}

/**
 * The choice as it stands. The first read happens while React renders, so it
 * settles quietly: nobody can hold an older value yet, and readers must not
 * be told of changes from inside a render.
 */
function current(): Snapshot {
  return snapshot ?? settle(readStoredPreference());
}

/** What the server renders: it cannot know the choice, so it assumes Paper. */
const SERVER_SNAPSHOT: Snapshot = {
  preference: DEFAULT_THEME_PREFERENCE,
  resolved: "light",
};

export const themePreference = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    stopWatching ??= watch();
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        stopWatching?.();
        stopWatching = null;
      }
    };
  },

  current,

  serverSnapshot(): Snapshot {
    return SERVER_SNAPSHOT;
  },

  /** Applies a choice now and remembers it on this device. */
  choose(preference: ThemePreference): void {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // The theme still changes for this visit; it is only not remembered.
    }
    update(preference);
  },

  /** Forgets what was read, so the next reader starts afresh. For tests. */
  reset(): void {
    snapshot = null;
  },
};
