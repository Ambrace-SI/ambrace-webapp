// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { VivaSetup, type VivaChoice } from "@/components/viva/viva-setup";
import { curriculum } from "@/lib/curriculum/selectors";
import type { Profile } from "@/types/profile";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

const PROFILE: Profile = {
  name: "Asha Rao",
  class_level: 9,
  board: null,
  school_name: null,
  school_address: null,
  created_at: "2026-11-21T10:00:00Z",
  updated_at: "2026-11-21T10:00:00Z",
};

const onStart = vi.fn<(choice: VivaChoice) => void>();

function renderSetup(
  props: Partial<{ starting: boolean; error: string | null }> = {},
) {
  return render(
    <VivaSetup
      profile={PROFILE}
      starting={props.starting ?? false}
      error={props.error ?? null}
      onStart={onStart}
    />,
  );
}

/** The real Class 9 catalogue, so the test breaks if its shape ever does. */
async function subjectsLoaded() {
  return screen.findByRole("radio", { name: "Science" });
}

async function chooseCellChapter(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await subjectsLoaded());
  await user.click(
    screen.getByRole("radio", { name: /Cell: The Building Block of Life/ }),
  );
}

const startButton = () =>
  screen.getByRole("button", { name: "Start viva" }) as HTMLButtonElement;

beforeEach(() => onStart.mockReset());

describe("what the student is and is not asked", () => {
  test("name and class come from the profile; neither is a question", async () => {
    renderSetup();
    await subjectsLoaded();

    expect(screen.getByText("Class 9 · Asha")).toBeTruthy();
    expect(screen.queryByLabelText(/name/i)).toBeNull();
    expect(screen.queryByRole("radio", { name: /Class/ })).toBeNull();
  });

  test("one question at a time: chapters wait for a subject, focus waits for a chapter", async () => {
    const user = userEvent.setup();
    renderSetup();
    await subjectsLoaded();

    expect(screen.queryByRole("group", { name: "Chapter" })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(
      "Choose a subject to begin.",
    );

    await user.click(screen.getByRole("radio", { name: "Science" }));

    expect(screen.getByRole("group", { name: "Chapter" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: /Focus/ })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(
      "Now choose a chapter.",
    );

    await user.click(
      screen.getByRole("radio", { name: /Cell: The Building Block of Life/ }),
    );

    expect(screen.getByRole("group", { name: /Focus/ })).toBeTruthy();
    expect(
      screen.getByRole("group", { name: /Examiner's voice/ }),
    ).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(/microphone/);
  });

  test("a subject with nothing to examine is not offered", async () => {
    renderSetup();
    await subjectsLoaded();

    // Class 9 lists "Interdisciplinary Area" with no chapters.
    expect(
      screen.queryByRole("radio", { name: /Interdisciplinary Area/ }),
    ).toBeNull();
  });

  test("changing subject drops the chapter chosen under the old one", async () => {
    const user = userEvent.setup();
    renderSetup();
    await chooseCellChapter(user);

    await user.click(screen.getByRole("radio", { name: "Mathematics" }));

    expect(screen.queryByRole("group", { name: /Focus/ })).toBeNull();
    expect(startButton().disabled).toBe(true);
  });
});

describe("starting", () => {
  test("cannot start until a chapter is chosen", async () => {
    const user = userEvent.setup();
    renderSetup();
    await subjectsLoaded();

    expect(startButton().disabled).toBe(true);
    await user.click(screen.getByRole("radio", { name: "Science" }));
    expect(startButton().disabled).toBe(true);
  });

  test("with nothing narrowed, the whole chapter is examined in the default voice", async () => {
    const user = userEvent.setup();
    renderSetup();
    await chooseCellChapter(user);

    expect(
      (
        screen.getByRole("checkbox", {
          name: "Whole chapter",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    await user.click(startButton());

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

  test("chosen topics and voice are what is sent", async () => {
    const user = userEvent.setup();
    renderSetup();
    await chooseCellChapter(user);

    await user.click(screen.getByRole("checkbox", { name: "Nucleus" }));
    await user.click(screen.getByRole("radio", { name: "Puck" }));
    await user.click(startButton());

    const { selection, voiceName } = onStart.mock.calls[0][0];
    expect(voiceName).toBe("Puck");
    expect(selection.chapters[0].topics).toEqual([
      { id: "nucleus", name: "Nucleus" },
    ]);
  });

  test("while starting, nothing can be changed or sent twice", async () => {
    const user = userEvent.setup();
    const view = renderSetup();
    await chooseCellChapter(user);

    view.rerender(
      <VivaSetup profile={PROFILE} starting error={null} onStart={onStart} />,
    );

    const button = screen.getByRole("button", { name: "Starting" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(
      (screen.getByRole("radio", { name: "Science" }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
  });

  test("a failed start is explained next to the button", async () => {
    renderSetup({ error: "We couldn't start your viva." });
    await subjectsLoaded();

    expect(screen.getByRole("alert").textContent).toBe(
      "We couldn't start your viva.",
    );
  });

  test("it carries no way home of its own: the side panel around it is that", async () => {
    renderSetup();

    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("narrowing the focus", () => {
  const focus = () => within(screen.getByRole("group", { name: /Focus/ }));

  test("picking a topic turns off whole chapter; picking whole chapter clears topics", async () => {
    const user = userEvent.setup();
    renderSetup();
    await chooseCellChapter(user);
    const whole = () =>
      focus().getByRole("checkbox", {
        name: "Whole chapter",
      }) as HTMLInputElement;
    const nucleus = () =>
      focus().getByRole("checkbox", { name: "Nucleus" }) as HTMLInputElement;

    await user.click(nucleus());
    expect(whole().checked).toBe(false);
    expect(nucleus().checked).toBe(true);

    await user.click(whole());
    expect(whole().checked).toBe(true);
    expect(nucleus().checked).toBe(false);
  });

  test("a topic of the student's own is added, sent, and can be removed", async () => {
    const user = userEvent.setup();
    renderSetup();
    await chooseCellChapter(user);
    const input = focus().getByLabelText("Add a topic of your own");

    await user.type(input, "  Osmosis in potato strips ");
    await user.click(focus().getByRole("button", { name: "Add" }));

    expect((input as HTMLInputElement).value).toBe("");
    const added = focus().getByRole("checkbox", {
      name: "Osmosis in potato strips",
    }) as HTMLInputElement;
    expect(added.checked).toBe(true);

    await user.click(startButton());
    expect(onStart.mock.calls[0][0].selection.chapters[0].topics).toEqual([
      { id: "custom-topic-1", name: "Osmosis in potato strips" },
    ]);

    await user.click(added);
    expect(
      focus().queryByRole("checkbox", { name: "Osmosis in potato strips" }),
    ).toBeNull();
  });

  test("Enter in the topic box adds the topic and does not start the viva", async () => {
    const user = userEvent.setup();
    renderSetup();
    await chooseCellChapter(user);

    await user.type(
      focus().getByLabelText("Add a topic of your own"),
      "Diffusion{Enter}",
    );

    expect(focus().getByRole("checkbox", { name: "Diffusion" })).toBeTruthy();
    expect(onStart).not.toHaveBeenCalled();
  });

  test("an empty box adds nothing", async () => {
    const user = userEvent.setup();
    renderSetup();
    await chooseCellChapter(user);
    const before = focus().getAllByRole("checkbox").length;

    await user.type(
      focus().getByLabelText("Add a topic of your own"),
      "{Enter}",
    );

    expect(
      (focus().getByRole("button", { name: "Add" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(focus().getAllByRole("checkbox")).toHaveLength(before);
  });

  test("a topic that is too long is refused with a reason, and typing clears it", async () => {
    const user = userEvent.setup();
    renderSetup();
    await chooseCellChapter(user);
    const input = focus().getByLabelText("Add a topic of your own");

    await user.click(input);
    await user.paste("x".repeat(101));
    await user.click(focus().getByRole("button", { name: "Add" }));

    expect(focus().getByRole("alert").textContent).toMatch(/100 characters/);
    expect(input.getAttribute("aria-invalid")).toBe("true");

    await user.type(input, "{Backspace}");
    expect(focus().queryByRole("alert")).toBeNull();
  });

  test("no more than twenty topics of the student's own", async () => {
    // Sixty-odd presses: without a pause between each this stays well inside
    // the time limit even when the whole suite runs at once.
    const user = userEvent.setup({ delay: null });
    renderSetup();
    await chooseCellChapter(user);
    const input = focus().getByLabelText("Add a topic of your own");

    for (let count = 1; count <= 20; count++) {
      await user.click(input);
      await user.paste(`Own topic ${count}`);
      await user.keyboard("{Enter}");
    }
    await user.click(input);
    await user.paste("One too many");
    await user.keyboard("{Enter}");

    expect(focus().getByRole("alert").textContent).toMatch(/up to 20/);
    expect(
      focus().queryByRole("checkbox", { name: "One too many" }),
    ).toBeNull();
  });
});

describe("when the subject list will not load", () => {
  test("says so, and trying again recovers", async () => {
    const user = userEvent.setup();
    // Class 12 has not been loaded by any other test in this file.
    const load = vi
      .spyOn(curriculum, "loadClass")
      .mockRejectedValueOnce(new Error("offline"));
    render(
      <VivaSetup
        profile={{ ...PROFILE, class_level: 12 }}
        starting={false}
        error={null}
        onStart={onStart}
      />,
    );

    expect(screen.getByRole("status").textContent).toBe(
      "Getting your subjects ready.",
    );
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /couldn't load your subjects/,
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() =>
      expect(screen.getAllByRole("radio").length).toBeGreaterThan(0),
    );
    expect(load).toHaveBeenCalledTimes(2);
  });

  test("a class with no subjects says so instead of showing an empty form", async () => {
    vi.spyOn(curriculum, "loadClass").mockResolvedValue(undefined);
    vi.spyOn(curriculum, "getSubjectCatalog").mockReturnValue([]);

    render(
      <VivaSetup
        profile={{ ...PROFILE, class_level: 11 }}
        starting={false}
        error={null}
        onStart={onStart}
      />,
    );

    expect(
      await screen.findByText("There are no subjects for Class 11 yet."),
    ).toBeTruthy();
  });
});
