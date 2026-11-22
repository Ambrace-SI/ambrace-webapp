"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowRightIcon, Loader2Icon, MicIcon, MicOffIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { LiveCaptions } from "@/components/viva/live-captions";
import { SessionClock } from "@/components/viva/session-clock";
import { VoiceOrb } from "@/components/viva/voice-orb";
import { Button } from "@/components/ui/button";
import { reportPath } from "@/lib/auth/routes";
import { HISTORY_KEY } from "@/lib/hooks/use-history";
import { useMicrophoneUnheard } from "@/lib/hooks/use-microphone-unheard";
import type { useVivaSession } from "@/lib/hooks/useVivaSession";
import { MOMENT_LABELS, liveMoment } from "@/lib/viva/live-state";
import { logVoiceSummary } from "@/lib/viva/voice-summary";
import { cn } from "@/lib/utils";

export type VivaScope = { subject: string; chapter: string };

/**
 * The viva itself.
 *
 * The screen is almost empty on purpose: this is a conversation, and the
 * student should be listening and speaking, not reading. It follows the
 * student's theme like every other screen, so a light choice stays light. The side panel
 * is put away, so there is no way to wander off by accident. Two controls
 * only: mute, and finish. Everything else on screen answers one question:
 * whose turn is it?
 */
export function LiveSession({
  session,
  scope,
  onChooseAgain,
}: {
  session: ReturnType<typeof useVivaSession>;
  scope: VivaScope;
  onChooseAgain: () => void;
}) {
  const queryClient = useQueryClient();
  const moment = liveMoment(session);
  const { sessionId, conclusionData, requestConclusion } = session;
  const unheard = useMicrophoneUnheard(moment === "listening");
  // Ending can take a moment to be acknowledged. The press itself never may.
  const [ending, setEnding] = useState(false);

  // A finished viva belongs in the history list straight away.
  useEffect(() => {
    if (moment === "completed")
      void queryClient.invalidateQueries({ queryKey: HISTORY_KEY });
  }, [moment, queryClient]);

  const ended = moment === "completed" || moment === "error";
  const over = ended || moment === "leaving";
  const canSpeak = !over && moment !== "concluding";

  useEffect(() => {
    if (over) logVoiceSummary("viva over");
  }, [over]);
  useEffect(() => {
    if (unheard) logVoiceSummary("microphone unheard");
  }, [unheard]);

  async function end() {
    setEnding(true);
    try {
      await requestConclusion();
    } finally {
      setEnding(false);
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-6 pt-5 sm:px-10">
        <p className="label-mono min-w-0 truncate text-muted-foreground">
          {scope.subject} · {scope.chapter}
        </p>
        {ended ? null : <SessionClock onTimeLimit={requestConclusion} />}
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-6 sm:px-10">
        {moment === "completed" ? (
          <Finished
            score={conclusionData?.score}
            total={conclusionData?.total ?? 10}
            summary={conclusionData?.feedback}
            sessionId={sessionId}
            onBackHome={onChooseAgain}
          />
        ) : moment === "error" ? (
          <Stopped message={session.error} onChooseAgain={onChooseAgain} />
        ) : (
          <>
            <div className="flex shrink-0 flex-col items-center gap-4">
              <VoiceOrb moment={moment} className="w-36 sm:w-44" />
              <p
                role="status"
                aria-live="polite"
                className="label-mono text-muted-foreground"
              >
                {MOMENT_LABELS[moment]}
              </p>
              {unheard ? (
                <p
                  role="status"
                  className="max-w-sm text-center text-sm text-pretty text-muted-foreground"
                >
                  I can&apos;t hear anything. If you&apos;re speaking, check
                  that your microphone isn&apos;t muted or set to another
                  device.
                </p>
              ) : null}
              {session.connectionNotice ? (
                <p role="status" className="text-sm text-muted-foreground">
                  {session.connectionNotice}
                </p>
              ) : null}
              {session.error ? (
                <p role="alert" className="text-sm text-destructive">
                  {session.error}
                </p>
              ) : null}
            </div>
            <div className="flex min-h-0 flex-1 flex-col justify-end">
              <LiveCaptions transcripts={session.transcripts} />
            </div>
          </>
        )}
      </main>

      {ended ? null : (
        <footer className="mx-auto flex w-full max-w-2xl items-center gap-3 px-6 pb-6 sm:px-10">
          <Button
            type="button"
            variant="outline"
            size="icon-touch"
            className={cn(
              "size-12 shrink-0 rounded-full",
              session.isMuted && "border-ember text-ember-text",
            )}
            aria-pressed={session.isMuted}
            aria-label={
              session.isMuted ? "Unmute microphone" : "Mute microphone"
            }
            disabled={!canSpeak || moment === "connecting"}
            onClick={session.toggleMute}
          >
            {session.isMuted ? (
              <MicOffIcon className="size-5" aria-hidden="true" />
            ) : (
              <MicIcon className="size-5" aria-hidden="true" />
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="touch"
            className="h-12 flex-1"
            disabled={!canSpeak || ending}
            aria-busy={moment === "concluding" || ending}
            onClick={() => void end()}
          >
            {moment === "concluding" ? (
              <>
                <Loader2Icon className="animate-spin" aria-hidden="true" />
                Preparing your report
              </>
            ) : ending ? (
              <>
                <Loader2Icon className="animate-spin" aria-hidden="true" />
                One moment
              </>
            ) : moment === "connecting" ? (
              "Cancel"
            ) : (
              "Finish and get my report"
            )}
          </Button>
        </footer>
      )}
    </div>
  );
}

/**
 * The ending stays on the same calm screen: the score, then the way on. Home
 * is this same page, so going back is a step rather than a link.
 */
function Finished({
  score,
  total,
  summary,
  sessionId,
  onBackHome,
}: {
  score: number | undefined;
  total: number;
  summary: string | undefined;
  sessionId: string | null;
  onBackHome: () => void;
}) {
  return (
    <section className="animate-rise flex flex-1 flex-col justify-center gap-8">
      <div className="flex flex-col gap-3">
        <p className="label-mono text-muted-foreground">Viva finished</p>
        {score === undefined ? (
          <h1 className="text-3xl font-light tracking-tight">
            Your report is ready.
          </h1>
        ) : (
          <h1 className="font-heading text-7xl font-light tracking-tight">
            {score}
            <span className="text-2xl text-muted-foreground"> / {total}</span>
          </h1>
        )}
        {summary ? (
          <p className="text-lg text-muted-foreground">{summary}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        {sessionId ? (
          <Button asChild variant="ember" size="touch">
            <Link href={reportPath(sessionId)}>
              See the full report
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
        <Button type="button" variant="ghost" size="touch" onClick={onBackHome}>
          Back to home
        </Button>
      </div>
    </section>
  );
}

/**
 * Something broke. Say what, and offer the way back in. Starting again and
 * going home are the same place now, so there is one way on.
 */
function Stopped({
  message,
  onChooseAgain,
}: {
  message: string | null;
  onChooseAgain: () => void;
}) {
  return (
    <section
      role="alert"
      className="animate-rise flex flex-1 flex-col justify-center gap-8"
    >
      <div className="flex flex-col gap-3">
        <p className="label-mono text-muted-foreground">Viva stopped</p>
        <h1 className="text-3xl font-light tracking-tight">
          This viva couldn&apos;t continue.
        </h1>
        <p className="text-lg text-muted-foreground">
          {message ?? "Something went wrong on the line."} Nothing has been
          marked against you.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" size="touch" onClick={onChooseAgain}>
          Start again
        </Button>
      </div>
    </section>
  );
}
