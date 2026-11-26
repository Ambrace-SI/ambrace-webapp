"use client";

import { EllipsisIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { BackLink } from "@/components/app/back-link";
import { PageNotice } from "@/components/app/page-notice";
import { ReportBody } from "@/components/report/viva-report";
import { Progress, VivaMeta } from "@/components/teach/group-page";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { track } from "@/lib/analytics/events";
import { PRIVATE_CLASS } from "@/lib/analytics/privacy";
import { httpStatus } from "@/lib/api/errors";
import {
  GROUP_ID_PARAM,
  STUDENT_PARAM,
  TEACH_PATH,
  VIVA_PARAM,
  teachGroupPath,
  teachReportPath,
  teachVivaPath,
} from "@/lib/auth/routes";
import {
  useAssignmentResults,
  useDeleteAssignment,
  useGroup,
  useStudentReport,
} from "@/lib/groups/use-groups";
import { isOverdue, vivaStage } from "@/lib/groups/viva-stage";
import { cn } from "@/lib/utils";
import type { StudentResultRow } from "@/types/assignments";

const DAY = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
});
const DATE = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Below this, out of 10, a score is marked out: someone to follow up with. */
const LOW_SCORE = 5;

function Outline({ label }: { label: string }) {
  return (
    <main
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10 sm:px-10 sm:py-14"
      role="status"
      aria-label={label}
    >
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-40 rounded-xl" />
    </main>
  );
}

/** Gone, someone else's, or an address that could never be one: retrying won't help. */
function isMissing(error: unknown): boolean {
  return [403, 404, 422].includes(httpStatus(error) ?? 0);
}

function LoadFailed({
  label,
  missingTitle,
  missing,
  back,
  retry,
  retrying,
}: {
  label: string;
  missingTitle: string;
  missing: boolean;
  back: string;
  retry: () => void;
  retrying: boolean;
}) {
  return (
    <PageNotice
      label={label}
      title={missing ? missingTitle : "We can't load this right now"}
      body={
        missing
          ? "It may have been removed, or it belongs to a different account."
          : "Check your connection and try again."
      }
    >
      {missing ? (
        <Button asChild size="touch">
          <Link href={back}>Go back</Link>
        </Button>
      ) : (
        <Button size="touch" onClick={retry} disabled={retrying}>
          Try again
        </Button>
      )}
    </PageNotice>
  );
}

/**
 * One set viva: how far along it is, the class average, who has done it
 * and how they scored, and who has not yet. Each finished row opens that
 * student's report. Low scores are the one thing marked out: they are who
 * to follow up with.
 */
export function VivaResults() {
  const params = useSearchParams();
  const router = useRouter();
  const groupId = params.get(GROUP_ID_PARAM);
  const assignmentId = params.get(VIVA_PARAM);
  const { data, error, refetch, isRefetching } = useAssignmentResults(
    groupId,
    assignmentId,
  );
  const { data: group } = useGroup(groupId);
  const remove = useDeleteAssignment(groupId ?? "");
  const [removing, setRemoving] = useState(false);
  const groupHref = groupId ? teachGroupPath(groupId) : TEACH_PATH;

  const counted = useRef(false);
  useEffect(() => {
    if (!data || counted.current) return;
    counted.current = true;
    track("assignment_results_viewed", {
      completed: data.assignment.completed_count,
      students: data.students.length,
    });
  }, [data]);

  const ids = groupId && assignmentId;
  if (!ids || error) {
    return (
      <LoadFailed
        label="Viva"
        missingTitle="We can't find that viva"
        missing={!ids || isMissing(error)}
        back={groupHref}
        retry={() => void refetch()}
        retrying={isRefetching}
      />
    );
  }
  if (!data) return <Outline label="Loading the results" />;

  const { assignment } = data;
  const members = data.students.filter((s) => s.in_group).length;
  const done = data.students.filter((s) => s.status === "done");
  const waiting = data.students.filter((s) => s.status !== "done");
  const doneInGroup = done.filter((s) => s.in_group).length;
  // Judged on the people listed here, so the stage always matches the counts.
  const progress = { ...assignment, completed_count: doneInGroup };
  const stage = vivaStage(progress, members);

  async function confirmRemove() {
    try {
      await remove.mutateAsync(assignment.assignment_id);
      track("assignment_removed", { completed: assignment.completed_count });
      toast.success("Viva removed");
      router.replace(groupHref);
    } catch {
      toast.error("Couldn't remove the viva. Try again.");
      setRemoving(false);
    }
  }

  return (
    <main className="animate-rise mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10 sm:px-10 sm:py-14">
      <header className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <BackLink href={groupHref}>
            {group?.name ?? "Back to the group"}
          </BackLink>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="glass"
                size="icon-touch"
                aria-label="Viva options"
              >
                <EllipsisIcon aria-hidden="true" strokeWidth={2.5} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setRemoving(true)}
              >
                <Trash2Icon aria-hidden="true" />
                Remove viva
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="label-mono text-muted-foreground">
            {stage === "completed" ? "Completed" : "Ongoing"}
          </p>
          <h1 className="text-3xl font-light tracking-tight sm:text-4xl">
            {assignment.title}
          </h1>
          <VivaMeta
            assignment={assignment}
            overdue={isOverdue(progress, members)}
            className="whitespace-normal"
          />
        </div>
      </header>

      {/* One number leads, as on a student's own report; the rest is a line. */}
      <section aria-label="Summary" className="flex flex-col gap-5">
        <p className="flex items-baseline gap-3">
          {data.average_score === null ? (
            <span className="text-2xl font-light text-muted-foreground">
              No scores yet
            </span>
          ) : (
            <>
              <span className="font-heading text-6xl leading-none font-light tracking-tight sm:text-7xl">
                {data.average_score}
              </span>
              <span className="text-lg text-muted-foreground">
                / 10 average
              </span>
            </>
          )}
        </p>
        {members > 0 ? (
          <div className="flex max-w-md items-center gap-4">
            <Progress done={doneInGroup} of={members} />
            <span className="text-sm whitespace-nowrap">
              {doneInGroup} of {members} completed
            </span>
          </div>
        ) : null}
      </section>

      {data.students.length === 0 ? (
        <p className="text-muted-foreground">
          No one is in this group yet. Results appear here as they finish.
        </p>
      ) : (
        <>
          <StudentList title="Completed" count={done.length}>
            {done.length === 0 ? (
              <li className="px-3.5 py-4 text-sm text-muted-foreground">
                Each report appears here as soon as a viva ends. Only the report
                is shared, never what was said.
              </li>
            ) : (
              done.map((student) => (
                <DoneRow
                  key={student.student_id}
                  groupId={groupId}
                  assignmentId={assignmentId}
                  student={student}
                />
              ))
            )}
          </StudentList>
          {waiting.length > 0 ? (
            <StudentList title="Not started" count={waiting.length}>
              {waiting.map((student) => (
                <li
                  key={student.student_id}
                  className={cn(
                    "flex min-h-12 items-center px-3.5 py-3",
                    PRIVATE_CLASS,
                  )}
                >
                  {student.name}
                </li>
              ))}
            </StudentList>
          ) : null}
        </>
      )}

      <Dialog open={removing} onOpenChange={setRemoving}>
        <DialogContent>
          <DialogTitle className="text-lg font-medium">
            Remove {assignment.title}?
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            It disappears for everyone in the group, along with the reports
            already sent for it. This can&apos;t be undone.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRemoving(false)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => void confirmRemove()}
            >
              Remove viva
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function StudentList({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        {title}
        <span className="font-mono text-xs text-muted-foreground">{count}</span>
      </h2>
      <ul className="flex flex-col gap-0.5 glass-card rounded-2xl p-1.5">
        {children}
      </ul>
    </section>
  );
}

function DoneRow({
  groupId,
  assignmentId,
  student,
}: {
  groupId: string;
  assignmentId: string;
  student: StudentResultRow;
}) {
  const score = student.score ?? 0;
  const details = [
    student.completed_at
      ? `Done ${DAY.format(new Date(student.completed_at))}`
      : null,
    student.in_group ? null : "Left the group",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      <Link
        href={teachReportPath(groupId, assignmentId, student.student_id)}
        aria-label={`${student.name}'s report, ${score} out of 10`}
        className="flex min-h-14 items-center justify-between gap-4 rounded-lg px-3.5 py-3 transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className={cn("flex min-w-0 flex-col", PRIVATE_CLASS)}>
          <span className="truncate font-medium">{student.name}</span>
          <span className="text-sm text-muted-foreground">{details}</span>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "font-mono text-base whitespace-nowrap",
              score < LOW_SCORE && "text-ember-text",
            )}
          >
            {score}
            <span className="text-muted-foreground">/10</span>
          </span>
        </span>
      </Link>
    </li>
  );
}

/**
 * A student's report for the teacher or parent who set the viva: exactly
 * what the student was told, and nothing they said.
 */
export function StudentResultReport() {
  const params = useSearchParams();
  const groupId = params.get(GROUP_ID_PARAM);
  const assignmentId = params.get(VIVA_PARAM);
  const studentId = params.get(STUDENT_PARAM);
  const { data, error, refetch, isRefetching } = useStudentReport(
    groupId,
    assignmentId,
    studentId,
  );
  const back =
    groupId && assignmentId
      ? teachVivaPath(groupId, assignmentId)
      : groupId
        ? teachGroupPath(groupId)
        : TEACH_PATH;

  const counted = useRef(false);
  useEffect(() => {
    if (!data || counted.current) return;
    counted.current = true;
    track("student_report_viewed");
  }, [data]);

  const ids = groupId && assignmentId && studentId;
  if (!ids || error) {
    return (
      <LoadFailed
        label="Report"
        missingTitle="We can't find that report"
        missing={!ids || isMissing(error)}
        back={back}
        retry={() => void refetch()}
        retrying={isRefetching}
      />
    );
  }
  if (!data) return <Outline label="Loading the report" />;

  const firstName = data.student_name.trim().split(/\s+/)[0];

  return (
    <main className="animate-rise mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-6 py-10 sm:px-10 sm:py-14">
      <header className="flex flex-col gap-4">
        <BackLink href={back}>{data.title} results</BackLink>
        <p className={cn("label-mono text-muted-foreground", PRIVATE_CLASS)}>
          {[
            data.student_name,
            `Class ${data.curriculum_selection.class_level}`,
            DATE.format(new Date(data.completed_at)),
            data.in_group ? null : "Left the group",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <h1 className="text-2xl tracking-tight sm:text-3xl">{data.title}</h1>
      </header>

      <ReportBody feedback={data.feedback} />

      <p className="border-t border-border pt-6 text-sm text-muted-foreground">
        This is the report {firstName} was given. What they said in the viva
        stays private to them.
      </p>
    </main>
  );
}
