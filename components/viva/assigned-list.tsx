"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { ASSIGNMENT_PARAM, STUDENT_GROUPS_PATH } from "@/lib/auth/routes";
import { useAssigned } from "@/lib/groups/use-groups";
import { cn } from "@/lib/utils";
import type { StudentAssignment } from "@/types/assignments";

/** Enough to act on from home; the rest are a tap away in Your groups. */
const SHOWN = 3;

const DUE = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** A due day (YYYY-MM-DD) read as the student's own calendar day. */
function dueText(dueOn: string | null): string | null {
  if (!dueOn) return null;
  const [year, month, day] = dueOn.split("-").map(Number);
  return `Due ${DUE.format(new Date(year, month - 1, day))}`;
}

/**
 * Vivas a teacher or parent set and the student has not done yet, on home,
 * where vivas begin. Free practice stays below it, unchanged: a set viva is
 * an invitation, not a gate.
 *
 * Arriving from a group's page with `?assignment=` points that one out.
 */
export function AssignedList({
  starting,
  onStart,
}: {
  starting: boolean;
  onStart: (assignment: StudentAssignment) => void;
}) {
  const { data } = useAssigned();
  const wanted = useSearchParams().get(ASSIGNMENT_PARAM);
  const pointedOut = useRef<HTMLLIElement>(null);

  const pending = (data ?? []).filter((a) => a.status === "pending");
  // The one asked for is always shown, even when it is not among the first.
  const asked = pending.find((a) => a.assignment_id === wanted);
  const shown = pending.slice(0, SHOWN);
  if (asked && !shown.includes(asked)) shown[shown.length - 1] = asked;

  useEffect(() => {
    pointedOut.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [asked?.assignment_id]);

  if (pending.length === 0) return null;

  return (
    <section
      aria-labelledby="assigned-heading"
      className="flex w-full max-w-xl flex-col gap-3 text-left"
    >
      <h2 id="assigned-heading" className="label-mono text-muted-foreground">
        Set for you
      </h2>
      <ul className="flex flex-col gap-2">
        {shown.map((assignment) => {
          const isAsked = assignment === asked;
          return (
            <li
              key={assignment.assignment_id}
              ref={isAsked ? pointedOut : undefined}
              className={cn(
                "flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3",
                isAsked && "border-foreground",
              )}
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{assignment.title}</span>
                <span className="truncate text-sm text-muted-foreground">
                  {[
                    assignment.subject_name,
                    assignment.owner_name,
                    dueText(assignment.due_on),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <Button
                type="button"
                size="touch"
                className="shrink-0"
                disabled={starting}
                aria-label={`Start ${assignment.title}, set by ${assignment.owner_name}`}
                onClick={() => onStart(assignment)}
              >
                Start
              </Button>
            </li>
          );
        })}
      </ul>
      {pending.length > shown.length ? (
        <Link
          href={STUDENT_GROUPS_PATH}
          className="self-start text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {pending.length - shown.length} more in Your groups
        </Link>
      ) : null}
    </section>
  );
}
