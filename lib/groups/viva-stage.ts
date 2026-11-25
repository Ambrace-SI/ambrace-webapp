import type { Assignment } from "@/types/assignments";

/**
 * Where a set viva stands for its teacher or parent.
 *
 * - Completed: it had a due day, that day has passed, and everyone in the
 *   group has done it. Nothing is left to act on.
 * - Ongoing: everything else, including vivas with no due day, since those
 *   stay open for anyone who joins later.
 */
export type VivaStage = "ongoing" | "completed";

/** Today as YYYY-MM-DD on the viewer's own calendar, to compare with a due day. */
export function localDay(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The due day has passed: due yesterday or earlier. */
export function isPastDue(assignment: Assignment, today = localDay()): boolean {
  return assignment.due_on !== null && assignment.due_on < today;
}

export function everyoneDone(assignment: Assignment, members: number): boolean {
  return members > 0 && assignment.completed_count >= members;
}

export function vivaStage(
  assignment: Assignment,
  members: number,
  today = localDay(),
): VivaStage {
  return isPastDue(assignment, today) && everyoneDone(assignment, members)
    ? "completed"
    : "ongoing";
}

/** Past its due day with someone still to do it: the one thing worth chasing. */
export function isOverdue(
  assignment: Assignment,
  members: number,
  today = localDay(),
): boolean {
  return isPastDue(assignment, today) && !everyoneDone(assignment, members);
}
