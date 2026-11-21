import { describe, expect, test } from "vitest";

import {
  describeViva,
  formatVivaDate,
  searchVivas,
} from "@/lib/history/describe";
import type { VivaSessionSummary } from "@/types/viva";

const NOW = new Date("2026-11-21T12:00:00Z");

function viva(changes: Partial<VivaSessionSummary> = {}): VivaSessionSummary {
  return {
    viva_session_id: "session-1",
    title: "Electricity",
    topic: "Electricity",
    class_level: "10",
    started_at: "2026-11-21T10:00:00Z",
    session_type: "viva",
    status: "completed",
    ...changes,
  };
}

describe("when a viva happened", () => {
  test("this year's vivas show the day and month only", () => {
    expect(formatVivaDate("2026-03-05T10:00:00Z", NOW)).toBe("5 Mar");
  });

  test("an older viva also shows its year", () => {
    expect(formatVivaDate("2025-03-05T10:00:00Z", NOW)).toBe("5 Mar 2025");
  });

  test("a date that cannot be read is left out, not shown as nonsense", () => {
    expect(formatVivaDate("not a date", NOW)).toBe("");
  });
});

describe("one row of the list", () => {
  test("a finished viva shows its date and score, and has a report", () => {
    expect(describeViva(viva({ score: 7 }), NOW)).toEqual({
      id: "session-1",
      title: "Electricity",
      detail: "21 Nov · 7/10",
      hasReport: true,
    });
  });

  test("a score of zero is still a score", () => {
    expect(describeViva(viva({ score: 0 }), NOW).detail).toBe("21 Nov · 0/10");
  });

  test("with no score known, the date stands alone with no stray separator", () => {
    expect(describeViva(viva(), NOW).detail).toBe("21 Nov");
    expect(describeViva(viva({ score: null }), NOW).detail).toBe("21 Nov");
  });

  test("a viva that ended early says so and has no report to open", () => {
    const row = describeViva(viva({ status: "abandoned", score: null }), NOW);

    expect(row.detail).toBe("21 Nov · Ended early");
    expect(row.hasReport).toBe(false);
  });

  test("a viva still running says so and has no report yet", () => {
    const row = describeViva(viva({ status: "in_progress" }), NOW);

    expect(row.detail).toBe("21 Nov · In progress");
    expect(row.hasReport).toBe(false);
  });

  test("the name it was given wins; the chapter is the fallback", () => {
    expect(describeViva(viva({ title: "Revision 2" }), NOW).title).toBe(
      "Revision 2",
    );
    expect(describeViva(viva({ title: "  " }), NOW).title).toBe("Electricity");
    expect(describeViva(viva({ title: "", topic: "" }), NOW).title).toBe(
      "Untitled viva",
    );
  });
});

describe("searching", () => {
  const vivas = [
    viva({ viva_session_id: "a", title: "Electricity" }),
    viva({
      viva_session_id: "b",
      title: "Revision",
      topic: "Metals and Non-metals",
    }),
    viva({
      viva_session_id: "c",
      title: "Nationalism in India",
      topic: "Nationalism in India",
      subject_name: "History",
    }),
  ];
  const found = (typed: string) =>
    searchVivas(vivas, typed).map((match) => match.viva_session_id);

  test("matches the name, ignoring capitals and stray spaces", () => {
    expect(found("  ELECTR ")).toEqual(["a"]);
  });

  test("matches the chapter even after a rename", () => {
    expect(found("metal")).toEqual(["b"]);
  });

  test("matches the subject", () => {
    expect(found("history")).toEqual(["c"]);
  });

  test("nothing typed finds nothing, not everything", () => {
    expect(found("   ")).toEqual([]);
  });

  test("no match is an empty list", () => {
    expect(found("geometry")).toEqual([]);
  });
});
