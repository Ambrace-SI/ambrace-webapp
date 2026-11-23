// Runs in the browser before the app starts, which is where Next.js asks for
// analytics to be set up: the first page view and an error on the very first
// screen are then seen too. Does nothing when no PostHog key is configured.
import { initPostHog } from "@/lib/analytics/posthog";

initPostHog();
