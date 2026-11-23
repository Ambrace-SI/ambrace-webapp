/**
 * The one place that talks to PostHog.
 *
 * 1. Off unless a project key and an address are configured, and never
 *    during a server render.
 * 2. PostHog's code is fetched after the app has started, as a file of our
 *    own, so no page waits for it. Anything reported before it arrives is
 *    held and sent, in order, with the time it actually happened.
 * 3. Nothing is downloaded from PostHog: the recorder ships inside that file,
 *    so the content security policy allows no third-party script.
 * 4. What may be sent is decided in `privacy.ts` and `cleanProperties`.
 * 5. A failure here is swallowed. Analytics must never interrupt a viva.
 */

import { scrubSecrets, withoutQuery } from "./privacy";

/**
 * The "full, no external" build carries the session recorder and the rest of
 * PostHog's optional code inside it, and cannot load scripts from anywhere.
 */
const loadVendor = () => import("posthog-js/dist/module.full.no-external");

export type PostHogClient = Awaited<ReturnType<typeof loadVendor>>["default"];
type PostHogOptions = NonNullable<Parameters<PostHogClient["init"]>[1]>;

export type AnalyticsSettings = {
  apiKey: string;
  apiHost: string;
  /** The commit the site was built from, when the build was told. */
  appVersion: string | null;
};

/** Every PostHog project key starts this way. Anything else is not a key. */
const PROJECT_KEY_PREFIX = "phc_";

/**
 * The settings analytics runs on, or null when it is off.
 *
 * Both values must be real. A new environment holds a placeholder where the
 * key will go, and a placeholder is not a key; with no address there is
 * nowhere the content security policy would let events go.
 */
export function readAnalyticsSettings(
  env: Record<string, string | undefined> = {
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
  },
): AnalyticsSettings | null {
  const apiKey = env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ?? "";
  const apiHost = env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ?? "";
  if (!apiKey.startsWith(PROJECT_KEY_PREFIX)) return null;
  if (!apiHost.startsWith("https://")) return null;
  return {
    apiKey,
    apiHost,
    appVersion: env.NEXT_PUBLIC_APP_VERSION?.trim() || null,
  };
}

/** Everything PostHog is told to do. Kept apart from loading so it can be read and tested. */
export function buildPostHogOptions(apiHost: string): PostHogOptions {
  return {
    api_host: apiHost,
    // A dated snapshot of PostHog's defaults, so an upgrade changes nothing
    // here until this date is moved on purpose.
    defaults: "2026-01-30",
    // A profile exists only for someone who signed in. Visitors on the
    // sign-in pages stay anonymous until they do.
    person_profiles: "identified_only",
    // No cookies: the student is remembered in this browser's own storage.
    persistence: "localStorage",
    // The app changes page without reloading; follow the address bar.
    capture_pageview: "history_change",
    capture_pageleave: true,
    autocapture: true,
    capture_exceptions: true,
    // Addresses can carry sign-in codes; error text can carry token addresses.
    before_send: (event) => (event ? scrubSecrets(event) : event),
    disable_session_recording: false,
    // The console can repeat what was said in a viva. It is not recorded.
    enable_recording_console_log: false,
    session_recording: {
      // Whatever is typed is masked. Whatever is marked `PRIVATE_CLASS` is
      // blocked by the recorder's own default; nothing here turns that off.
      maskAllInputs: true,
      maskInputOptions: { password: true },
      recordHeaders: false,
      recordBody: false,
      // The live connection's address carries its token. Keep the path only.
      maskCapturedNetworkRequestFn: (request) => ({
        ...request,
        name: withoutQuery(request.name),
      }),
    },
  };
}

type Action = (client: PostHogClient) => void;

/** How much is held while PostHog's code is on its way. A viva's first seconds fit many times over. */
const MAX_WAITING = 500;

let client: PostHogClient | null = null;
let loading: Promise<PostHogClient | null> | null = null;
let waiting: Action[] = [];

function run(action: Action, ready: PostHogClient): void {
  try {
    action(ready);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[PostHog] Call failed:", err);
    }
  }
}

async function start(
  settings: AnalyticsSettings,
): Promise<PostHogClient | null> {
  try {
    const { default: posthog } = await loadVendor();
    posthog.init(settings.apiKey, buildPostHogOptions(settings.apiHost));
    // Every event says which build sent it, so a change in the numbers can be
    // matched to a release.
    if (settings.appVersion)
      posthog.register({ app_version: settings.appVersion });
    client = posthog;
    const held = waiting;
    waiting = [];
    for (const action of held) run(action, posthog);
    return posthog;
  } catch (err) {
    // Blocked, offline, or refused: analytics stay off for this visit.
    waiting = [];
    console.warn("[PostHog] Failed to start:", err);
    return null;
  }
}

/**
 * Starts PostHog, once. Resolves when it is ready, or with null when
 * analytics are off or could not start. Nothing needs to wait for this.
 */
export function loadPostHog(): Promise<PostHogClient | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (loading) return loading;
  const settings = readAnalyticsSettings();
  if (!settings) return Promise.resolve(null);
  loading = start(settings);
  return loading;
}

/**
 * Begins loading analytics. Returns at once with whether analytics are on,
 * so the caller never waits on a download.
 */
export function initPostHog(): boolean {
  if (typeof window === "undefined") return false;
  if (!readAnalyticsSettings()) return false;
  void loadPostHog();
  return true;
}

/**
 * Runs something against PostHog: now if it is ready, otherwise as soon as it
 * is, in the order asked. Does nothing when analytics are off. Every call
 * from the app goes through here.
 */
export function withPostHog(action: Action): void {
  if (client) return run(action, client);
  if (!initPostHog()) return;
  if (waiting.length < MAX_WAITING) waiting.push(action);
}

export type VoiceEventName =
  | "voice_startup"
  | "voice_session_started"
  | "voice_connection_ready"
  | "voice_turn_completed"
  | "voice_interruption"
  | "voice_playback_clear_acknowledged"
  | "voice_connection_error"
  | "voice_live_recovery"
  | "voice_session_ended"
  | "voice_diagnostics_ping";

export interface VoiceEventProperties {
  telemetry_session_id: string;
  turn_number?: number | null;
  model_name?: string | null;
  vad_profile?: string | null;

  // Connection
  connection_setup_ms?: number | null;
  outcome?: "started" | "restored" | "failed";
  reason?: "go_away" | "transport";
  elapsed_ms?: number;

  // Startup: SDK acceptance is not a network-delivery acknowledgment.
  startup_stage?: "kickoff" | "first_audio" | "first_playback";
  kickoff_send_accepted?: boolean | null;
  session_init_to_first_gemini_audio_ms?: number | null;
  session_init_to_first_playback_ms?: number | null;

  // Turn Latency
  speech_end_to_first_gemini_audio_ms?: number | null; // null without client VAD
  last_input_packet_to_first_gemini_audio_ms?: number | null; // Transport turnaround
  first_gemini_audio_to_playback_ms?: number | null;
  speech_end_to_first_playback_ms?: number | null;

  // Interruption
  clear_request_to_acknowledgment_ms?: number | null;

  // Audio Input Transport Aggregates
  input_packet_count?: number | null;
  input_packets_dropped?: number | null;
  input_bytes?: number | null;
  average_packet_bytes?: number | null;
  average_packet_interval_ms?: number | null;
  packets_per_second?: number | null;
  estimated_packet_duration_ms?: number | null;

  // Gemini Output
  output_audio_chunk_count?: number | null;

  // Playback
  max_playback_queue_ms?: number | null;
  playback_underrun_count?: number | null;
  scheduled_playback_gap_count?: number | null;

  // Reliability
  disconnect_count?: number | null;
  connection_error_count?: number | null;
  connection_retry_count?: number | null;

  interrupted?: boolean | null;
  error_type?: string | null;
  error_category?: string | null;
  [key: string]: unknown;
}

export interface SanitizedError {
  error_type: string;
  error_category: string;
  safe_message: string;
}

/**
 * Sanitizes errors by stripping URLs, query params, tokens, and API keys.
 * Ensures sensitive credentials are never stored or dispatched.
 */
export function sanitizeErrorMessage(error: unknown): SanitizedError {
  if (!error) {
    return {
      error_type: "UnknownError",
      error_category: "unknown",
      safe_message: "An unknown error occurred",
    };
  }

  const rawMsg = error instanceof Error ? error.message : String(error);
  const errorType = error instanceof Error ? error.name : "Error";

  // Categorize error
  let category = "general";
  const lower = rawMsg.toLowerCase();
  if (
    lower.includes("websocket") ||
    lower.includes("ws") ||
    lower.includes("network") ||
    lower.includes("connection")
  ) {
    category = "gemini_connection";
  } else if (
    lower.includes("audio") ||
    lower.includes("worklet") ||
    lower.includes("microphone") ||
    lower.includes("media")
  ) {
    category = "audio_pipeline";
  } else if (
    lower.includes("auth") ||
    lower.includes("token") ||
    lower.includes("credential")
  ) {
    category = "authentication";
  }

  // Redact any tokens, URLs, query parameters, API keys, or long hashes
  const safeMsg = rawMsg
    .replace(/auth_tokens\/[a-zA-Z0-9_\-\.]+/gi, "[REDACTED_TOKEN]")
    .replace(/AIza[a-zA-Z0-9_\-]+/gi, "[REDACTED_KEY]")
    .replace(/wss?:\/\/[^\s]+/gi, "[REDACTED_WS_URL]")
    .replace(/https?:\/\/[^\s]+/gi, "[REDACTED_HTTP_URL]")
    .replace(/key=[a-zA-Z0-9_\-]+/gi, "key=[REDACTED]")
    .replace(/token=[a-zA-Z0-9_\-]+/gi, "token=[REDACTED]")
    .slice(0, 150);

  return {
    error_type: errorType,
    error_category: category,
    safe_message: safeMsg,
  };
}

const FORBIDDEN_PROPERTY_KEYS = new Set([
  "user_id",
  "userid",
  "student_name",
  "studentname",
  "name",
  "email",
  "error_message",
  "safe_error_message",
  "raw_error",
  "message",
  "raw_audio",
  "audio",
  "transcript",
  "token",
  "key",
  "auth_token",
  "ephemeral_token",
]);

/**
 * Clean payload to strip undefined values and prevent any unintended PII or
 * audio data leakage. Who the student is travels as PostHog's own identity,
 * never as a property.
 */
function cleanProperties(
  properties: Record<string, unknown>,
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined || value === null) {
      continue;
    }
    // Strict privacy boundary: reject any PII, error text, tokens, or audio fields
    if (FORBIDDEN_PROPERTY_KEYS.has(key.toLowerCase())) {
      continue;
    }
    // Reject any accidental buffers or audio arrays
    if (
      value instanceof ArrayBuffer ||
      ArrayBuffer.isView(value) ||
      (typeof value === "string" && value.length > 500)
    ) {
      continue;
    }
    cleaned[key] = value;
  }

  return cleaned;
}

/** Sends one event, with anything private or oversized removed first. */
export function captureEvent(
  eventName: string,
  properties: Record<string, unknown> = {},
): void {
  const cleaned = cleanProperties(properties);
  // Stamped now, so an event held while PostHog loads keeps its real time.
  const timestamp = new Date();
  withPostHog((ready) => ready.capture(eventName, cleaned, { timestamp }));
}

/**
 * Capture a voice telemetry event safely in PostHog.
 * Never throws, gracefully no-ops when PostHog is unconfigured.
 */
export function captureVoiceEvent(
  eventName: VoiceEventName,
  properties: VoiceEventProperties,
): void {
  captureEvent(eventName, properties);
}
