// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ClassInsight } from "@/components/teach/class-insight";
import type { ClassInsightState } from "@/types/assignments";

/**
 * The AI class insight on a set viva's results page. The server decides
 * whether one can be written and whether it is out of date; the card shows
 * that and lets the teacher ask for it. Only the API, analytics and toasts
 * are stand-ins.
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

const analytics = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@/lib/analytics/events", () => ({ track: analytics.track }));

const { toast } = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast }));

const groupsApi = vi.hoisted(() => ({
  getClassInsight: vi.fn(),
  generateClassInsight: vi.fn(),
}));
vi.mock("@/lib/groups/api", () => groupsApi);

const RIYA = { student_id: "riya", name: "Riya Verma" };
const AMAN = { student_id: "aman", name: "Aman Gupta" };
const ZOYA = { student_id: "zoya", name: "Zoya Khan" };

const NONE: ClassInsightState = {
  status: "ready_to_generate",
  results_count: 3,
  member_count: 4,
  min_results: 3,
  is_stale: false,
  new_results: 0,
  insight: null,
};

const READY: ClassInsightState = {
  ...NONE,
  status: "ready",
  insight: {
    overview: "Most of the class can define speed; velocity is shaky.",
    strengths: [
      {
        point: "Defines speed",
        student_count: 2,
        students: [RIYA, AMAN],
        misconception: null,
      },
    ],
    gaps: [
      {
        point: "Velocity has a direction",
        student_count: 3,
        students: [RIYA, AMAN, ZOYA],
        misconception: "Treats velocity as speed",
      },
    ],
    students_to_support: [{ student: ZOYA, reason: "Could not define speed." }],
    suggestions: [
      {
        action: "Walk two paths across the room and compare them",
        addresses: "Velocity has a direction",
      },
    ],
    coverage_note: "One short viva on Motion.",
    based_on: 3,
    generator_id: "gemini-3.8-flash:prompt-v1",
    generated_at: "2026-11-27T10:00:00Z",
  },
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

function renderCard(finished = 3) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  render(
    <QueryClientProvider client={client}>
      <ClassInsight groupId="g1" assignmentId="a1" finished={finished} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  Object.values(groupsApi).forEach((fn) => fn.mockReset());
  analytics.track.mockReset();
  toast.error.mockReset();
});
afterEach(cleanup);

describe("the class insight", () => {
  test("waits until enough students have finished", async () => {
    groupsApi.getClassInsight.mockResolvedValue({
      ...NONE,
      status: "not_enough_results",
      results_count: 1,
    });
    renderCard(1);

    await screen.findByText(/Ready once 3 students have finished/);
    expect(screen.getByText(/1 so far/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("is written on request and then shows the teacher's view", async () => {
    groupsApi.getClassInsight.mockResolvedValue(NONE);
    groupsApi.generateClassInsight.mockResolvedValue(READY);
    const user = renderCard();

    await user.click(
      await screen.findByRole("button", { name: "Get class insight" }),
    );

    await screen.findByText(
      "Most of the class can define speed; velocity is shaky.",
    );
    expect(groupsApi.generateClassInsight).toHaveBeenCalledWith("g1", "a1");
    expect(analytics.track).toHaveBeenCalledWith("class_insight_requested", {
      based_on: 3,
      refreshed: false,
    });
    expect(screen.getByText("Typical mix-up: Treats velocity as speed"));
    expect(screen.getByText("3 students")).toBeTruthy();
    // Who to help first opens that student's report.
    const help = screen.getByRole("link", { name: /Zoya Khan/ });
    expect(help.getAttribute("href")).toContain("student=zoya");
    expect(
      screen.getByText("Walk two paths across the room and compare them"),
    ).toBeTruthy();
    expect(
      screen.getByText(/Written by AI from the reports only/),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Refresh/ })).toBeNull();
  });

  test("says when new results have arrived and refreshes on request", async () => {
    groupsApi.getClassInsight.mockResolvedValue({
      ...READY,
      is_stale: true,
      new_results: 1,
    });
    groupsApi.generateClassInsight.mockResolvedValue(READY);
    const user = renderCard(4);

    const card = await screen.findByRole("region", { name: "Class insight" });
    expect(
      within(card).getByText(
        "1 more student has finished since this was written.",
      ),
    ).toBeTruthy();
    await user.click(within(card).getByRole("button", { name: /Refresh/ }));

    expect(analytics.track).toHaveBeenCalledWith("class_insight_requested", {
      based_on: 3,
      refreshed: true,
    });
    expect(await screen.findByText(/From 3 students' reports/)).toBeTruthy();
    expect(screen.queryByText(/more student has finished/)).toBeNull();
  });

  test("a failed attempt says so and can be tried again", async () => {
    groupsApi.getClassInsight.mockResolvedValue(NONE);
    groupsApi.generateClassInsight.mockRejectedValue(failure(503));
    const user = renderCard();

    const button = await screen.findByRole("button", {
      name: "Get class insight",
    });
    await user.click(button);

    expect(toast.error).toHaveBeenCalledWith(
      "Couldn't write the class insight. Try again in a moment.",
    );
    expect(
      screen.getByRole("button", { name: "Get class insight" }),
    ).toBeTruthy();
  });

  test("stays out of the way if it can't be loaded", async () => {
    groupsApi.getClassInsight.mockRejectedValue(failure(500));
    renderCard();

    await vi.waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Class insight" }),
      ).toBeNull(),
    );
    expect(groupsApi.getClassInsight).toHaveBeenCalled();
  });
});
