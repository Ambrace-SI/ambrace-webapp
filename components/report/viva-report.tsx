"use client";

import { ArrowLeftIcon, ArrowUpRightIcon, CheckIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { httpStatus } from "@/lib/api/errors";
import { HOME_PATH, REPORT_ID_PARAM } from "@/lib/auth/routes";
import { useVivaResult } from "@/lib/hooks/use-viva-result";

const DATE = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * The report: where a student reads how it went.
 *
 * It is Paper, the reading surface. The order follows what a student wants to
 * know: how did I do, what was good, what do I fix, what do I do next. The
 * score is a large quiet numeral, not a badge or a ring. Strengths get a tick
 * and things to work on get an arrow pointing up, so the two lists differ by
 * shape as well as by colour, and neither reads as a punishment.
 */
export function VivaReport() {
  const id = useSearchParams().get(REPORT_ID_PARAM) ?? "";
  const { data: session, error, isPending, refetch } = useVivaResult(id);

  if (isPending) return <ReportOutline />;

  if (error) {
    // 422 is an address that could never be a viva; retrying cannot help.
    const missing = [404, 403, 422].includes(httpStatus(error) ?? 0);
    return (
      <Notice
        title={
          missing ? "We can't find that report" : "We couldn't load this report"
        }
        body={
          missing
            ? "It may have been removed, or it belongs to a different account."
            : "Check your connection and try again."
        }
        action={
          missing ? null : (
            <Button size="touch" onClick={() => void refetch()}>
              Try again
            </Button>
          )
        }
      />
    );
  }

  const feedback = session.feedback;
  if (!feedback) {
    return (
      <Notice
        title="There's no report for this viva"
        body="It ended before your examiner could write one. Start another whenever you're ready."
        action={<StartAnother />}
      />
    );
  }

  return (
    <main className="animate-rise mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-6 py-10 sm:px-10 sm:py-14">
      <div className="flex flex-col gap-4">
        <HomeLink />
        <p className="label-mono text-muted-foreground">
          Class {session.class_level} ·{" "}
          {DATE.format(new Date(session.started_at))}
        </p>
        <h1 className="text-2xl tracking-tight sm:text-3xl">{session.topic}</h1>
      </div>

      <section aria-label="Score" className="flex flex-col gap-4">
        <p className="font-heading text-7xl leading-none font-light tracking-tight sm:text-8xl">
          {feedback.score}
          <span className="text-2xl text-muted-foreground sm:text-3xl">
            {" "}
            / 10
          </span>
        </p>
        <p className="text-lg">{feedback.summary}</p>
        {feedback.coverage_note ? (
          <p className="text-sm text-muted-foreground">
            {feedback.coverage_note}
          </p>
        ) : null}
      </section>

      <Points
        title="What went well"
        points={feedback.strong_points}
        empty="Nothing was singled out this time."
        marker={<CheckIcon className="text-success" aria-hidden="true" />}
      />
      <Points
        title="What to work on"
        points={feedback.areas_of_improvement}
        empty="Nothing was singled out this time."
        marker={
          <ArrowUpRightIcon className="text-ember-text" aria-hidden="true" />
        }
      />
      {feedback.next_steps?.length ? (
        <Points
          title="Practise next"
          points={feedback.next_steps}
          empty=""
          marker={
            <span
              className="mt-2.5 size-1.5 rounded-full bg-foreground"
              aria-hidden="true"
            />
          }
        />
      ) : null}

      <div className="flex flex-col gap-3 border-t border-border pt-8 sm:flex-row">
        <StartAnother />
      </div>
    </main>
  );
}

function Points({
  title,
  points,
  empty,
  marker,
}: {
  title: string;
  points: string[];
  empty: string;
  marker: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="label-mono text-muted-foreground">{title}</h2>
      {points.length === 0 ? (
        <p className="text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {points.map((point, index) => (
            <li key={index} className="flex gap-3">
              <span className="flex h-[1.6em] w-5 shrink-0 items-start justify-center pt-1 [&_svg]:size-4">
                {marker}
              </span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StartAnother() {
  return (
    <Button asChild variant="ember" size="touch">
      <Link href={HOME_PATH}>Start another viva</Link>
    </Button>
  );
}

function HomeLink() {
  return (
    <Button
      asChild
      variant="ghost"
      size="touch"
      className="-ml-3 self-start px-3"
    >
      <Link href={HOME_PATH}>
        <ArrowLeftIcon aria-hidden="true" />
        Home
      </Link>
    </Button>
  );
}

function Notice({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: ReactNode;
}) {
  return (
    <main className="animate-rise mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10 sm:px-10 sm:py-14">
      <HomeLink />
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl tracking-tight sm:text-3xl">{title}</h1>
        <p className="text-muted-foreground">{body}</p>
      </div>
      {action ? <div className="flex">{action}</div> : null}
    </main>
  );
}

/** The report's shape while it loads, so nothing jumps when it arrives. */
export function ReportOutline() {
  return (
    <main
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-6 py-10 sm:px-10 sm:py-14"
      aria-busy="true"
    >
      <p className="sr-only" role="status">
        Loading your report
      </p>
      <div className="flex flex-col gap-4">
        <div className="h-4 w-36 animate-pulse rounded bg-muted" />
        <div className="h-8 w-80 max-w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="h-20 w-40 animate-pulse rounded bg-muted" />
      <div className="h-40 animate-pulse rounded-xl border border-border bg-card" />
    </main>
  );
}
