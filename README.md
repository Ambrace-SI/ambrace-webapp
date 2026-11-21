# Ambrace web app

The student-facing app: sign in, practise a viva out loud with an AI examiner,
and read the report. Nothing is public; every page sits behind sign-in.

## Stack

Next.js 16.4 (App Router), React 19.3, TypeScript, Tailwind CSS v4, shadcn/ui
(Radix base). The backend is `ambrace-backend`.

The app is a static site: `npm run build` writes plain files to `out/`, which
are stored in S3 and served by CloudFront. There is no Next.js server in dev or
prod, so nothing here may rely on one (no Proxy, no route handlers, no page per
record). Hosting and deployment are described in `infra/README.md`.

## Run locally

```
cp .env.example .env.local
npm install
npm run dev
```

To see the site exactly as it will be served, build it and serve the files:

```
npm run build
npm run preview
```

See "Checks" below for the commands CI runs.

## The voice engine is frozen

These files come from the Veenoe prototype and carry the proven audio,
WebSocket and transcript logic. They were copied unchanged and then formatted
with Prettier, which changes layout only, never behaviour. Do not rename or
"tidy" them; change them only for a voice bug, with a test.

`tests/frozen-engine.test.ts` compares each engine file with a recorded
checksum, so an accidental edit fails CI. After an intended, tested voice change
run `npm run engine:freeze` and commit the new record.

- `public/audio-*.js` (the four AudioWorklet files; they must stay at the site root)
- `lib/gemini/`, `lib/hooks/viva/`, `lib/hooks/useSessionTimer.ts`
- `lib/store/viva-store.ts`, `lib/telemetry/`, `lib/analytics/posthog.ts`
- `lib/api/`, `lib/curriculum/`, `types/viva.ts`, `data/curriculum/`

`lib/hooks/useVivaSession.ts` differs from Veenoe in two ways: the access token
comes from `getAuthToken` instead of Clerk, and two lines carry a lint
suppression where the React refs rule reports a false positive (the reason is
written next to each one).

## Checks

| Command                 | What it does                                         |
| ----------------------- | ---------------------------------------------------- |
| `npm run format:check`  | Prettier. Nothing hand-written is excluded.          |
| `npm run lint`          | ESLint with the Next.js rules. No files are skipped. |
| `npm run typecheck`     | TypeScript in strict mode.                           |
| `npm test`              | Vitest. `npm run test:watch` reruns on save.         |
| `npm run test:coverage` | Tests plus coverage; fails below the thresholds.     |
| `npm run build`         | Builds the static site into `out/`.                  |

CI runs all five on every pull request (`.github/workflows/checks.yml`).

Tests live in `tests/`, named after what they cover. Coverage is measured
across `app/`, `components/` and `lib/`, and CI fails if it falls
below 90% of statements, lines and functions or 80% of branches. Raise those
numbers as coverage grows; do not lower them to get a change through.

Tests run in Node by default, because the voice-engine tests build their own
browser stand-ins. A component test opts in to a browser by starting with
`// @vitest-environment jsdom`.

The browser talks to Gemini Live directly with a short-lived token minted by
the backend. No Gemini API key ever reaches this app.

## Brand

Colour and type tokens live in `app/globals.css`; logo files are in
`public/brand/`. Three rules matter most:

- **Ember (`#FF6B4A`) stands for the student.** Use it for the one action on a
  screen that moves the student forward, and nowhere else. Text on Ember is Ink,
  never white.
- **Paper (light) is for reading, Ink (dark) is for presence.** Reports,
  history and forms are light; sign-in and the live viva are dark.
- **No gradients, no glows.** Flat colour and space.

Use the logo files as they are; never type "Ambrace" in Sora as a logo.
