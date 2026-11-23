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
    class_level: profile?.class_level ?? null,
    board: profile?.board ?? null,
    school_name: profile?.school_name ?? null,
    ...(email ? { email } : {}),
  };
}

/**
 * Ties this browser's events, including the ones from before sign-in, to the
 * student. Safe to call on every profile change: PostHog only sends what is new.
 *
 * If this browser still remembers a different student (their session ran out
 * rather than being signed out of), they are forgotten first. Otherwise two
 * students on a shared computer would share one visit and one recording.
 */
export function identifyStudent(me: Me, email: string | null): void {
  withPostHog((client) => {
    const remembered =
      client.get_property("$user_state") === "identified"
        ? client.get_distinct_id()
        : null;
    if (remembered && remembered !== me.user_id) client.reset();
    client.identify(me.user_id, personProperties(me, email));
  });
}

/**
 * Forgets the student on this device, so the next person to use the browser
 * does not inherit their identity.
 */
export function forgetStudent(): void {
  withPostHog((client) => client.reset());
}
