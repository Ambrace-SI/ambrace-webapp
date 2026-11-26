"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StudentAssignment } from "@/types/assignments";

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
 * One viva a teacher or parent set: what it is, who set it, when it is due,
 * and a Start button. Shared by home's list and the corner window.
 */
export function AssignedRow({
  assignment,
  look,
  pointedOut = false,
  starting,
  onStart,
}: {
  assignment: StudentAssignment;
  /** A card of its own on home; a plain row inside the corner window. */
  look: "card" | "plain";
  pointedOut?: boolean;
  starting: boolean;
  onStart: () => void;
}) {
  return (
    <li
      // The one the address asked for is brought into view when it appears.
      ref={
        pointedOut
          ? (row) =>
              row?.scrollIntoView({ block: "center", behavior: "smooth" })
          : undefined
      }
      aria-current={pointedOut || undefined}
      className={cn(
        "flex items-center justify-between gap-4 rounded-2xl",
        look === "card"
          ? "glass-card px-4 py-3"
          : "border border-transparent px-3 py-2.5 transition-colors hover:bg-foreground/6 dark:hover:bg-foreground/10",
        pointedOut && "border-foreground",
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
        onClick={onStart}
      >
        Start
      </Button>
    </li>
  );
}
