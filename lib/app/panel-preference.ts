/**
 * Whether the student keeps the side panel open or folded, remembered on this
 * device. It is a preference, not data, so it lives in the browser and is
 * never sent to the server.
 */
const KEY = "ambrace:side-panel";
const listeners = new Set<() => void>();

/** Read from storage once, then kept here so every reader agrees. */
let open: boolean | null = null;

export const panelPreference = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Open unless the student folded it. */
  isOpen(): boolean {
    if (open === null) {
      try {
        open = window.localStorage.getItem(KEY) !== "folded";
      } catch {
        // Private browsing can refuse storage. Start open.
        open = true;
      }
    }
    return open;
  },

  remember(next: boolean): void {
    open = next;
    try {
      window.localStorage.setItem(KEY, next ? "open" : "folded");
    } catch {
      // The panel still folds for this visit; it is only not remembered.
    }
    listeners.forEach((listener) => listener());
  },
};
