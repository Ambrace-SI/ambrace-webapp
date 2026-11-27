/**
 * Every product event the app sends, and what each one carries.
 *
 * This is the list to read before building a chart: if a question cannot be
 * answered from these, the event is added here first. Screens call `track`
 * and nothing else, so a name is spelled one way everywhere.
 *
 * Page views, clicks, errors and screen recordings are captured by PostHog
 * itself (see `lib/analytics/posthog.ts`); the voice engine's own `voice_*`
 * measurements are listed there too. These are the moments only the app can
 * name. Every event also carries `app_version`, the build that sent it.
 *
 * Never a name, an email, a school or anything a student said: who the
 * student is lives on their PostHog person (`identity.ts`), not on events.
 */

import type { AccountType, EducatorType } from "@/types/profile";

import { captureEvent, readAnalyticsSettings } from "./posthog";

export type SignInMethod = "google" | "password";

export type ProductEvents = {
  /** An account was created with an email; the code has not been entered yet. */
  account_created: { method: "password" };
  /** The emailed code was accepted. */
  email_confirmed: Record<string, never>;
  /** The student left for Google from the sign-in or the sign-up screen. */
  google_sign_in_started: { from: "sign_in" | "sign_up" };
  signed_in: { method: SignInMethod };
  /** `reason` is the sign-in service's error name, never its message. */
  sign_in_failed: { method: SignInMethod; reason: string };
  signed_out: Record<string, never>;

  /** The required part of the profile was saved for the first time. */
  onboarding_completed: {
    account_type: AccountType;
    /** A student's class; null for teachers and parents. */
    class_level: number | null;
  };
  /** The optional part was saved too, rather than skipped. */
  onboarding_extras_saved: { board: string | null; has_school: boolean };

  /** "Start" was pressed. Nothing has been created yet. */
  viva_requested: VivaChoiceProperties;
  /** The server refused, or could not be reached. `status` is the HTTP status. */
  viva_start_failed: VivaChoiceProperties & { status: number | null };
  /** The room opened: the viva exists and the microphone is being asked for. */
  viva_started: VivaChoiceProperties & VivaSessionProperties;
  /**
   * The examiner concluded. `score` and `total` are missing only when the viva
   * completed and no score ever arrived.
   */
  viva_finished: VivaSessionProperties & {
    score: number | null;
    total: number | null;
    duration_seconds: number;
    turns: number;
  };
  /** The viva broke and could not continue. */
  viva_stopped: VivaSessionProperties & {
    duration_seconds: number;
    turns: number;
  };
  /** The student left the room while the viva was still running. */
  viva_abandoned: VivaSessionProperties & {
    stage: string;
    duration_seconds: number;
    turns: number;
  };
  /**
   * Nothing was heard from the microphone while it was the student's turn.
   * Once per viva, however often it recurs.
   */
  microphone_unheard: VivaSessionProperties;

  /** A report was opened and had something to show. */
  report_viewed: VivaSessionProperties & {
    score: number;
    class_level: string;
    strong_points: number;
    areas_to_improve: number;
  };
  /** A report was opened for a viva that ended before one was written. */
  report_empty: VivaSessionProperties;

  /**
   * The student answered one of the two questions at the end of a report.
   * `about` says which: the viva itself, or what the examiner wrote about it.
   * `score` is the viva's, so a rating can be read beside how it went.
   */
  viva_feedback_given: VivaSessionProperties & {
    about: FeedbackSubject;
    rating: FeedbackRating;
    score: number;
  };
  /** The student closed the questions; `at` is the one they were on. */
  viva_feedback_dismissed: VivaSessionProperties & { at: FeedbackSubject };

  /** A teacher or parent created a group. Never its name or its code. */
  group_created: { class_level: number | null };
  /** The owner replaced the code; the old link stopped working. */
  group_code_replaced: Record<string, never>;
  /** The owner copied or shared the invite. */
  group_invite_shared: { via: "copy_link" | "copy_code" | "whatsapp" };
  group_member_removed: Record<string, never>;
  /** The owner set a viva for a group. Never the group's name. */
  assignment_created: {
    class_level: number;
    subject_id: string;
    chapter_id: string;
    topic_count: number;
    has_due_date: boolean;
  };
  assignment_removed: { completed: number };
  /** The owner opened one viva's results. Counts only, never names or scores. */
  assignment_results_viewed: { completed: number; students: number };
  /** The owner opened a student's report. */
  student_report_viewed: Record<string, never>;
  /** The owner asked for the AI class insight. Counts only, never its text. */
  class_insight_requested: { based_on: number; refreshed: boolean };
  /** The owner deleted a group; `members` is how many were in it. */
  group_deleted: { members: number };
  /** A student opened an invite link; `found` is false for a dead code. */
  group_invite_opened: { found: boolean };
  /** A student joined: they agreed to share results with the group's owner. */
  group_joined: { owner_type: EducatorType };
};

/** What a feedback question is about: the viva, or the report written on it. */
export type FeedbackSubject = "session" | "report";

export type FeedbackRating = "bad" | "fine" | "good";

export type VivaSessionProperties = { viva_session_id: string };

/**
 * What a viva is about. The IDs are what charts should group by: a subject or
 * chapter can be renamed, and its ID stays. The names are there to be read.
 */
export type VivaChoiceProperties = {
  class_level: number;
  subject_id: string;
  subject: string;
  chapter_id: string;
  chapter: string;
  /** How many topics were picked; 0 means the whole chapter. */
  topic_count: number;
  voice: string;
};

export type ProductEventName = keyof ProductEvents;

/**
 * Whether events go anywhere. For the rare screen that asks the student for
 * something only analytics would receive: with analytics off, it must not ask.
 */
export function analyticsOn(): boolean {
  return readAnalyticsSettings() !== null;
}

/** Sends one product event. Does nothing when analytics are off. */
export function track<Name extends ProductEventName>(
  name: Name,
  ...[properties]: ProductEvents[Name] extends Record<string, never>
    ? []
    : [properties: ProductEvents[Name]]
): void {
  captureEvent(name, properties ?? {});
}
