/**
 * Whether the "New group" window is open. It can be opened from the side
 * panel or from the page, and is drawn once by the teacher's frame, so the
 * two share this small store rather than each keeping their own copy.
 */

let open = false;
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((listener) => listener());

export const newGroupDialog = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  isOpen: () => open,
  open() {
    open = true;
    tell();
  },
  close() {
    open = false;
    tell();
  },
};
