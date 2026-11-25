// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import type { Me, ProfileUpdate } from "@/types/profile";
import { privateContentLeaks } from "./helpers/private-content";

const router = { replace: vi.fn(), push: vi.fn() };
// What the screen reports to analytics, recorded here instead of sent.
const analytics = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@/lib/analytics/events", () => ({ track: analytics.track }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span>{alt}</span>,
}));

const fetchUserAttributes = vi.fn();
vi.mock("aws-amplify/auth", () => ({
  fetchUserAttributes: () => fetchUserAttributes(),
}));
vi.mock("@/lib/auth/client", () => ({ configureAuth: vi.fn() }));

const saveProfile = vi.fn();
const getMe = vi.fn();
vi.mock("@/lib/api/me", () => ({
  getMe: () => getMe(),
  saveProfile: (profile: ProfileUpdate) => saveProfile(profile),
}));

const NEW_STUDENT: Me = {
  user_id: "user-1",
  onboarding_complete: false,
  profile: null,
};

function saved(profile: ProfileUpdate): Me {
  return {
    user_id: "user-1",
    onboarding_complete: true,
    profile: {
      class_level: null,
      board: null,
      school_name: null,
      school_address: null,
      ...profile,
      created_at: "2026-11-21T10:00:00Z",
      updated_at: "2026-11-21T10:00:00Z",
    },
  };
}

/**
 * Opens onboarding and, for someone new, answers the first question ("who is
 * this account for?") so each test starts where it means to.
 */
async function renderFlow(
  me: Me = NEW_STUDENT,
  who: string | null = "I'm a student",
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["me"], me);
  render(
    <QueryClientProvider client={client}>
      <OnboardingFlow />
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  if (who && !me.onboarding_complete) {
    await user.click(screen.getByRole("button", { name: new RegExp(who) }));
  }
  return user;
}

beforeEach(() => {
  router.replace.mockReset();
  saveProfile.mockReset();
  saveProfile.mockImplementation(async (profile: ProfileUpdate) =>
    saved(profile),
  );
  fetchUserAttributes.mockReset();
  fetchUserAttributes.mockResolvedValue({});
});
afterEach(cleanup);

describe("step one: the name and the class", () => {
  test("nothing is saved until both are given, and each problem is named", async () => {
    const user = await renderFlow();

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText("Tell us what to call you.")).toBeTruthy();
    expect(screen.getByText("Pick your class.")).toBeTruthy();
    expect(saveProfile).not.toHaveBeenCalled();
  });

  test("the name from a Google account is offered, so nobody retypes it", async () => {
    fetchUserAttributes.mockResolvedValue({ name: "Asha Rao" });
    await renderFlow();

    const name = screen.getByLabelText(
      "What should we call you?",
    ) as HTMLInputElement;
    await waitFor(() => expect(name.value).toBe("Asha Rao"));
  });

  test("a name the student is already typing is never overwritten", async () => {
    let deliver: (attributes: { name: string }) => void = () => undefined;
    fetchUserAttributes.mockReturnValue(
      new Promise((resolve) => {
        deliver = resolve;
      }),
    );
    const user = await renderFlow();
    const name = screen.getByLabelText(
      "What should we call you?",
    ) as HTMLInputElement;

    await user.type(name, "Kavya");
    deliver({ name: "Asha Rao" });

    await waitFor(() => expect(fetchUserAttributes).toHaveBeenCalled());
    expect(name.value).toBe("Kavya");
  });

  test("continuing saves the name and class at once, then offers the extras", async () => {
    const user = await renderFlow();

    await user.type(
      screen.getByLabelText("What should we call you?"),
      "  Asha Rao ",
    );
    await user.click(screen.getByRole("radio", { name: "9" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await screen.findByRole("heading", { name: "A little more, if you like" });
    expect(saveProfile).toHaveBeenCalledWith({
      name: "Asha Rao",
      account_type: "student",
      class_level: 9,
    });
    // Finishing step one must not throw the student out before step two.
    expect(router.replace).not.toHaveBeenCalled();
  });

  test("a failed save keeps the student on the step with their answers", async () => {
    saveProfile.mockRejectedValue(new Error("offline"));
    const user = await renderFlow();

    await user.type(screen.getByLabelText("What should we call you?"), "Asha");
    await user.click(screen.getByRole("radio", { name: "9" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await screen.findByText(/couldn't save that/);
    expect(
      (screen.getByLabelText("What should we call you?") as HTMLInputElement)
        .value,
    ).toBe("Asha");
    expect(
      screen.getByRole("radio", { name: "9" }).getAttribute("aria-checked"),
    ).toBe("true");
  });
});

describe("step two: the optional details", () => {
  async function reachStepTwo() {
    const user = await renderFlow();
    await user.type(
      screen.getByLabelText("What should we call you?"),
      "Asha Rao",
    );
    await user.click(screen.getByRole("radio", { name: "9" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "A little more, if you like" });
    saveProfile.mockClear();
    return user;
  }

  test("skipping goes straight to the app without another save", async () => {
    const user = await reachStepTwo();

    await user.click(screen.getByRole("button", { name: "Skip for now" }));

    expect(saveProfile).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  test("finishing saves the board and school with the name and class", async () => {
    const user = await reachStepTwo();

    await user.click(screen.getByRole("radio", { name: "ICSE" }));
    await user.type(screen.getByLabelText(/School name/), "Hill View School");
    await user.click(screen.getByRole("button", { name: "Finish" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(saveProfile).toHaveBeenCalledWith({
      name: "Asha Rao",
      account_type: "student",
      class_level: 9,
      board: "ICSE",
      school_name: "Hill View School",
      school_address: null,
    });
  });

  test("a board chosen by mistake can be cleared with a second tap", async () => {
    const user = await reachStepTwo();
    const board = screen.getByRole("radio", { name: "CBSE" });

    await user.click(board);
    expect(board.getAttribute("aria-checked")).toBe("true");
    await user.click(board);
    expect(board.getAttribute("aria-checked")).toBe("false");
  });
});

test("a student who already has a profile is sent on to the app", async () => {
  await renderFlow(
    saved({ name: "Asha Rao", account_type: "student", class_level: 9 }),
  );

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  expect(screen.queryByLabelText("What should we call you?")).toBeNull();
});

test("the class can be chosen from the keyboard", async () => {
  const user = await renderFlow();

  screen.getByRole("radio", { name: "5" }).focus();
  await user.keyboard("{ArrowRight}{ArrowRight}");

  expect(
    screen.getByRole("radio", { name: "7" }).getAttribute("aria-checked"),
  ).toBe("true");
  expect(document.activeElement).toBe(screen.getByRole("radio", { name: "7" }));
});

describe("details of the flow", () => {
  async function fillBasics(user: ReturnType<typeof userEvent.setup>) {
    await user.type(
      screen.getByLabelText("What should we call you?"),
      "Asha Rao",
    );
    await user.click(screen.getByRole("radio", { name: "9" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "A little more, if you like" });
  }

  test("while the profile is still loading, the steps wait", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    getMe.mockReturnValue(new Promise(() => undefined));

    render(
      <QueryClientProvider client={client}>
        <OnboardingFlow />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("status").textContent).toMatch(
      /Getting things ready/,
    );
    expect(screen.queryByLabelText("What should we call you?")).toBeNull();
  });

  test("leaving the name empty is pointed out as soon as the field is left", async () => {
    const user = await renderFlow();

    await user.click(screen.getByLabelText("What should we call you?"));
    await user.tab();

    expect(screen.getByText("Tell us what to call you.")).toBeTruthy();
  });

  test("picking a class clears its error", async () => {
    const user = await renderFlow();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Pick your class.")).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: "9" }));

    expect(screen.queryByText("Pick your class.")).toBeNull();
  });

  test("the step counter tells the student where they are", async () => {
    const user = await renderFlow();

    expect(screen.getByText("Step 2 of 3")).toBeTruthy();
    await fillBasics(user);
    expect(screen.getByText("Step 3 of 3")).toBeTruthy();
  });

  test("the second step greets the student by first name", async () => {
    const user = await renderFlow();

    await fillBasics(user);

    // The name sits in an element of its own, so recordings can leave it out.
    expect(screen.getByText("Asha").closest("p")?.textContent).toMatch(
      /^You're all set, Asha\. /,
    );
  });

  test("an expired session during saving says to sign in again", async () => {
    const { AxiosError, AxiosHeaders } = await import("axios");
    saveProfile.mockRejectedValue(
      new AxiosError("failed", undefined, undefined, undefined, {
        status: 401,
        statusText: "",
        data: {},
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    );
    const user = await renderFlow();

    await user.type(screen.getByLabelText("What should we call you?"), "Asha");
    await user.click(screen.getByRole("radio", { name: "9" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await screen.findByText(/Your session has ended/);
  });

  test("the address is sent with its line breaks", async () => {
    const user = await renderFlow();
    await fillBasics(user);
    saveProfile.mockClear();

    await user.type(
      screen.getByLabelText(/School address/),
      "12 Lake Road{Enter}Pune",
    );
    await user.click(screen.getByRole("button", { name: "Finish" }));

    await waitFor(() => expect(saveProfile).toHaveBeenCalled());
    expect(saveProfile.mock.calls[0][0].school_address).toBe(
      "12 Lake Road\nPune",
    );
  });

  test("an optional detail that cannot be saved is reported and nothing is sent", async () => {
    const user = await renderFlow();
    await fillBasics(user);
    saveProfile.mockClear();

    // Pasting can carry characters that typing cannot.
    await user.click(screen.getByLabelText(/School name/));
    await user.paste("Hill\u0000View");
    await user.click(screen.getByRole("button", { name: "Finish" }));

    expect(
      screen.getByText(/school name has a character we can't use/),
    ).toBeTruthy();
    expect(saveProfile).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  test("going back keeps what was already entered", async () => {
    const user = await renderFlow();
    await fillBasics(user);

    await user.click(
      screen.getByRole("button", { name: "Back to name and class" }),
    );

    expect(
      (screen.getByLabelText("What should we call you?") as HTMLInputElement)
        .value,
    ).toBe("Asha Rao");
    expect(
      screen.getByRole("radio", { name: "9" }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  test("a failed finish keeps the student on the step", async () => {
    const user = await renderFlow();
    await fillBasics(user);
    saveProfile.mockRejectedValue(new Error("offline"));

    await user.click(screen.getByRole("button", { name: "Finish" }));

    await screen.findByText(/couldn't save that/);
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("what analytics is told", () => {
  beforeEach(() => analytics.track.mockClear());

  async function finishStepOne() {
    const user = await renderFlow();
    await user.type(
      screen.getByLabelText("What should we call you?"),
      "Asha Rao",
    );
    await user.click(screen.getByRole("radio", { name: "9" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "A little more, if you like" });
    return user;
  }

  test("onboarding is complete once the name and class are saved, with the class and not the name", async () => {
    await finishStepOne();

    expect(analytics.track.mock.calls).toEqual([
      ["onboarding_completed", { account_type: "student", class_level: 9 }],
    ]);
  });

  test("going back and continuing again does not complete onboarding twice", async () => {
    const user = await finishStepOne();

    await user.click(
      screen.getByRole("button", { name: "Back to name and class" }),
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "A little more, if you like" });

    expect(saveProfile).toHaveBeenCalledTimes(2);
    expect(analytics.track.mock.calls).toEqual([
      ["onboarding_completed", { account_type: "student", class_level: 9 }],
    ]);
  });

  test("a save that failed is not a completed onboarding", async () => {
    saveProfile.mockRejectedValue(new Error("down"));
    const user = await renderFlow();
    await user.type(
      screen.getByLabelText("What should we call you?"),
      "Asha Rao",
    );
    await user.click(screen.getByRole("radio", { name: "9" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("alert");

    expect(analytics.track).not.toHaveBeenCalled();
  });

  test("the extras say which board, and only whether a school was given", async () => {
    const user = await finishStepOne();
    analytics.track.mockClear();

    await user.click(screen.getByRole("radio", { name: "ICSE" }));
    await user.type(screen.getByLabelText(/School name/), "Hill View School");
    await user.click(screen.getByRole("button", { name: "Finish" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));

    expect(analytics.track.mock.calls).toEqual([
      ["onboarding_extras_saved", { board: "ICSE", has_school: true }],
    ]);
  });

  test("skipping the extras says nothing more", async () => {
    const user = await finishStepOne();
    analytics.track.mockClear();

    await user.click(screen.getByRole("button", { name: "Skip for now" }));

    expect(analytics.track).not.toHaveBeenCalled();
  });

  test("a recording of the second step does not show the student's name", async () => {
    await finishStepOne();

    expect(screen.getByText("Asha")).toBeTruthy();
    expect(privateContentLeaks(document.body, ["Asha"])).toEqual([]);
  });
});

describe("the first question: who the account is for", () => {
  test("is asked before anything else, and says where to change it", async () => {
    await renderFlow(NEW_STUDENT, null);

    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
    expect(screen.getByText(/change it later in Settings/)).toBeTruthy();
    for (const who of ["I'm a student", "I'm a teacher", "I'm a parent"]) {
      expect(
        screen.getByRole("button", { name: new RegExp(who) }),
      ).toBeTruthy();
    }
    expect(screen.queryByLabelText("What should we call you?")).toBeNull();
  });

  test("a teacher gives only a name, and lands on their groups", async () => {
    const user = await renderFlow(NEW_STUDENT, "I'm a teacher");

    expect(screen.getByText("Step 2 of 2")).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "9" })).toBeNull();
    await user.type(
      screen.getByLabelText("What should we call you?"),
      "Meera Sharma",
    );
    await user.click(screen.getByRole("button", { name: "Finish" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/teach"));
    expect(saveProfile).toHaveBeenCalledWith({
      name: "Meera Sharma",
      account_type: "teacher",
    });
  });

  test("a parent is saved as a parent", async () => {
    const user = await renderFlow(NEW_STUDENT, "I'm a parent");

    await user.type(screen.getByLabelText("What should we call you?"), "Anita");
    await user.click(screen.getByRole("button", { name: "Finish" }));

    await waitFor(() => expect(saveProfile).toHaveBeenCalled());
    expect(saveProfile.mock.calls[0][0]).toMatchObject({
      account_type: "parent",
    });
    expect(analytics.track).toHaveBeenCalledWith("onboarding_completed", {
      account_type: "parent",
      class_level: null,
    });
  });

  test("going back from the name lets the choice be changed", async () => {
    const user = await renderFlow(NEW_STUDENT, "I'm a teacher");

    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: /I'm a student/ }));

    expect(screen.getByRole("radio", { name: "9" })).toBeTruthy();
  });

  test("a student who arrived from an invite link goes back to it", async () => {
    vi.stubGlobal("location", {
      ...window.location,
      search: "?next=%2Fjoin%3Fcode%3DK7QX2M",
    });
    const user = await renderFlow();
    await user.type(screen.getByLabelText("What should we call you?"), "Riya");
    await user.click(screen.getByRole("radio", { name: "9" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "A little more, if you like" });

    await user.click(screen.getByRole("button", { name: "Finish" }));

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/join?code=K7QX2M"),
    );
    vi.unstubAllGlobals();
  });
});
