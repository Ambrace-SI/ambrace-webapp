import type { VivaSessionSummary } from "@/types/viva";

/** What one row of the history list says. */
export type VivaRow = {
  id: string;
  title: string;
  /** The small line under the title: when, and whether it was cut short. */
  detail: string;
  /** Only a finished viva has a report to open. */
  hasReport: boolean;
  /** What to tell a student who presses a viva that has no report. */
  whyNoReport: string | null;
};

const SAME_YEAR = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
});
const OTHER_YEAR = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "21 Nov" this year, "21 Nov 2025" for anything older. */
export function formatVivaDate(startedAt: string, now = new Date()): string {
  const date = new Date(startedAt);
  if (Number.isNaN(date.getTime())) return "";
  const format =
    date.getFullYear() === now.getFullYear() ? SAME_YEAR : OTHER_YEAR;
  return format.format(date);
}

/**
 * Only said when there is no report to open. A finished viva shows no score
 * here: a number beside each chapter turns the list into a ranking, and a
 * score is not a verdict. It belongs in the report, next to what went well
 * and what to work on.
 */
function outcome(viva: VivaSessionSummary): string | null {
  if (viva.status === "abandoned") return "Ended early";
  if (viva.status === "in_progress") return "In progress";
  return null;
}

const WHY_NO_REPORT: Record<string, string> = {
  abandoned: "This viva ended early, so there's no report for it.",
  in_progress: "This viva is still in progress. Its report comes at the end.",
};

export function describeViva(
  viva: VivaSessionSummary,
  now = new Date(),
): VivaRow {
  return {
    id: viva.viva_session_id,
    title: viva.title.trim() || viva.topic.trim() || "Untitled viva",
    detail: [formatVivaDate(viva.started_at, now), outcome(viva)]
      .filter(Boolean)
      .join(" · "),
    hasReport: viva.status === "completed",
    whyNoReport: WHY_NO_REPORT[viva.status] ?? null,
  };
}

/** The vivas whose name or chapter contains what was typed. */
export function searchVivas(
  vivas: readonly VivaSessionSummary[],
  typed: string,
): VivaSessionSummary[] {
  const wanted = typed.trim().toLowerCase();
  if (!wanted) return [];
  return vivas.filter((viva) =>
    [viva.title, viva.topic].some((text) =>
      text.toLowerCase().includes(wanted),
    ),
  );
}
