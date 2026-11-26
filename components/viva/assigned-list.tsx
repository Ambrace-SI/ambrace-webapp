"use client";

import { useSearchParams } from "next/navigation";

import { AssignedRow } from "@/components/viva/assigned-row";
import { ASSIGNMENT_PARAM } from "@/lib/auth/routes";
import { usePendingAssigned } from "@/lib/groups/use-groups";
import type { StudentAssignment } from "@/types/assignments";

/** Enough to act on from home; the rest are a tap away in the corner. */
const SHOWN = 3;

/**
 * Set vivas on home, under the welcome: the first few, ready to start, and a
 * way to see every one in the corner window (`AssignedPanel`).
 *
 * A set viva is an invitation, not a gate: free practice stays where it was.
 */
export function AssignedList({
  starting,
  onStart,
  onShowAll,
}: {
  starting: boolean;
  onStart: (assignment: StudentAssignment) => void;
  /** Opens the corner window with every one in it. */
  onShowAll: () => void;
}) {
  const pending = usePendingAssigned();
  // Arriving from a group's page with `?assignment=` points that one out,
  // and it is always shown, even when it is not among the first.
  const wanted = useSearchParams().get(ASSIGNMENT_PARAM);
  const asked = pending.find((a) => a.assignment_id === wanted);
  const shown = pending.slice(0, SHOWN);
  if (asked && !shown.includes(asked)) shown[shown.length - 1] = asked;

  if (pending.length === 0) return null;

  const more = pending.length - shown.length;

  return (
    <section
      aria-labelledby="assigned-heading"
      className="flex w-full max-w-xl flex-col gap-3 text-left"
    >
      <h2 id="assigned-heading" className="label-mono text-muted-foreground">
        Viva for you
      </h2>
      <ul className="flex flex-col gap-2">
        {shown.map((assignment) => (
          <AssignedRow
            key={assignment.assignment_id}
            assignment={assignment}
            look="card"
            pointedOut={assignment === asked}
            starting={starting}
            onStart={() => onStart(assignment)}
          />
        ))}
      </ul>
      {more > 0 ? (
        <button
          type="button"
          onClick={onShowAll}
          className="min-h-11 self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {more} more: see all {pending.length}
        </button>
      ) : null}
    </section>
  );
}
