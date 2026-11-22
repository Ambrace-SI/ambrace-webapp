// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { VivaSetup, type VivaChoice } from "@/components/viva/viva-setup";
import { curriculum } from "@/lib/curriculum/selectors";
import { useVivaStore } from "@/lib/store/viva-store";
import type { Profile } from "@/types/profile";

const PROFILE: Profile = {
  name: "Asha Rao",
  class_level: 9,
  board: "STATE_BOARD",
  school_name: "Hill View School",
  school_address: null,
  created_at: "2026-11-21T10:00:00Z",
  updated_at: "2026-11-21T10:00:00Z",
};

const onStart = vi.fn<(choice: VivaChoice) => void>();

/** Whether the screen is phone-sized, as the browser would answer it. */
function screenIs(kind: "laptop" | "phone") {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: kind === "phone" && query.includes("max-width"),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function renderSetup(
  props: Partial<{
    profile: Profile;
    starting: boolean;
    error: string | null;
  }> = {},
) {
  return render(
    <VivaSetup
      profile={props.profile ?? PROFILE}
      starting={props.starting ?? false}
      error={props.error ?? null}
      onStart={onStart}
    />,
  );
}

const user = () => userEvent.setup();

/** The choices along the bottom of the screen. */
const choice = (name: RegExp) =>
  screen.getByRole("button", { name }) as HTMLButtonElement;
const subjectChoice = () => choice(/^Subject/);
const chapterChoice = () => choice(/^Chapter/);
const topicsChoice = () => choice(/^Topics/);
const startButton = () =>
  screen.getByRole("button", {
    name: /^(Start viva|Starting)$/,
  }) as HTMLButtonElement;

/** The real Class 9 catalogue, so the test breaks if its shape ever does. */
async function subjectsLoaded() {
  await waitFor(() => expect(subjectChoice().disabled).toBe(false));
}

async function chooseSubject(
  actor: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  if (!screen.queryByRole("group", { name: "Subject" }))
    await actor.click(subjectChoice());
  await actor.click(screen.getByRole("radio", { name }));
}

async function chooseCellChapter(actor: ReturnType<typeof userEvent.setup>) {
  await subjectsLoaded();
  await chooseSubject(actor, "Science");
  // Choosing a subject leads straight on to its chapters.
  await actor.click(
    screen.getByRole("radio", { name: /Cell: The Building Block of Life/ }),
  );
}

beforeEach(() => {
  onStart.mockReset();
  screenIs("laptop");
  // Radix measures the trigger it opens beside; jsdom has nothing to measure.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  useVivaStore.getState().resetSession();
});
afterEach(() => vi.unstubAllGlobals());

describe("the welcome", () => {
  test("greets the student by first name and shows what we know", async () => {
    renderSetup();

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Hello, Asha.",
    );
    expect(
      screen.getByText("Class 9 · State board · Hill View School"),
    ).toBeTruthy();
    expect(screen.getByText("How are you doing today?")).toBeTruthy();
    await subjectsLoaded();
  });

  test("leaves out details the student skipped, with no stray separators", async () => {
    renderSetup({ profile: { ...PROFILE, board: null, school_name: null } });

    expect(screen.getByText("Class 9")).toBeTruthy();
    await subjectsLoaded();
  });

  test("the line under the greeting follows what has been chosen", async () => {
    const actor = user();
    renderSetup();
    await subjectsLoaded();

    await chooseSubject(actor, "Science");
    expect(
      screen.getByText("Science it is. Which chapter shall we talk through?"),
    ).toBeTruthy();

    await actor.click(
      screen.getByRole("radio", { name: /Cell: The Building Block of Life/ }),
    );
    expect(
      screen.getByText("Cell: The Building Block of Life. Ready when you are."),
    ).toBeTruthy();
  });

  test("a viva that broke explains itself here, until dismissed", async () => {
    // The voice engine brings the student back here when a viva cannot go on.
    useVivaStore.getState().setError("Microphone access was blocked.");
    renderSetup();

    expect(screen.getByRole("alert").textContent).toBe(
      "Your viva stopped. Microphone access was blocked.",
    );

    await user().click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(useVivaStore.getState().error).toBeNull();
  });

  test("it carries no way to another page: the side panel is that", async () => {
    renderSetup();
    await subjectsLoaded();

    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("what the student is and is not asked", () => {
  test("name and class come from the profile; neither is a question", async () => {
    renderSetup();
    await subjectsLoaded();

    expect(screen.queryByLabelText(/name/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /^Class/ })).toBeNull();
  });

  test("one choice at a time: chapter waits for a subject, topics for a chapter", async () => {
    const actor = user();
    renderSetup();
    await subjectsLoaded();

    expect(chapterChoice().disabled).toBe(true);
    expect(topicsChoice().disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toBe(
      "Choose a subject to begin.",
    );

    await chooseSubject(actor, "Science");

    expect(chapterChoice().disabled).toBe(false);
    expect(topicsChoice().disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toBe(
      "Now choose a chapter.",
    );

    await actor.click(
      screen.getByRole("radio", { name: /Cell: The Building Block of Life/ }),
    );

    expect(topicsChoice().disabled).toBe(false);
    expect(screen.getByRole("status").textContent).toMatch(/microphone/);
  });

  test("each choice shows what was picked", async () => {
    const actor = user();
    renderSetup();
    await chooseCellChapter(actor);

    expect(subjectChoice().textContent).toMatch(/Science/);
    expect(chapterChoice().textContent).toMatch(
      /Cell: The Building Block of Life/,
    );
    expect(topicsChoice().textContent).toMatch(/Whole chapter/);
  });

  test("the bar asks only what the viva is about: there is no voice to pick", async () => {
    renderSetup();
    await subjectsLoaded();

    expect(screen.queryByRole("button", { name: /^Voice/ })).toBeNull();
    expect(screen.queryByText(/Puck|Charon|Aoede|Fenrir/)).toBeNull();
  });

  test("the lists open above the bar and close once something is picked", async () => {
    const actor = user();
    renderSetup();
    await subjectsLoaded();

    await actor.click(subjectChoice());
    expect(subjectChoice().getAttribute("aria-expanded")).toBe("true");

    await actor.click(screen.getByRole("radio", { name: "Science" }));
    expect(screen.queryByRole("group", { name: "Subject" })).toBeNull();
    expect(screen.getByRole("group", { name: "Chapter" })).toBeTruthy();

    await actor.click(
      screen.getByRole("radio", { name: /Cell: The Building Block of Life/ }),
    );
    expect(screen.queryByRole("group", { name: "Chapter" })).toBeNull();
  });

  test("a long chapter list can be searched", async () => {
    const actor = user();
    renderSetup();
    await subjectsLoaded();
    await chooseSubject(actor, "Science");

    await actor.type(screen.getByLabelText("Find a chapter"), "cell");

    const chapters = within(screen.getByRole("group", { name: "Chapter" }));
    expect(chapters.getAllByRole("radio")).toHaveLength(1);

    await actor.clear(screen.getByLabelText("Find a chapter"));
    await actor.type(screen.getByLabelText("Find a chapter"), "zzz");
    expect(chapters.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getByText("No chapter matches that.")).toBeTruthy();
  });

  test("a subject with nothing to examine is not offered", async () => {
    renderSetup();
    await subjectsLoaded();
    await user().click(subjectChoice());

    // Class 9 lists "Interdisciplinary Area" with no chapters.
    expect(
      screen.queryByRole("radio", { name: /Interdisciplinary Area/ }),
    ).toBeNull();
  });

  test("changing subject drops the chapter chosen under the old one", async () => {
    const actor = user();
    renderSetup();
    await chooseCellChapter(actor);

    await chooseSubject(actor, "Mathematics");

    expect(chapterChoice().textContent).toMatch(/Choose a chapter/);
    expect(topicsChoice().disabled).toBe(true);
    expect(startButton().disabled).toBe(true);
  });

  test("on a phone the lists open as a sheet from the bottom", async () => {
    screenIs("phone");
    const actor = user();
    renderSetup();
    await subjectsLoaded();

    await actor.click(subjectChoice());

    const sheet = screen.getByRole("dialog", { name: "Subject" });
    await actor.click(within(sheet).getByRole("radio", { name: "Science" }));
    expect(screen.getByRole("dialog", { name: "Chapter" })).toBeTruthy();
  });
});

describe("starting", () => {
  test("cannot start until a chapter is chosen", async () => {
    const actor = user();
    renderSetup();
    await subjectsLoaded();

    expect(startButton().disabled).toBe(true);
    await chooseSubject(actor, "Science");
    expect(startButton().disabled).toBe(true);
  });

  test("with nothing narrowed, the whole chapter is examined in the default voice", async () => {
    const actor = user();
    renderSetup();
    await chooseCellChapter(actor);

    await actor.click(startButton());

    expect(onStart).toHaveBeenCalledTimes(1);
    const { selection, voiceName } = onStart.mock.calls[0][0];
    expect(voiceName).toBe("Kore");
    expect(selection).toMatchObject({
      class_level: 9,
      subject_id: "science",
      subject_name: "Science",
      chapters: [
        {
          id: "ch-02-cell-the-building-block-of-life",
          name: "Cell: The Building Block of Life",
          topics: [],
        },
      ],
    });
  });

  test("chosen topics are what is sent, always in the Kore voice", async () => {
    const actor = user();
    renderSetup();
    await chooseCellChapter(actor);

    await actor.click(topicsChoice());
    await actor.click(screen.getByRole("checkbox", { name: "Nucleus" }));
    await actor.click(screen.getByRole("button", { name: "Done" }));
    expect(topicsChoice().textContent).toMatch(/1 topic/);

    await actor.click(startButton());

    const { selection, voiceName } = onStart.mock.calls[0][0];
    expect(voiceName).toBe("Kore");
    expect(selection.chapters[0].topics).toEqual([
      { id: "nucleus", name: "Nucleus" },
    ]);
  });

  test("while starting, nothing can be changed or sent twice", async () => {
    const actor = user();
    const view = renderSetup();
    await chooseCellChapter(actor);

    view.rerender(
      <VivaSetup profile={PROFILE} starting error={null} onStart={onStart} />,
    );

    const button = screen.getByRole("button", { name: "Starting" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    for (const each of [subjectChoice, chapterChoice, topicsChoice])
      expect(each().disabled).toBe(true);
  });

  test("a failed start is explained above the bar", async () => {
    renderSetup({ error: "We couldn't start your viva." });
    await subjectsLoaded();

    expect(screen.getByRole("alert").textContent).toBe(
      "We couldn't start your viva.",
    );
  });
});

describe("narrowing to topics", () => {
  const topics = () => within(screen.getByRole("group", { name: "Topics" }));

  async function openTopics(actor: ReturnType<typeof userEvent.setup>) {
    await chooseCellChapter(actor);
    await actor.click(topicsChoice());
  }

  test("picking a topic turns off whole chapter; picking whole chapter clears topics", async () => {
    const actor = user();
    renderSetup();
    await openTopics(actor);
    const whole = () =>
      topics().getByRole("checkbox", {
        name: "Whole chapter",
      }) as HTMLInputElement;
    const nucleus = () =>
      topics().getByRole("checkbox", { name: "Nucleus" }) as HTMLInputElement;

    expect(whole().checked).toBe(true);
    await actor.click(nucleus());
    expect(whole().checked).toBe(false);
    expect(nucleus().checked).toBe(true);

    await actor.click(whole());
    expect(whole().checked).toBe(true);
    expect(nucleus().checked).toBe(false);
  });

  test("a topic of the student's own is added, sent, and can be removed", async () => {
    const actor = user();
    renderSetup();
    await openTopics(actor);
    const input = topics().getByLabelText("Add a topic of your own");

    await actor.type(input, "  Osmosis in potato strips ");
    await actor.click(topics().getByRole("button", { name: "Add" }));

    expect((input as HTMLInputElement).value).toBe("");
    const added = topics().getByRole("checkbox", {
      name: "Osmosis in potato strips",
    }) as HTMLInputElement;
    expect(added.checked).toBe(true);

    await actor.click(added);
    expect(
      topics().queryByRole("checkbox", { name: "Osmosis in potato strips" }),
    ).toBeNull();

    await actor.type(input, "Turgor");
    await actor.click(topics().getByRole("button", { name: "Add" }));
    await actor.click(screen.getByRole("button", { name: "Done" }));
    await actor.click(startButton());
    expect(onStart.mock.calls[0][0].selection.chapters[0].topics).toEqual([
      { id: "custom-topic-1", name: "Turgor" },
    ]);
    // Two topics typed key by key, plus a dozen clicks: with every file
    // running at once it can pass the default limit, so it has its own.
  }, 15_000);

  test("Enter in the topic box adds the topic and does not start the viva", async () => {
    const actor = user();
    renderSetup();
    await openTopics(actor);

    await actor.type(
      topics().getByLabelText("Add a topic of your own"),
      "Diffusion{Enter}",
    );

    expect(topics().getByRole("checkbox", { name: "Diffusion" })).toBeTruthy();
    expect(onStart).not.toHaveBeenCalled();
  });

  test("an empty box adds nothing", async () => {
    const actor = user();
    renderSetup();
    await openTopics(actor);
    const before = topics().getAllByRole("checkbox").length;

    await actor.type(
      topics().getByLabelText("Add a topic of your own"),
      "{Enter}",
    );

    expect(
      (topics().getByRole("button", { name: "Add" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(topics().getAllByRole("checkbox")).toHaveLength(before);
  });

  test("a topic that is too long is refused with a reason, and typing clears it", async () => {
    const actor = user();
    renderSetup();
    await openTopics(actor);
    const input = topics().getByLabelText("Add a topic of your own");

    await actor.click(input);
    await actor.paste("x".repeat(101));
    await actor.click(topics().getByRole("button", { name: "Add" }));

    expect(topics().getByRole("alert").textContent).toMatch(/100 characters/);
    expect(input.getAttribute("aria-invalid")).toBe("true");

    await actor.type(input, "{Backspace}");
    expect(topics().queryByRole("alert")).toBeNull();
  });

  test("no more than twenty topics of the student's own", async () => {
    // Sixty-odd presses, so no pause between each.
    const actor = userEvent.setup({ delay: null });
    renderSetup();
    await openTopics(actor);
    const input = topics().getByLabelText("Add a topic of your own");

    for (let count = 1; count <= 20; count++) {
      await actor.click(input);
      await actor.paste(`Own topic ${count}`);
      await actor.keyboard("{Enter}");
    }
    await actor.click(input);
    await actor.paste("One too many");
    await actor.keyboard("{Enter}");

    expect(topics().getByRole("alert").textContent).toMatch(/up to 20/);
    expect(
      topics().queryByRole("checkbox", { name: "One too many" }),
    ).toBeNull();
    // The longest test in the suite by far. With every file running at once
    // it takes about as long as the default limit, so it has its own.
  }, 20_000);
});

describe("when the subject list will not load", () => {
  test("says so, and trying again recovers", async () => {
    const actor = user();
    // Class 12 has not been loaded by any other test in this file.
    const load = vi
      .spyOn(curriculum, "loadClass")
      .mockRejectedValueOnce(new Error("offline"));
    renderSetup({ profile: { ...PROFILE, class_level: 12 } });

    expect(screen.getByRole("status").textContent).toBe(
      "Getting your subjects ready.",
    );
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /couldn't load your subjects/,
    );

    await actor.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(subjectChoice().disabled).toBe(false));
    expect(load).toHaveBeenCalledTimes(2);
  });

  test("a class with no subjects says so instead of offering an empty list", async () => {
    vi.spyOn(curriculum, "loadClass").mockResolvedValue(undefined);
    vi.spyOn(curriculum, "getSubjectCatalog").mockReturnValue([]);

    renderSetup({ profile: { ...PROFILE, class_level: 11 } });

    expect(
      await screen.findByText("There are no subjects for Class 11 yet."),
    ).toBeTruthy();
    expect(subjectChoice().disabled).toBe(true);
  });
});
