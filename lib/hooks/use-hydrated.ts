"use client";

import { useSyncExternalStore } from "react";

const never = () => () => {};

/**
 * False while React is still taking over a page the server sent, true from
 * then on (and true at once for a page built in the browser).
 *
 * The server sends pages before it knows anything about the student. While
 * React takes that page over it must draw exactly what the server drew, or it
 * throws the page away and builds it again. Anything the server could not
 * have known is therefore held back until this turns true.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    never,
    () => true,
    () => false,
  );
}
