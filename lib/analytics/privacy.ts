/**
 * What must never leave the browser, and how it is kept there.
 *
 * Two rules, both applied before anything is sent:
 * 1. A part of the screen that shows what a student said, or who they are, is
 *    marked with `PRIVATE_CLASS`. Recordings draw a blank block in its place,
 *    and a click on it is not captured.
 * 2. Credentials are removed from every event (`scrubSecrets`).
 *
 * This file knows nothing about how analytics is sent, so a screen can mark
 * its content without depending on the analytics vendor's code.
 */

/**
 * Put this class on any element that shows what a student said, or who they
 * are: the captions, the examiner's notes, a name, an email, a school.
 *
 * The name is PostHog's own, not ours to choose: its screen recorder blocks
 * elements with this class, and its click capture ignores them and everything
 * inside them. An attribute of our own would only be honoured by one of the
 * two. Put it on the outermost element that carries the content, including a
 * button whose label names the student: attributes are captured too.
 *
 * Typed input needs no mark; every input is masked.
 */
export const PRIVATE_CLASS = "ph-no-capture";

const SECRET_PATTERNS: readonly [RegExp, string][] = [
  // Sign-in codes and tokens carried in an address.
  [
    /([?&#](?:code|state|access_token|id_token|refresh_token|token|key)=)[^&#\s"']*/gi,
    "$1[REDACTED]",
  ],
  // Gemini's short-lived session tokens and API keys.
  [/auth_tokens\/[a-zA-Z0-9_\-.]+/gi, "[REDACTED_TOKEN]"],
  [/AIza[a-zA-Z0-9_\-]+/g, "[REDACTED_KEY]"],
];

/** How deep an event is searched. Events are shallow; this only stops a loop. */
const MAX_DEPTH = 8;

/** Removes credentials from every piece of text in a value, however nested. */
export function scrubSecrets<T>(value: T, depth = 0): T {
  if (typeof value === "string") {
    let text: string = value;
    for (const [pattern, replacement] of SECRET_PATTERNS)
      text = text.replace(pattern, replacement);
    return text as T;
  }
  if (value === null || typeof value !== "object" || depth > MAX_DEPTH)
    return value;
  if (Array.isArray(value))
    return value.map((item) => scrubSecrets(item, depth + 1)) as T;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      scrubSecrets(item, depth + 1),
    ]),
  ) as T;
}

/** An address without its query: enough to see what was called, and no more. */
export function withoutQuery(address: string): string {
  const cut = address.search(/[?#]/);
  return cut === -1 ? address : address.slice(0, cut);
}
