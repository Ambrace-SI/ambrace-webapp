import { notFound } from "next/navigation";

/**
 * Next checks in development that every page can show something the instant a
 * link to it is pressed. This one has nothing of its own to show and nothing
 * links to it, so there is nothing to check.
 */
export const instant = false;

/**
 * Every address that no other page claims.
 *
 * Without this, a wrong address is answered from outside the app frame and
 * the side panel is gone. Claiming it here, and then saying it does not
 * exist, shows that message inside the frame instead.
 */
export default function UnknownAddress() {
  notFound();
}
