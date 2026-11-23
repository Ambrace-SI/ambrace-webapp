# Analytics (PostHog)

What the web app tells PostHog, what it never tells it, and where each rule
lives in the code. The voice engine's own measurements are described in
[voice-telemetry.md](voice-telemetry.md).

## Turning it on

Analytics are off unless the build has both a project key and an address.

| Setting                    | Value                                             |
| -------------------------- | ------------------------------------------------- |
| `NEXT_PUBLIC_POSTHOG_KEY`  | The PostHog project key. Must start with `phc_`.  |
| `NEXT_PUBLIC_POSTHOG_HOST` | Where events go, for example the US cloud address |
| `NEXT_PUBLIC_APP_VERSION`  | Optional. The pipeline sets it to the commit.     |

On a laptop these go in `.env.local`. In AWS they come from SSM; see
"Analytics (PostHog)" in [infra/README.md](../infra/README.md). Anything that
is not a key (an empty value, the placeholder a new environment starts with)
leaves analytics off.

## The code

| File                        | What it decides                                              |
| --------------------------- | ------------------------------------------------------------ |
| `lib/analytics/posthog.ts`  | When PostHog loads, how it is configured, how events queue.  |
| `lib/analytics/privacy.ts`  | What must not leave the browser: the mark, and the scrubber. |
| `lib/analytics/events.ts`   | The list of product events and what each carries.            |
| `lib/analytics/identity.ts` | Who a student is to PostHog.                                 |
| `lib/analytics/viva.ts`     | How one viva is followed from start to its one ending.       |
| `instrumentation-client.ts` | Starts loading analytics when the app starts.                |

Screens call `track(...)` from `events.ts`, and mark private content with
`PRIVATE_CLASS` from `privacy.ts`. Nothing else in the app imports PostHog.

## What PostHog holds

- **The person:** the Cognito account ID, name, email, class, board and school
  name. Set after sign-in, forgotten on this device at sign-out. Deleting the
  person in PostHog removes them.
- **Events:** the product events in `events.ts`, the engine's `voice_*`
  events, page views, clicks and errors. No event carries a name, email,
  school, transcript, audio, error message or credential; `cleanProperties`
  strips them even if a caller passes one. While a viva is on, every event
  carries its `viva_session_id`.
- **Screen recordings,** with private content hidden (below).

## What never leaves the browser

- **What a student says.** The captions and the examiner's written notes are
  marked private.
- **Who they are, on screen.** Name, email and school are marked private
  wherever they are shown.
- **Anything typed.** Every input is masked.
- **Credentials.** Sign-in codes, tokens and API keys are removed from every
  event, and recorded network requests keep their path only.
- **The console, request bodies and headers.** Not recorded.

### Marking private content

Add `PRIVATE_CLASS` to the outermost element that carries the content:

```tsx
<p className={cn("text-lg", PRIVATE_CLASS)}>{feedback.summary}</p>
```

The class is PostHog's own (`ph-no-capture`). Its recorder draws a blank block
for such an element, and its click capture ignores the element and everything
inside it. A button whose `aria-label` names the student needs the class on
the button itself, because attributes are captured too.

This is a list of what to hide, so a new screen that shows such content leaks
it until it is marked. Each screen's test checks it with
`privateContentLeaks` (`tests/helpers/private-content.ts`); add that check
when adding a screen that shows a name, an email, a school or anything said.

## Loading

PostHog's code, recorder included, is about 240 KB compressed. It is a
separate file fetched after the app has started, so no page waits for it.
Anything reported before it arrives is held (up to 500 calls) and sent in
order, stamped with the time it happened. No script is ever loaded from
PostHog itself.

## Known limits

- A viva lost with its tab (closed, or the device slept) has a
  `viva_started` and no ending.
- Recording runs beside the audio pipeline. It has not been measured on a
  low-end phone; if it costs audio quality, lower the recording sample rate in
  the PostHog project before changing code.
- The first test with a real key should confirm, in an actual recording, that
  marked content shows as blank blocks.
