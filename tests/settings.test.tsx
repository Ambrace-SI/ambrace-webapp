// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { SettingRow, SettingValue } from "@/components/settings/setting-rows";
import { SettingsWindow } from "@/components/settings/settings-window";
import type { SignInAccount } from "@/lib/auth/account";
import {
  DEFAULT_SETTINGS_SECTION,
  SETTINGS_SECTIONS,
  isSettingsSection,
  type SettingsSectionId,
} from "@/lib/settings/sections";
import { settingsWindow } from "@/lib/settings/settings-window";
import { themePreference } from "@/lib/theme/theme-preference";
import type { Me, ProfileUpdate } from "@/types/profile";

/**
 * Settings, used the way a student uses it: the real window, real rows and
 * real rules. Only the edges are stand-ins: the server, the sign-in service
 * and the screen's width.
 */
const saveProfile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/me", () => ({
  ME_PATH: "/api/v1/me",
  getMe: () => new Promise(() => undefined),
  saveProfile,
}));

const account = vi.hoisted(() => ({
  getSignInAccount: vi.fn(),
  changePassword: vi.fn(),
}));
vi.mock("@/lib/auth/account", () => account);

const leaveAmbrace = vi.hoisted(() => vi.fn());
vi.mock("@/lib/app/sign-out", () => ({ leaveAmbrace }));

const toast = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast }));

const ME: Me = {
  user_id: "user-1",
  onboarding_complete: true,
  profile: {
    name: "Asha Rao",
    class_level: 9,
    board: "CBSE",
    school_name: null,
    school_address: null,
    created_at: "2026-11-21T10:00:00Z",
    updated_at: "2026-11-21T10:00:00Z",
  },
};

const WITH_PASSWORD: SignInAccount = {
  email: "asha@example.com",
  method: "password",
};
const WITH_GOOGLE: SignInAccount = {
  email: "asha@example.com",
  method: "google",
};

/** The profile the server would hand back after saving a request. */
const saved = (request: ProfileUpdate): Me => ({
  ...ME,
  profile: {
    ...ME.profile!,
    board: null,
    school_name: null,
    school_address: null,
    ...request,
  },
});

/** jsdom has no screen. This gives it one of the chosen width. */
function onScreen(kind: "laptop" | "phone") {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: kind === "phone" && query.includes("max-width"),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

/** Puts the address back to a plain page, as if Settings were never opened. */
function plainAddress() {
  window.history.replaceState(null, "", "/viva?subject=science");
}

/** Renders the app's Settings window; `open` is the part its address asks for. */
function renderSettings(open: SettingsSectionId | null = "profile", me = ME) {
  if (open) window.history.replaceState(null, "", `#settings/${open}`);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  if (me) client.setQueryData(["me"], me);
  return render(
    <QueryClientProvider client={client}>
      <SettingsWindow />
    </QueryClientProvider>,
  );
}

const user = () => userEvent.setup();
const press = (name: string | RegExp) =>
  user().click(screen.getByRole("button", { name }));
/** The row for one setting, found by its name. */
const row = (label: string) =>
  screen.getByText(label, { selector: "p" }).closest("li")!;
const settings = () => screen.queryByRole("dialog", { name: "Settings" });
/** Back and Forward take a moment in a browser; so they do here. */
const historySettles = () =>
  act(() => new Promise<void>((done) => setTimeout(done, 20)));

beforeEach(() => {
  onScreen("laptop");
  plainAddress();
  saveProfile.mockReset();
  saveProfile.mockImplementation(async (request: ProfileUpdate) =>
    saved(request),
  );
  account.getSignInAccount.mockReset();
  account.getSignInAccount.mockResolvedValue(WITH_PASSWORD);
  account.changePassword.mockReset();
  account.changePassword.mockResolvedValue(undefined);
  leaveAmbrace.mockReset();
  toast.mockReset();
});

afterEach(() => vi.unstubAllGlobals());

describe("the parts of Settings", () => {
  test("are Profile, Appearance and Account, and Settings opens on Profile", () => {
    expect(SETTINGS_SECTIONS.map((section) => section.label)).toEqual([
      "Profile",
      "Appearance",
      "Account",
    ]);
    expect(DEFAULT_SETTINGS_SECTION).toBe("profile");
  });

  test("only those names are parts", () => {
    expect(isSettingsSection("account")).toBe(true);
    expect(isSettingsSection("billing")).toBe(false);
    expect(isSettingsSection("")).toBe(false);
  });
});

describe("opening and closing, kept in the address", () => {
  test("a plain address means closed", () => {
    expect(settingsWindow.section()).toBeNull();
    expect(settingsWindow.sectionOnServer()).toBeNull();
  });

  test("opening adds the part to the address and leaves the page's own address alone", () => {
    settingsWindow.open("account");

    expect(settingsWindow.section()).toBe("account");
    expect(window.location.pathname + window.location.search).toBe(
      "/viva?subject=science",
    );
    expect(window.location.hash).toBe("#settings/account");
  });

  test("with no part asked for, it opens on the first", () => {
    settingsWindow.open();

    expect(settingsWindow.section()).toBe("profile");
  });

  test.each(["#settings", "#settings/", "#settings/nonsense"])(
    "a mistyped address (%s) still opens Settings, on its first part",
    (hash) => {
      window.history.replaceState(null, "", hash);

      expect(settingsWindow.section()).toBe("profile");
    },
  );

  test("an address that only looks similar is not Settings", () => {
    window.history.replaceState(null, "", "#settingsfoo");

    expect(settingsWindow.section()).toBeNull();
  });

  test("opening is one step of history, however many parts are looked at", () => {
    const before = window.history.length;

    settingsWindow.open("profile");
    settingsWindow.open("account");
    settingsWindow.open("profile");

    expect(window.history.length).toBe(before + 1);
  });

  test("closing takes that step back, so Back does not reopen it", async () => {
    settingsWindow.open("profile");
    settingsWindow.open("account");

    settingsWindow.close();
    await historySettles();

    expect(settingsWindow.section()).toBeNull();
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/viva");
  });

  test("a window opened straight from a link has no step to take back: the address is tidied", () => {
    window.history.replaceState(null, "", "#settings/account");
    const before = window.history.length;

    settingsWindow.close();

    expect(settingsWindow.section()).toBeNull();
    expect(window.location.pathname + window.location.search).toBe(
      "/viva?subject=science",
    );
    expect(window.history.length).toBe(before);
  });

  test("closing what is already closed does nothing", () => {
    const listener = vi.fn();
    const stop = settingsWindow.subscribe(listener);

    settingsWindow.close();
    stop();

    expect(listener).not.toHaveBeenCalled();
  });

  test("everyone listening is told, until they stop", () => {
    const listener = vi.fn();
    const stop = settingsWindow.subscribe(listener);

    settingsWindow.open("profile");
    stop();
    settingsWindow.open("account");

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("the Settings window", () => {
  test("is not there until asked for", () => {
    renderSettings(null);

    expect(settings()).toBeNull();
  });

  test("prepared ahead on the server, it is closed whatever the address says", () => {
    window.history.replaceState(null, "", "#settings/profile");
    const client = new QueryClient();

    const html = renderToString(
      <QueryClientProvider client={client}>
        <SettingsWindow />
      </QueryClientProvider>,
    );

    expect(html).not.toContain("Settings");
  });

  test("opens over the page when asked, on the part asked for", async () => {
    renderSettings(null);

    act(() => settingsWindow.open("account"));

    expect(settings()).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(
      "Account",
    );
  });

  test("lists its parts as tabs, with the open one selected and described", () => {
    renderSettings("profile");

    const tabs = within(
      screen.getByRole("tablist", { name: "Settings" }),
    ).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Profile",
      "Appearance",
      "Account",
    ]);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(tabs[1].getAttribute("aria-selected")).toBe("false");
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(
      "Profile",
    );
    expect(
      screen.getByText("What your examiner knows about you."),
    ).toBeTruthy();
  });

  test("choosing another part shows it, and the address follows", async () => {
    renderSettings("profile");

    await user().click(screen.getByRole("tab", { name: "Account" }));

    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(
      "Account",
    );
    expect(window.location.hash).toBe("#settings/account");
    expect(screen.queryByText("Name")).toBeNull();
  });

  test("the parts run down the side on a laptop and across the top on a phone", () => {
    const { unmount } = renderSettings("profile");
    expect(screen.getByRole("tablist").getAttribute("aria-orientation")).toBe(
      "vertical",
    );
    unmount();

    onScreen("phone");
    renderSettings("profile");
    expect(screen.getByRole("tablist").getAttribute("aria-orientation")).toBe(
      "horizontal",
    );
  });

  test("the close button closes it", async () => {
    renderSettings("profile");

    await press("Close settings");

    await waitFor(() => expect(settings()).toBeNull());
    expect(window.location.hash).toBe("");
  });

  test("Escape closes it", async () => {
    renderSettings("profile");

    await user().keyboard("{Escape}");

    await waitFor(() => expect(settings()).toBeNull());
  });

  test("the browser's Back button closes it", async () => {
    renderSettings(null);
    act(() => settingsWindow.open("profile"));
    expect(settings()).toBeTruthy();

    window.history.back();
    await historySettles();

    expect(settings()).toBeNull();
  });
});

describe("one row", () => {
  test("a row that is only words has nothing beside them", () => {
    render(
      <ul>
        <SettingRow label="Plan" description="What you are on." />
      </ul>,
    );

    expect(screen.getByRole("listitem").textContent).toBe(
      "PlanWhat you are on.",
    );
  });

  test("while it is being changed, the form takes the place of its value and button", () => {
    render(
      <ul>
        <SettingRow
          label="Plan"
          description="What you are on."
          value="Free"
          action={<button>Edit</button>}
          editor={<p>the form</p>}
        />
      </ul>,
    );

    expect(screen.getByText("the form")).toBeTruthy();
    expect(screen.queryByText("Free")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("a value that is missing or blank says so, in the words given", () => {
    render(
      <>
        <SettingValue>{null}</SettingValue>
        <SettingValue empty="Not set">{"   "}</SettingValue>
        <SettingValue>Delhi Public School</SettingValue>
      </>,
    );

    expect(screen.getByText("Not added")).toBeTruthy();
    expect(screen.getByText("Not set")).toBeTruthy();
    expect(screen.getByText("Delhi Public School")).toBeTruthy();
  });
});

describe("Profile", () => {
  test("shows each detail as it is saved", () => {
    renderSettings("profile");

    expect(within(row("Name")).getByText("Asha Rao")).toBeTruthy();
    expect(within(row("Class")).getByText("Class 9")).toBeTruthy();
    expect(within(row("Board")).getByText("CBSE")).toBeTruthy();
    expect(within(row("School")).getByText("Not added")).toBeTruthy();
    expect(within(row("School address")).getByText("Not added")).toBeTruthy();
  });

  test("a detail that is set offers Edit; one that is missing offers Add", () => {
    renderSettings("profile");

    expect(screen.getByRole("button", { name: "Edit name" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add school" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Add school address" }),
    ).toBeTruthy();
  });

  test("until the profile is known it shows an outline, not empty rows", () => {
    renderSettings("profile", null as unknown as Me);

    expect(screen.getByRole("status").textContent).toBe("Loading your profile");
    expect(screen.queryByRole("button", { name: "Edit name" })).toBeNull();
  });
});

describe("changing a detail", () => {
  const nameField = () => screen.getByLabelText("Name") as HTMLInputElement;

  test("the row opens in place, on what is saved, with the cursor in it", async () => {
    renderSettings("profile");

    await press("Edit name");

    const editing = within(row("Name"));
    expect(nameField().value).toBe("Asha Rao");
    expect(document.activeElement).toBe(nameField());
    // The row now says what the change will do, and its own button is gone.
    expect(
      editing.getByText("Your examiner will greet you by this name."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit name" })).toBeNull();
    // No second window is stacked on Settings.
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  test("only one row is open at a time", async () => {
    renderSettings("profile");
    await press("Edit name");

    await press("Edit class");

    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(screen.getByRole("radiogroup", { name: "Class" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit name" })).toBeTruthy();
  });

  test("Save sends the whole profile with that one thing changed, and shows it at once", async () => {
    renderSettings("profile");
    await press("Edit name");

    await user().clear(nameField());
    await user().type(nameField(), "  Asha R  ");
    await press("Save");

    await waitFor(() => expect(saveProfile).toHaveBeenCalledTimes(1));
    expect(saveProfile.mock.calls[0][0]).toEqual({
      name: "Asha R",
      class_level: 9,
      board: "CBSE",
      school_name: null,
      school_address: null,
    });
    await waitFor(() =>
      expect(within(row("Name")).getByText("Asha R")).toBeTruthy(),
    );
    expect(toast).toHaveBeenCalledWith("Name updated.");
    // Settings itself stays open, with the cursor back on the row's button.
    expect(settings()).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Edit name" }),
      ),
    );
  });

  test("Enter saves, like the button", async () => {
    renderSettings("profile");
    await press("Add school");

    await user().type(screen.getByLabelText(/School name/), "DPS{Enter}");

    await waitFor(() =>
      expect(saveProfile.mock.calls[0][0]).toMatchObject({
        school_name: "DPS",
      }),
    );
  });

  test("the class is picked from all eight, entered at the chosen one, and saved", async () => {
    renderSettings("profile");
    await press("Edit class");

    const classes = within(row("Class")).getAllByRole("radio");
    expect(classes.map((chip) => chip.textContent)).toEqual([
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "12",
    ]);
    expect(document.activeElement?.textContent).toBe("9");
    await user().click(screen.getByRole("radio", { name: "10" }));
    await press("Save");

    await waitFor(() =>
      expect(saveProfile.mock.calls[0][0]).toMatchObject({ class_level: 10 }),
    );
    await waitFor(() =>
      expect(within(row("Class")).getByText("Class 10")).toBeTruthy(),
    );
  });

  test("pressing the chosen board again clears it", async () => {
    renderSettings("profile");
    await press("Edit board");

    await user().click(screen.getByRole("radio", { name: "CBSE" }));
    await press("Save");

    await waitFor(() =>
      expect(saveProfile.mock.calls[0][0]).toMatchObject({ board: null }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Add board" })).toBeTruthy(),
    );
  });

  test("an address can run over several lines", async () => {
    renderSettings("profile");
    await press("Add school address");

    await user().type(
      screen.getByLabelText(/School address/),
      "12 MG Road{Enter}Pune",
    );
    await press("Save");

    await waitFor(() =>
      expect(saveProfile.mock.calls[0][0]).toMatchObject({
        school_address: "12 MG Road\nPune",
      }),
    );
  });

  test("a name left empty is refused beside the field, and nothing is sent", async () => {
    renderSettings("profile");
    await press("Edit name");

    await user().clear(nameField());
    await press("Save");

    expect(screen.getByRole("alert").textContent).toBe(
      "Tell us what to call you.",
    );
    expect(saveProfile).not.toHaveBeenCalled();

    // The complaint goes as soon as the student starts putting it right.
    await user().type(nameField(), "A");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("Save with nothing changed just closes the row", async () => {
    renderSettings("profile");
    await press("Edit name");

    await press("Save");

    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(saveProfile).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  test("Cancel forgets what was typed", async () => {
    renderSettings("profile");
    await press("Edit name");
    await user().type(nameField(), " changed");

    await press("Cancel");
    expect(saveProfile).not.toHaveBeenCalled();
    await press("Edit name");

    expect(nameField().value).toBe("Asha Rao");
  });

  test("Escape cancels the change and leaves Settings open; a second Escape closes Settings", async () => {
    renderSettings("profile");
    await press("Edit name");
    await user().type(nameField(), " changed");

    await user().keyboard("{Escape}");

    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(settings()).toBeTruthy();
    expect(within(row("Name")).getByText("Asha Rao")).toBeTruthy();

    await user().keyboard("{Escape}");

    await waitFor(() => expect(settings()).toBeNull());
  });

  test("while it saves, the button says so, and neither Enter nor Escape gets in the way", async () => {
    saveProfile.mockReturnValue(new Promise(() => undefined));
    renderSettings("profile");
    await press("Add school");
    const field = screen.getByLabelText(/School name/);
    await user().type(field, "DPS");

    await press("Save");

    const saving = await screen.findByRole("button", { name: "Saving…" });
    expect((saving as HTMLButtonElement).disabled).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    field.focus();
    await user().keyboard("{Enter}{Escape}");
    expect(saveProfile).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/School name/)).toBeTruthy();
  });

  test("a save that fails says so and keeps the row open with what was typed", async () => {
    saveProfile.mockRejectedValue(new Error("offline"));
    renderSettings("profile");
    await press("Add school");
    await user().type(screen.getByLabelText(/School name/), "DPS");

    await press("Save");

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /couldn't save that/,
    );
    expect(
      (screen.getByLabelText(/School name/) as HTMLInputElement).value,
    ).toBe("DPS");
    expect(toast).not.toHaveBeenCalled();
  });

  test("a session that has ended says to sign in again", async () => {
    saveProfile.mockRejectedValue({ status: 401 });
    renderSettings("profile");
    await press("Add school");
    await user().type(screen.getByLabelText(/School name/), "DPS");

    await press("Save");

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /session has ended/,
    );
  });
});

describe("Appearance", () => {
  const choice = (name: string) =>
    screen.getByRole("radio", {
      name: new RegExp(`^${name}`),
    }) as HTMLInputElement;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    themePreference.reset();
  });

  test("offers light, dark and the device's own setting, with device chosen to begin with", () => {
    renderSettings("appearance");

    const group = screen.getByRole("radiogroup", { name: "Theme" });
    expect(
      within(group)
        .getAllByRole("radio")
        .map((radio) => radio.getAttribute("value")),
    ).toEqual(["light", "dark", "system"]);
    expect(choice("Device").checked).toBe(true);
  });

  test("choosing dark turns the app dark at once, and is remembered", async () => {
    renderSettings("appearance");

    await user().click(choice("Dark"));

    expect(choice("Dark").checked).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("ambrace:theme")).toBe("dark");
  });

  test("the backdrop behind the window is an Ink scrim with no blur, so it dims a dark page instead of washing it out", () => {
    renderSettings("appearance");

    const backdrop = document.querySelector('[data-slot="dialog-overlay"]')!;
    expect(backdrop.className).toContain("bg-scrim");
    expect(backdrop.className).not.toMatch(/bg-foreground|backdrop-blur/);
  });

  test("choosing light turns it back", async () => {
    renderSettings("appearance");
    await user().click(choice("Dark"));

    await user().click(choice("Light"));

    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});

describe("Account", () => {
  test("the email is shown, with nothing to press beside it", async () => {
    renderSettings("account");

    expect(
      await within(row("Email")).findByText("asha@example.com"),
    ).toBeTruthy();
    expect(within(row("Email")).queryByRole("button")).toBeNull();
  });

  test("an account with no email on record says so", async () => {
    account.getSignInAccount.mockResolvedValue({
      email: null,
      method: "password",
    });
    renderSettings("account");

    expect(await within(row("Email")).findByText("Not available")).toBeTruthy();
  });

  test("if the account cannot be read, the email says so and no password row is guessed", async () => {
    account.getSignInAccount.mockRejectedValue(new Error("no session"));
    renderSettings("account");

    expect(await within(row("Email")).findByText("Not available")).toBeTruthy();
    expect(screen.queryByText("Password")).toBeNull();
  });

  test("an account with a password can change it, and has no Google row", async () => {
    renderSettings("account");

    expect(
      await screen.findByRole("button", { name: "Change password" }),
    ).toBeTruthy();
    expect(screen.queryByText("Google")).toBeNull();
  });

  test("a Google account is shown as connected, with no password and no button that could not work", async () => {
    account.getSignInAccount.mockResolvedValue(WITH_GOOGLE);
    renderSettings("account");

    const google = (await screen.findByText("Google")).closest("li")!;
    expect(within(google).getByText("Connected")).toBeTruthy();
    expect(within(row("Password")).getByText("Not set")).toBeTruthy();
    expect(row("Password").textContent).toMatch(/through Google/);
    expect(within(row("Password")).queryByRole("button")).toBeNull();
  });

  test("signing out leaves at once and shows that it is working", async () => {
    renderSettings("account");

    await press("Sign out");

    expect(leaveAmbrace).toHaveBeenCalledTimes(1);
    const working = screen.getByRole("button", { name: "Signing out" });
    expect((working as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("changing the password", () => {
  const current = () => screen.getByLabelText("Current password");
  const next = () => screen.getByLabelText("New password");
  /** While the row is open its own button is gone; this is the form's. */
  const submit = () => press("Change password");

  async function openRow() {
    renderSettings("account");
    await user().click(
      await screen.findByRole("button", { name: "Change password" }),
    );
  }

  test("opens in its row, asks for the current password and shows the rules for the new one", async () => {
    await openRow();

    expect(document.activeElement).toBe(current());
    expect(
      within(row("Password")).getByRole("list", { name: "Password rules" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  test("changes it, says so and closes the row", async () => {
    await openRow();
    await user().type(current(), "OldPass123");
    await user().type(next(), "NewPass456");

    await submit();

    await waitFor(() =>
      expect(account.changePassword).toHaveBeenCalledWith(
        "OldPass123",
        "NewPass456",
      ),
    );
    await waitFor(() =>
      expect(screen.queryByLabelText("Current password")).toBeNull(),
    );
    expect(toast).toHaveBeenCalledWith("Password changed.");
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Change password" }),
      ),
    );
  });

  test("both boxes empty: each says what it needs, and nothing is sent", async () => {
    await openRow();

    await submit();

    const complaints = screen
      .getAllByRole("alert")
      .map((alert) => alert.textContent);
    expect(complaints).toEqual([
      "Enter your current password.",
      "Your new password doesn't meet all the rules below yet.",
    ]);
    expect(account.changePassword).not.toHaveBeenCalled();
  });

  test("the new password must differ from the current one", async () => {
    await openRow();
    await user().type(current(), "SamePass123");
    await user().type(next(), "SamePass123");

    await submit();

    expect(screen.getByRole("alert").textContent).toBe(
      "Choose a password different from your current one.",
    );
    expect(account.changePassword).not.toHaveBeenCalled();
  });

  test("a wrong current password is said beside that box, in words that fit here", async () => {
    account.changePassword.mockRejectedValue({
      name: "NotAuthorizedException",
    });
    await openRow();
    await user().type(current(), "WrongPass1");
    await user().type(next(), "NewPass456");

    await submit();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "That isn't your current password.",
    );
    // Still open, and ready for another try.
    expect(
      (
        screen.getByRole("button", {
          name: "Change password",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  test("a new password the sign-in service refuses is said beside that box", async () => {
    account.changePassword.mockRejectedValue({
      name: "InvalidPasswordException",
    });
    await openRow();
    await user().type(current(), "OldPass123");
    await user().type(next(), "NewPass456");

    await submit();

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /at least 8 characters/,
    );
  });

  test("too many attempts, or no connection, is said about the whole form", async () => {
    account.changePassword.mockRejectedValue({
      name: "LimitExceededException",
    });
    await openRow();
    await user().type(current(), "OldPass123");
    await user().type(next(), "NewPass456");

    await submit();

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /Too many attempts/,
    );
    expect(toast).not.toHaveBeenCalled();
  });

  test("Cancel closes the row without changing anything", async () => {
    await openRow();
    await user().type(current(), "OldPass123");

    await press("Cancel");

    expect(screen.queryByLabelText("Current password")).toBeNull();
    expect(account.changePassword).not.toHaveBeenCalled();
  });
});
