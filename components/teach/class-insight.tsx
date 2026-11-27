"use client";

import {
  ArrowUpRightIcon,
  CheckIcon,
  RefreshCwIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { track } from "@/lib/analytics/events";
import { PRIVATE_CLASS } from "@/lib/analytics/privacy";
import { httpStatus } from "@/lib/api/errors";
import { teachReportPath } from "@/lib/auth/routes";
import {
  useClassInsight,
  useGenerateClassInsight,
} from "@/lib/groups/use-groups";
import { cn } from "@/lib/utils";
import type {
  ClassInsight as Insight,
  InsightStudent,
  InsightTheme,
} from "@/types/assignments";

const DATE = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

function students(count: number): string {
  return count === 1 ? "1 student" : `${count} students`;
}

/**
 * The AI-written summary of one set viva, for the teacher: what the class
 * understood, what it is missing, who to help first and what to teach next.
 * Written from the reports only. The server decides when there is enough to
 * write one and when it is out of date; this card only shows that.
 */
export function ClassInsight({
  groupId,
  assignmentId,
  finished,
}: {
  groupId: string;
  assignmentId: string;
  /** How many have finished, so a new result re-checks the insight. */
  finished: number;
}) {
  const { data, isError } = useClassInsight(groupId, assignmentId, finished);
  const generate = useGenerateClassInsight(groupId, assignmentId);

  if (isError) return null;
  if (!data) {
    return <Skeleton className="h-28 rounded-2xl" aria-hidden="true" />;
  }

  async function write() {
    const refreshed = data?.insight != null;
    try {
      const state = await generate.mutateAsync();
      track("class_insight_requested", {
        based_on: state.insight?.based_on ?? 0,
        refreshed,
      });
    } catch (error) {
      toast.error(
        httpStatus(error) === 409
          ? "Not enough students have finished yet."
          : "Couldn't write the class insight. Try again in a moment.",
      );
    }
  }

  const writing = generate.isPending;

  return (
    <section
      aria-label="Class insight"
      aria-busy={writing}
      className="glass-card flex flex-col gap-6 rounded-2xl p-5 sm:p-6"
    >
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="flex items-center gap-2 text-base font-medium">
            <SparklesIcon className="size-4" aria-hidden="true" />
            Class insight
          </h2>
          <p className="text-sm text-muted-foreground">
            {data.insight
              ? `From ${students(data.insight.based_on)}' reports · ${DATE.format(new Date(data.insight.generated_at))}`
              : "What the class understood, what it's missing, and what to teach next."}
          </p>
        </div>
        {data.insight && data.is_stale ? (
          <Button
            variant="glass"
            size="sm"
            disabled={writing}
            onClick={() => void write()}
          >
            <RefreshCwIcon
              aria-hidden="true"
              className={cn(writing && "animate-spin")}
            />
            Refresh
          </Button>
        ) : null}
      </header>

      {data.insight && data.is_stale && data.new_results > 0 ? (
        <p className="text-sm" role="status">
          {data.new_results === 1
            ? "1 more student has finished since this was written."
            : `${data.new_results} more students have finished since this was written.`}
        </p>
      ) : null}

      {writing && !data.insight ? (
        <div className="flex flex-col gap-3" role="status">
          <span className="text-sm text-muted-foreground">
            Reading {students(data.results_count)}&apos; reports. This takes a
            few seconds.
          </span>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : data.insight ? (
        <InsightBody
          insight={data.insight}
          groupId={groupId}
          assignmentId={assignmentId}
        />
      ) : data.status === "ready_to_generate" ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">
            {data.results_count} of {data.member_count} have finished. You can
            write it now, and refresh it as more finish.
          </p>
          <Button size="touch" onClick={() => void write()}>
            <SparklesIcon aria-hidden="true" />
            Get class insight
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ready once {data.min_results} students have finished.{" "}
          {data.results_count} so far.
        </p>
      )}
    </section>
  );
}

function InsightBody({
  insight,
  groupId,
  assignmentId,
}: {
  insight: Insight;
  groupId: string;
  assignmentId: string;
}) {
  return (
    <div className="flex flex-col gap-7">
      <p className={cn("text-lg", PRIVATE_CLASS)}>{insight.overview}</p>

      <Themes
        title="What the class understood"
        themes={insight.strengths}
        marker={<CheckIcon className="text-success" aria-hidden="true" />}
      />
      <Themes
        title="What the class is missing"
        themes={insight.gaps}
        marker={
          <ArrowUpRightIcon className="text-ember-text" aria-hidden="true" />
        }
      />

      {insight.students_to_support.length > 0 ? (
        <Block title="Who to help first">
          <ul className={cn("flex flex-col gap-1", PRIVATE_CLASS)}>
            {insight.students_to_support.map(({ student, reason }) => (
              <li key={student.student_id}>
                <Link
                  href={teachReportPath(
                    groupId,
                    assignmentId,
                    student.student_id,
                  )}
                  className="-mx-2 flex flex-col rounded-lg px-2 py-2 transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="font-medium">{student.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {reason}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {insight.suggestions.length > 0 ? (
        <Block title="Ideas for the next lesson">
          <ol className={cn("flex flex-col gap-3", PRIVATE_CLASS)}>
            {insight.suggestions.map((suggestion, index) => (
              <li key={index} className="flex gap-3">
                <span className="w-5 shrink-0 font-mono text-sm leading-[1.6] text-muted-foreground">
                  {index + 1}
                </span>
                <span className="flex flex-col">
                  <span>{suggestion.action}</span>
                  {suggestion.addresses ? (
                    <span className="text-sm text-muted-foreground">
                      For: {suggestion.addresses}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </Block>
      ) : null}

      <footer className="flex flex-col gap-1 border-t border-border pt-4 text-sm text-muted-foreground">
        <p className={PRIVATE_CLASS}>{insight.coverage_note}</p>
        <p>
          Written by AI from the reports only, never from what students said.
          Check a student&apos;s report before acting on it.
        </p>
      </footer>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="label-mono text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Themes({
  title,
  themes,
  marker,
}: {
  title: string;
  themes: InsightTheme[];
  marker: ReactNode;
}) {
  if (themes.length === 0) return null;
  return (
    <Block title={title}>
      <ul className={cn("flex flex-col gap-4", PRIVATE_CLASS)}>
        {themes.map((theme, index) => (
          <li key={index} className="flex gap-3">
            <span className="flex h-[1.6em] w-5 shrink-0 items-start justify-center pt-1 [&_svg]:size-4">
              {marker}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <span>{theme.point}</span>
              {theme.misconception ? (
                <span className="text-sm text-muted-foreground">
                  Typical mix-up: {theme.misconception}
                </span>
              ) : null}
              <Who students={theme.students} count={theme.student_count} />
            </div>
          </li>
        ))}
      </ul>
    </Block>
  );
}

/** The count first; the names one tap away, so the list stays scannable. */
function Who({
  students: list,
  count,
}: {
  students: InsightStudent[];
  count: number;
}) {
  return (
    <details className="group text-sm">
      <summary className="w-fit cursor-pointer list-none rounded-md font-mono text-xs text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        {students(count)}
      </summary>
      <p className="pt-1">{list.map((s) => s.name).join(", ")}</p>
    </details>
  );
}
