"use client";

import { createContext, useContext, useLayoutEffect } from "react";

/**
 * How a page asks the frame around it for the whole screen.
 *
 * The side panel is on every signed-in page, with one exception: a viva being
 * spoken. There, one press on an old report would end the exam with the
 * microphone still open. The viva shares its address with the screen that sets
 * it up, so the frame cannot tell from the address; the page has to say so.
 *
 * Outside the frame there is no panel to put away, and asking does nothing.
 */
export const WholeScreenContext = createContext<(wanted: boolean) => void>(
  () => {},
);

/**
 * Takes the whole screen while `wanted` is true and hands it back afterwards,
 * including when the page is left. It runs before the browser paints, so the
 * panel is never seen beside a page that asked for it to go.
 */
export function useWholeScreen(wanted: boolean) {
  const ask = useContext(WholeScreenContext);

  useLayoutEffect(() => {
    if (!wanted) return;
    ask(true);
    return () => ask(false);
  }, [wanted, ask]);
}
