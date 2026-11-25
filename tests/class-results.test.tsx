// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  StudentResultReport,
  VivaResults,
} from "@/components/teach/viva-results";
import type { CurriculumSelection } from "@/lib/curriculum/types";
import {
  everyoneDone,
  isOverdue,
  isPastDue,
  localDay,
  vivaStage,
} from "@/lib/groups/viva-stage";
import type {
  Assignment,
  AssignmentResults,
  StudentReport,
} from "@/types/assignments";
import type { GroupDetail } from "@/types/groups";

/**
 * What a teacher or parent reads once vivas are done: one viva's results
 * and one student's report. Only the API, the address bar, analytics and
 * toasts are stand-ins.
 */
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const address = vi.hoisted(() => ({ search: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/teach/viva",
  useSearchParams: () => new URLSearchParams(address.search),
  useRouter: () => ({ push: vi.fn(), replace: address.replace }),
}));

const analytics = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@/lib/analytics/events", () => ({ track: analytics.track }));

const { toast } = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast }));

const groupsApi = vi.hoisted(() => ({
  getGroup: vi.fn(),
  listAssignments: vi.fn(),
  deleteAssignment: vi.fn(),
  getAssignmentResults: vi.fn(),
  getStudentReport: vi.fn(),
}));
vi.mock("@/lib/groups/api", () => groupsApi);

const MOTION: CurriculumSelection = {
  catalog_id: "ncert-cbse",
  catalog_version: "v1",
  class_level: 9,
  subject_id: "science",
  subject_name: "Science",
  chapters: [{ id: "motion", name: "Motion", topics: [] }],
};

const SET: Assignment = {
  assignment_id: "a1",
  title: "Motion",
  curriculum_selection: MOTION,
  due_on: null,
  created_at: "2026-11-24T10:00:00Z",
  // Riya; Zoya finished too but has since left.
  completed_count: 1,
  average_score: 6.5,
};

const GROUP: GroupDetail = {
  group_id: "g1",
  name: "Class 9-A",
  class_level: 9,
  member_count: 2,
  join_code: "K7QX2M",
  created_at: "2026-11-24T09:00:00Z",
  members: [],
};

const RESULTS: AssignmentResults = {
  assignment: SET,
  average_score: 6.5,
  students: [
    {
      student_id: "aman",
      name: "Aman Gupta",
      status: "not_started",
      in_group: true,
      score: null,
      completed_at: null,
    },
    {
      student_id: "riya",
      name: "Riya Verma",
      status: "done",
      in_group: true,
      score: 8,
      completed_at: "2026-11-24T11:00:00Z",
    },
    {
      student_id: "zoya",
      name: "Zoya Khan",
      status: "done",
      in_group: false,
      score: 4,
      completed_at: "2026-11-23T11:00:00Z",
    },
  ],
};

const REPORT: StudentReport = {
  student_id: "riya",
  student_name: "Riya Verma",
  in_group: true,
  assignment_id: "a1",
  title: "Motion",
  curriculum_selection: MOTION,
  feedback: {
    score: 8,
    summary: "Clear on speed.",
    strong_points: ["Defined speed"],
    areas_of_improvement: ["Velocity has a direction"],
    next_steps: ["Practise velocity-time graphs"],
    coverage_note: null,
  },
  completed_at: "2026-11-24T11:00:00Z",
};

function failure(status: number) {
  return new AxiosError("failed", undefined, undefined, undefined, {
    status,
    statusText: "",
    data: {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

function renderWith(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return userEvent.setup();
}

beforeEach(() => {
  Object.values(groupsApi).forEach((fn) => fn.mockReset());
  groupsApi.getGroup.mockResolvedValue(GROUP);
  analytics.track.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
  address.replace.mockReset();
  address.search = "id=g1&viva=a1";
});
afterEach(cleanup);

describe("where a set viva stands", () => {
  const due = (due_on: string | null, completed_count = 0) => ({
    ...SET,
    due_on,
    completed_count,
  });

  test("today is the viewer's own calendar day", () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  test("completed needs a past due day and everyone done", () => {
    const today = "2026-11-24";
    expect(vivaStage(due("2026-11-23", 2), 2, today)).toBe("completed");
    expect(vivaStage(due("2026-11-24", 2), 2, today)).toBe("ongoing");
    expect(vivaStage(due("2026-11-23", 1), 2, today)).toBe("ongoing");
    expect(vivaStage(due(null, 2), 2, today)).toBe("ongoing");
    expect(vivaStage(due("2026-11-23", 0), 0, today)).toBe("ongoing");
  });

  test("overdue is past due with someone still to do it", () => {
    const today = "2026-11-24";
    expect(isOverdue(due("2026-11-23", 1), 2, today)).toBe(true);
    expect(isOverdue(due("2026-11-23", 2), 2, today)).toBe(false);
    expect(isOverdue(due(null), 2, today)).toBe(false);
    expect(isPastDue(due("2099-01-01"))).toBe(false);
    expect(everyoneDone(due(null, 3), 2)).toBe(true);
  });
});

describe("one viva's results", () => {
  test("adds up the group, then lists who finished and who hasn't started", async () => {
    groupsApi.getAssignmentResults.mockResolvedValue(RESULTS);
    renderWith(<VivaResults />);

    await screen.findByRole("heading", { name: "Motion" });
    expect(groupsApi.getAssignmentResults).toHaveBeenCalledWith("g1", "a1");
    expect(screen.getByText("Ongoing", { selector: "p" })).toBeTruthy();
    expect(
      screen.getByText("Science · Whole chapter · No due date"),
    ).toBeTruthy();
    // One number leads: the average, which counts every result.
    const summary = screen.getByRole("region", { name: "Summary" });
    expect(within(summary).getByText("6.5")).toBeTruthy();
    expect(within(summary).getByText("/ 10 average")).toBeTruthy();
    // Completion counts only those still in the group.
    expect(within(summary).getByText("1 of 2 completed")).toBeTruthy();
    expect(
      within(summary).getByRole("progressbar", { name: "1 of 2 done" }),
    ).toBeTruthy();

    const riya = screen.getByRole("link", {
      name: "Riya Verma's report, 8 out of 10",
    });
    expect(riya.getAttribute("href")).toBe(
      "/teach/report?id=g1&viva=a1&student=riya",
    );
    const zoya = screen.getByRole("link", { name: /Zoya Khan/ });
    expect(within(zoya).getByText(/Left the group/)).toBeTruthy();
    // A low score is marked out; a good one is not.
    expect(within(zoya).getByText("4").className).toMatch(/text-ember-text/);
    expect(within(riya).getByText("8").className).not.toMatch(/ember/);

    const waiting = screen.getByRole("heading", { name: /Not started/ });
    expect(waiting.textContent).toBe("Not started1");
    expect(screen.queryByRole("link", { name: /Aman Gupta/ })).toBeNull();
    expect(screen.getByText("Aman Gupta")).toBeTruthy();

    const back = await screen.findByRole("link", { name: "Class 9-A" });
    expect(back.getAttribute("href")).toBe("/teach/group?id=g1");
    await waitFor(() =>
      expect(analytics.track).toHaveBeenCalledWith(
        "assignment_results_viewed",
        { completed: 1, students: 3 },
      ),
    );
    expect(analytics.track).toHaveBeenCalledTimes(1);
  });

  test("a finished, past-due viva reads as completed", async () => {
    groupsApi.getAssignmentResults.mockResolvedValue({
      ...RESULTS,
      assignment: { ...SET, due_on: "2020-01-01" },
      students: RESULTS.students.slice(1),
    });
    renderWith(<VivaResults />);

    await screen.findByRole("heading", { name: "Motion" });
    expect(screen.getByText("Completed", { selector: "p" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /Not started/ })).toBeNull();
  });

  test("past due with someone left says overdue", async () => {
    groupsApi.getAssignmentResults.mockResolvedValue({
      ...RESULTS,
      assignment: { ...SET, due_on: "2020-01-01" },
    });
    renderWith(<VivaResults />);

    const overdue = await screen.findByText(/^Overdue, was due /);
    expect(overdue.className).toMatch(/text-ember-text/);
  });

  test("before anyone finishes it says what will appear", async () => {
    groupsApi.getAssignmentResults.mockResolvedValue({
      ...RESULTS,
      average_score: null,
      students: [RESULTS.students[0]],
    });
    renderWith(<VivaResults />);

    await screen.findByText(/Only the report is shared/);
    expect(screen.getByText("No scores yet")).toBeTruthy();
  });

  test("an empty group says results will come", async () => {
    groupsApi.getAssignmentResults.mockResolvedValue({
      ...RESULTS,
      students: [],
    });
    renderWith(<VivaResults />);

    await screen.findByText(/No one is in this group yet/);
  });

  test("removing it asks first, says its reports go too, then returns to the group", async () => {
    groupsApi.getAssignmentResults.mockResolvedValue(RESULTS);
    groupsApi.deleteAssignment.mockResolvedValue(undefined);
    const user = renderWith(<VivaResults />);

    await user.click(
      await screen.findByRole("button", { name: "Viva options" }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Remove viva" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Remove Motion?",
    });
    expect(within(dialog).getByText(/reports already sent/)).toBeTruthy();
    expect(groupsApi.deleteAssignment).not.toHaveBeenCalled();
    await user.click(
      within(dialog).getByRole("button", { name: "Remove viva" }),
    );

    await waitFor(() =>
      expect(address.replace).toHaveBeenCalledWith("/teach/group?id=g1"),
    );
    expect(groupsApi.deleteAssignment).toHaveBeenCalledWith("g1", "a1");
    expect(analytics.track).toHaveBeenCalledWith("assignment_removed", {
      completed: 1,
    });
    expect(toast.success).toHaveBeenCalledWith("Viva removed");
  });

  test("keeping it does nothing; a failed removal says so", async () => {
    groupsApi.getAssignmentResults.mockResolvedValue(RESULTS);
    groupsApi.deleteAssignment.mockRejectedValue(failure(503));
    const user = renderWith(<VivaResults />);

    const options = await screen.findByRole("button", { name: "Viva options" });
    await user.click(options);
    await user.click(
      await screen.findByRole("menuitem", { name: "Remove viva" }),
    );
    await user.click(await screen.findByRole("button", { name: "Keep it" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(groupsApi.deleteAssignment).not.toHaveBeenCalled();

    await user.click(options);
    await user.click(
      await screen.findByRole("menuitem", { name: "Remove viva" }),
    );
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Remove viva",
      }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Couldn't remove the viva. Try again.",
      ),
    );
    expect(address.replace).not.toHaveBeenCalled();
  });

  test("a removed viva says so and leads back to the group", async () => {
    groupsApi.getAssignmentResults.mockRejectedValue(failure(404));
    renderWith(<VivaResults />);

    await screen.findByRole("heading", { name: "We can't find that viva" });
    expect(
      screen.getByRole("link", { name: "Go back" }).getAttribute("href"),
    ).toBe("/teach/group?id=g1");
  });

  test("an address without a viva cannot be one", () => {
    address.search = "id=g1";
    renderWith(<VivaResults />);

    expect(
      screen.getByRole("heading", { name: "We can't find that viva" }),
    ).toBeTruthy();
    expect(groupsApi.getAssignmentResults).not.toHaveBeenCalled();
  });

  test("without a group the way back is the start page", () => {
    address.search = "";
    renderWith(<VivaResults />);

    expect(
      screen.getByRole("link", { name: "Go back" }).getAttribute("href"),
    ).toBe("/teach");
  });

  test("an outage offers a retry, after an outline", async () => {
    groupsApi.getAssignmentResults.mockRejectedValueOnce(failure(503));
    groupsApi.getAssignmentResults.mockResolvedValueOnce(RESULTS);
    const user = renderWith(<VivaResults />);

    expect(
      screen.getByRole("status", { name: "Loading the results" }),
    ).toBeTruthy();
    await user.click(await screen.findByRole("button", { name: "Try again" }));

    await screen.findByRole("heading", { name: "Motion" });
  });

  test("before the group loads, the way back still works", async () => {
    groupsApi.getGroup.mockReturnValue(new Promise(() => undefined));
    groupsApi.getAssignmentResults.mockResolvedValue(RESULTS);
    renderWith(<VivaResults />);

    const back = await screen.findByRole("link", { name: "Back to the group" });
    expect(back.getAttribute("href")).toBe("/teach/group?id=g1");
  });
});

describe("a student's report, for whoever set the viva", () => {
  beforeEach(() => {
    address.search = "id=g1&viva=a1&student=riya";
  });

  test("shows what the student was told, and says what stays private", async () => {
    groupsApi.getStudentReport.mockResolvedValue(REPORT);
    renderWith(<StudentResultReport />);

    await screen.findByRole("heading", { name: "Motion" });
    expect(groupsApi.getStudentReport).toHaveBeenCalledWith("g1", "a1", "riya");
    expect(screen.getByText(/^Riya Verma · Class 9 · /)).toBeTruthy();
    expect(screen.getByText("Clear on speed.")).toBeTruthy();
    expect(screen.getByText("Velocity has a direction")).toBeTruthy();
    expect(screen.getByText("Practise velocity-time graphs")).toBeTruthy();
    expect(
      screen.getByText(/What they said in the viva stays private/),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Motion results" }).getAttribute("href"),
    ).toBe("/teach/viva?id=g1&viva=a1");
    expect(analytics.track).toHaveBeenCalledWith("student_report_viewed");
  });

  test("notes when the student has since left", async () => {
    groupsApi.getStudentReport.mockResolvedValue({
      ...REPORT,
      in_group: false,
    });
    renderWith(<StudentResultReport />);

    await screen.findByText(/· Left the group$/);
  });

  test("a report that isn't there says so", async () => {
    groupsApi.getStudentReport.mockRejectedValue(failure(404));
    renderWith(<StudentResultReport />);

    await screen.findByRole("heading", { name: "We can't find that report" });
    expect(
      screen.getByRole("link", { name: "Go back" }).getAttribute("href"),
    ).toBe("/teach/viva?id=g1&viva=a1");
  });

  test("without a group the way back is the start page", () => {
    address.search = "";
    renderWith(<StudentResultReport />);

    expect(
      screen.getByRole("link", { name: "Go back" }).getAttribute("href"),
    ).toBe("/teach");
  });

  test("without a viva the way back is the group", () => {
    address.search = "id=g1&student=riya";
    renderWith(<StudentResultReport />);

    expect(
      screen.getByRole("link", { name: "Go back" }).getAttribute("href"),
    ).toBe("/teach/group?id=g1");
  });

  test("an outage offers a retry, after an outline", async () => {
    groupsApi.getStudentReport.mockRejectedValueOnce(failure(500));
    groupsApi.getStudentReport.mockResolvedValueOnce(REPORT);
    const user = renderWith(<StudentResultReport />);

    expect(
      screen.getByRole("status", { name: "Loading the report" }),
    ).toBeTruthy();
    await user.click(await screen.findByRole("button", { name: "Try again" }));

    await screen.findByRole("heading", { name: "Motion" });
  });
});
