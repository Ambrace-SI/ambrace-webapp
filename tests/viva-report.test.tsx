// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { ReportOutline, VivaReport } from "@/components/report/viva-report";
import { APIError } from "@/lib/api/axios";
import type { VivaSession } from "@/types/viva";
import { privateContentLeaks } from "./helpers/private-content";

// What the screen reports to analytics, recorded here instead of sent.
const analytics = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@/lib/analytics/events", () => ({
  track: analytics.track,
  analyticsOn: () => true,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("id=session-1"),
}));

const getVivaSession = vi.fn();
vi.mock("@/lib/api/axios", async (original) => ({
  ...(await original<typeof import("@/lib/api/axios")>()),
  getVivaSession: (id: string) => getVivaSession(id),
}));

const SESSION: VivaSession = {
  viva_session_id: "session-1",
  student_name: "Asha Rao",
  topic: "Cell: The Building Block of Life",
  class_level: "9",
  status: "completed",
  started_at: "2026-11-21T10:00:00Z",
  feedback: {
    score: 7,
    summary: "Clear on cell structure; needed a hint on organelles.",
    strong_points: ["Named the nucleus unprompted."],
    areas_of_improvement: ["Mixes up plant and animal cells."],
    next_steps: ["Draw both cells and label three differences."],
    coverage_note: "One short session.",
  },
};

function renderReport() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <VivaReport />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getVivaSession.mockReset();
  getVivaSession.mockResolvedValue(SESSION);
});

describe("a finished viva", () => {
  test("is fetched by the id in the address", async () => {
    renderReport();

    await screen.findByRole("heading", { level: 1 });
    expect(getVivaSession).toHaveBeenCalledWith("session-1");
  });

  test("leads with what it was about and how it went", async () => {
    renderReport();

    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe(
      "Cell: The Building Block of Life",
    );
    expect(screen.getByText("Class 9 · 21 Nov 2026")).toBeTruthy();
    expect(screen.getByLabelText("Score").textContent).toMatch(/^7 \/ 10/);
    expect(
      screen.getByText("Clear on cell structure; needed a hint on organelles."),
    ).toBeTruthy();
    expect(screen.getByText("One short session.")).toBeTruthy();
  });

  test("then what went well, what to work on, and what to practise, in that order", async () => {
    renderReport();

    await screen.findByRole("heading", { level: 1 });
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
    ).toEqual(["What went well", "What to work on", "Practise next"]);
    expect(screen.getByText("Named the nucleus unprompted.")).toBeTruthy();
    expect(screen.getByText("Mixes up plant and animal cells.")).toBeTruthy();
    expect(
      screen.getByText("Draw both cells and label three differences."),
    ).toBeTruthy();
  });

  test("offers another viva and the way home", async () => {
    renderReport();

    expect(
      (
        await screen.findByRole("link", { name: "Start another viva" })
      ).getAttribute("href"),
    ).toBe("/");
    expect(
      screen.getByRole("link", { name: "Home" }).getAttribute("href"),
    ).toBe("/");
  });

  test("sections the examiner left empty say so, and optional ones disappear", async () => {
    getVivaSession.mockResolvedValue({
      ...SESSION,
      feedback: {
        score: 10,
        summary: "Excellent.",
        strong_points: [],
        areas_of_improvement: [],
      },
    });
    renderReport();

    await screen.findByRole("heading", { level: 1 });
    expect(
      screen.getAllByText("Nothing was singled out this time."),
    ).toHaveLength(2);
    expect(screen.queryByText("Practise next")).toBeNull();
  });
});

describe("when there is nothing to show", () => {
  test("an outline holds the page's shape while it loads", () => {
    getVivaSession.mockReturnValue(new Promise(() => undefined));
    renderReport();

    expect(screen.getByRole("status").textContent).toBe("Loading your report");
    expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("true");
  });

  test("the outline can stand alone, for the moment before the address is known", () => {
    render(<ReportOutline />);

    expect(screen.getByRole("status").textContent).toBe("Loading your report");
  });

  test("a viva that ended early has no report, and says what to do", async () => {
    getVivaSession.mockResolvedValue({ ...SESSION, feedback: null });
    renderReport();

    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe(
      "There's no report for this viva",
    );
    expect(
      screen.getByRole("link", { name: "Start another viva" }),
    ).toBeTruthy();
  });

  test.each([404, 403, 422])(
    "someone else's, a missing or a mistyped report (%s) is not offered a retry",
    async (status) => {
      getVivaSession.mockRejectedValue(new APIError("Not found", status));
      renderReport();

      expect(
        (await screen.findByRole("heading", { level: 1 })).textContent,
      ).toBe("We can't find that report");
      expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
      expect(screen.getByRole("link", { name: "Home" })).toBeTruthy();
    },
  );

  test("a failed load can be tried again", async () => {
    getVivaSession.mockRejectedValueOnce(new APIError("Network Error"));
    renderReport();

    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "Try again" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
        "Cell: The Building Block of Life",
      ),
    );
  });
});

describe("what analytics is told", () => {
  beforeEach(() => analytics.track.mockClear());

  test("a report that was read: the score and the counts, none of the words", async () => {
    renderReport();
    await screen.findByRole("heading", { level: 1 });

    await waitFor(() =>
      expect(analytics.track.mock.calls).toEqual([
        [
          "report_viewed",
          {
            viva_session_id: "session-1",
            score: 7,
            class_level: "9",
            strong_points: 1,
            areas_to_improve: 1,
          },
        ],
      ]),
    );
  });

  test("a viva that ended before a report was written", async () => {
    getVivaSession.mockResolvedValue({ ...SESSION, feedback: null });
    renderReport();
    await screen.findByText("There's no report for this viva");

    await waitFor(() =>
      expect(analytics.track.mock.calls).toEqual([
        ["report_empty", { viva_session_id: "session-1" }],
      ]),
    );
  });

  test("a report that could not be loaded is not a report viewed", async () => {
    getVivaSession.mockRejectedValue(new APIError("gone", 404));
    renderReport();
    await screen.findByText("We can't find that report");

    expect(analytics.track).not.toHaveBeenCalled();
  });
});

test("a recording of the report shows the score, and none of the examiner's notes on what was said", async () => {
  renderReport();
  await screen.findByRole("heading", { level: 1 });

  expect(
    privateContentLeaks(document.body, [
      "Clear on cell structure; needed a hint on organelles.",
      "Named the nucleus unprompted.",
      "Mixes up plant and animal cells.",
      "Draw both cells and label three differences.",
    ]),
  ).toEqual([]);
  expect(screen.getByLabelText("Score").closest(".ph-no-capture")).toBeNull();
});

describe("asking how it went", () => {
  test("a report ends by asking about the session, above the way on", async () => {
    renderReport();
    await screen.findByRole("heading", { level: 1 });

    const question = screen.getByText("How was the session?");
    const startAnother = screen.getByRole("link", {
      name: "Start another viva",
    });
    expect(
      question.compareDocumentPosition(startAnother) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("an answer is sent with this viva's ID and its score", async () => {
    renderReport();
    await screen.findByRole("heading", { level: 1 });
    analytics.track.mockClear();

    await userEvent.setup().click(screen.getByRole("button", { name: "Good" }));

    expect(analytics.track.mock.calls).toEqual([
      [
        "viva_feedback_given",
        {
          viva_session_id: "session-1",
          about: "session",
          rating: "good",
          score: 7,
        },
      ],
    ]);
  });

  test("a viva with no report is not asked about", async () => {
    getVivaSession.mockResolvedValue({ ...SESSION, feedback: null });
    renderReport();
    await screen.findByText("There's no report for this viva");

    expect(screen.queryByText("How was the session?")).toBeNull();
  });
});
