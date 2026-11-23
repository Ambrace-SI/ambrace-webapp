// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { VivaFeedbackPrompt } from "@/components/report/viva-feedback-prompt";

// What the row reports to analytics, recorded here instead of sent.
const analytics = vi.hoisted(() => ({ track: vi.fn(), on: true }));
vi.mock("@/lib/analytics/events", () => ({
  track: analytics.track,
  analyticsOn: () => analytics.on,
}));

function renderPrompt(vivaSessionId = "session-1") {
  render(<VivaFeedbackPrompt vivaSessionId={vivaSessionId} score={7} />);
  return userEvent.setup();
}

const press = (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(screen.getByRole("button", { name }));

beforeEach(() => {
  analytics.track.mockClear();
  analytics.on = true;
});

describe("the first question", () => {
  test("asks about the session, with three plain answers and a way to close it", () => {
    renderPrompt();

    expect(screen.getByText("How was the session?")).toBeTruthy();
    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual(["Bad", "Fine", "Good", ""]);
    expect(
      screen.getByRole("button", { name: "Close these questions" }),
    ).toBeTruthy();
  });

  test("is a named group, so a screen reader hears what the buttons answer", () => {
    renderPrompt();

    expect(
      screen.getByRole("region", { name: "How was the session?" }),
    ).toBeTruthy();
  });

  test("nothing is sent just for showing it", () => {
    renderPrompt();

    expect(analytics.track).not.toHaveBeenCalled();
  });
});

describe("answering", () => {
  test.each([
    ["Bad", "bad"],
    ["Fine", "fine"],
    ["Good", "good"],
  ])("%s is sent as an answer about the session", async (label, rating) => {
    const user = renderPrompt();

    await press(user, label);

    expect(analytics.track.mock.calls).toEqual([
      [
        "viva_feedback_given",
        { viva_session_id: "session-1", about: "session", rating, score: 7 },
      ],
    ]);
  });

  test("the first answer brings the second question: how is the report", async () => {
    const user = renderPrompt();

    await press(user, "Good");

    expect(screen.getByText("How is the report?")).toBeTruthy();
    expect(screen.queryByText("How was the session?")).toBeNull();
    expect(screen.getByRole("button", { name: "Fine" })).toBeTruthy();
  });

  test("the second answer is sent as being about the report, then the row says thank you", async () => {
    const user = renderPrompt();
    await press(user, "Good");
    analytics.track.mockClear();

    await press(user, "Bad");

    expect(analytics.track.mock.calls).toEqual([
      [
        "viva_feedback_given",
        {
          viva_session_id: "session-1",
          about: "report",
          rating: "bad",
          score: 7,
        },
      ],
    ]);
    expect(screen.getByRole("status").textContent).toMatch(/^Thank you\./);
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("after the thanks, focus is on it rather than lost with the button that was pressed", async () => {
    const user = renderPrompt();
    await press(user, "Good");

    await press(user, "Good");

    expect(document.activeElement).toBe(screen.getByRole("status"));
  });
});

describe("closing it", () => {
  test("on the first question: it goes, and we are told which question was left", async () => {
    const user = renderPrompt();

    await press(user, "Close these questions");

    expect(screen.queryByText("How was the session?")).toBeNull();
    expect(analytics.track.mock.calls).toEqual([
      [
        "viva_feedback_dismissed",
        { viva_session_id: "session-1", at: "session" },
      ],
    ]);
  });

  test("on the second question: the first answer still counts", async () => {
    const user = renderPrompt();
    await press(user, "Fine");

    await press(user, "Close these questions");

    expect(
      analytics.track.mock.calls.map(([name, sent]) => [
        name,
        sent.about ?? sent.at,
      ]),
    ).toEqual([
      ["viva_feedback_given", "session"],
      ["viva_feedback_dismissed", "report"],
    ]);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("opening the report again", () => {
  test("asks again: nothing remembers an answer", async () => {
    const user = renderPrompt();
    await press(user, "Good");
    document.body.innerHTML = "";

    renderPrompt();

    expect(screen.getByText("How was the session?")).toBeTruthy();
  });

  test("asks again after the row was closed", async () => {
    const user = renderPrompt();
    await press(user, "Close these questions");
    document.body.innerHTML = "";

    renderPrompt();

    expect(screen.getByText("How was the session?")).toBeTruthy();
  });

  test("leaves nothing behind in the browser", async () => {
    const user = renderPrompt();
    await press(user, "Good");
    await press(user, "Fine");

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});

test("with analytics off the row is not shown: the answer would go nowhere", () => {
  analytics.on = false;

  renderPrompt();

  expect(screen.queryByText(/How was/)).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
});
