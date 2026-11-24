/**
 * Who the events belong to.
 *
 * A student is a person in PostHog: their account ID, and beside it their
 * name, email, class, board and school, so a chart or a recording can be read
 * as "this student" without a second lookup. These live on the person only.
 * No event carries them (see `cleanProperties` in `posthog.ts`), so deleting
 * the person in PostHog removes them everywhere.
 */

import type { Me } from "@/types/profile";

import { withPostHog } from "./posthog";

/**
 * What PostHog keeps about a student. `name` and `email` are the property
 * names PostHog itself shows a person by. The email comes from the sign-in
 * account, not the profile; until it is known it is left out rather than sent
 * empty, so it never erases one already stored.
 */
export function personProperties(me: Me, email: string | null) {
  const profile = me.profile;
  return {
    onboarding_complete: me.onboarding_complete,
    name: profile?.name.trim() || null,
    account_type: profile?.account_type ?? null,
    class_level: profile?.class_level ?? null,
    board: profile?.board ?? null,
    school_name: profile?.school_name ?? null,
    ...(email ? { email } : {}),
  };
}

/**
 * Where this browser keeps a note of what it last told PostHog about the
 * student. PostHog itself only remembers that for as long as a page is open,
 * so without the note every page load would say it all again: one more event
 * per visit, telling PostHog nothing new.
 *
 * The note is a fingerprint, not the details: enough to tell "the same as
 * last time" from "something changed", and nothing that names anyone.
 */
const LAST_SENT_KEY = "ambrace.analytics.person-sent";

/**
 * A short, stable fingerprint of some text (FNV-1a). It only has to notice a
 * change; it guards nothing, so it does not need to be cryptographic.
 */
export function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Storage can be switched off or full. Then the note is simply not kept. */
function lastSent(): string | null {
  try {
    return window.localStorage.getItem(LAST_SENT_KEY);
  } catch {
    return null;
  }
}

function noteSent(sent: string | null): void {
  try {
    if (sent === null) window.localStorage.removeItem(LAST_SENT_KEY);
    else window.localStorage.setItem(LAST_SENT_KEY, sent);
  } catch {
    // Without the note the details are sent again next time. Nothing is lost.
  }
}

/**
 * Ties this browser's events, including the ones from before sign-in, to the
 * student. Safe to call on every page load and every profile change: PostHog
 * is told only when it does not already know, that is on the first sign-in on
 * this browser and whenever a detail changes.
 *
 * If this browser still remembers a different student (their session ran out
 * rather than being signed out of), they are forgotten first. Otherwise two
 * students on a shared computer would share one visit and one recording.
 */
export function identifyStudent(me: Me, email: string | null): void {
  const properties = personProperties(me, email);
  const sending = fingerprint(JSON.stringify([me.user_id, properties]));

  withPostHog((client) => {
    const remembered =
      client.get_property("$user_state") === "identified"
        ? client.get_distinct_id()
        : null;
    if (remembered && remembered !== me.user_id) client.reset();
    // Both must agree: PostHog still knows this student, and what we would
    // say is what we said last. If PostHog's own memory was cleared, say it.
    if (remembered === me.user_id && lastSent() === sending) return;
    client.identify(me.user_id, properties);
    noteSent(sending);
  });
}

/**
 * Forgets the student on this device, so the next person to use the browser
 * does not inherit their identity.
 */
export function forgetStudent(): void {
  noteSent(null);
  withPostHog((client) => client.reset());
}
