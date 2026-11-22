// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { AppShell } from "@/components/app/app-shell";
import { HistoryOutline } from "@/components/app/history-list";
import { useSidebar } from "@/components/ui/sidebar";
import { panelPreference } from "@/lib/app/panel-preference";
import { useWholeScreen } from "@/lib/app/whole-screen";
import type { Me } from "@/types/profile";
import type { HistoryResponse, VivaSessionSummary } from "@/types/viva";

/**
 * The side panel, used the way a student uses it: real panel, real list, real
 * menus and search. Only the edges are stand-ins (the server, the address
 * bar, and the screen's width).
 */
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    onClick?: () => void;
  }) => (
    <a
      href={href}
      {...rest}
      onClick={(event) => {
        // jsdom cannot navigate; the test only needs to know it was pressed.
        event.preventDefault();
        onClick?.();
      }}
    >
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span>{alt}</span>,
}));

const address = vi.hoisted(() => ({
  pathname: "/",
  search: "",
  push: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => address.pathname,
  useSearchParams: () => new URLSearchParams(address.search),
  useRouter: () => ({ push: address.push, replace: address.replace }),
}));

const api = vi.hoisted(() => ({
  getHistory: vi.fn(),
  renameViva: vi.fn(),
  deleteViva: vi.fn(),
}));
vi.mock("@/lib/api/history", () => api);

const leaveAmbrace = vi.hoisted(() => vi.fn());
vi.mock("@/lib/app/sign-out", () => ({ leaveAmbrace }));

const { toast, toastError } = vi.hoisted(() => {
  const toastError = vi.fn();
  return { toastError, toast: Object.assign(vi.fn(), { error: toastError }) };
});
vi.mock("sonner", () => ({ toast, Toaster: () => null }));

vi.mock("@/lib/api/me", () => ({
  ME_PATH: "/api/v1/me",
  getMe: () => new Promise(() => undefined),
  saveProfile: vi.fn(),
}));

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

function viva(
  id: string,
  title: string,
  changes: Partial<VivaSessionSummary> = {},
): VivaSessionSummary {
  return {
    viva_session_id: id,
    title,
    topic: title,
    class_level: "9",
    started_at: "2026-11-21T10:00:00Z",
    session_type: "viva",
    status: "completed",
    ...changes,
  };
}

const NEWEST: HistoryResponse = {
  sessions: [
    viva("a", "Electricity"),
    viva("b", "Metals and Non-metals"),
    viva("c", "Motion", { status: "abandoned" }),
  ],
  next_cursor: null,
};

/** jsdom has no screen. This gives it one of the chosen width. */
function onScreen(kind: "laptop" | "phone") {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      // Only the width question is answered yes; motion preferences are not.
      matches: kind === "phone" && query.includes("max-width"),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
}

function renderShell(me: Me | null = ME) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  if (me) client.setQueryData(["me"], me);
  return render(
    <QueryClientProvider client={client}>
      <AppShell>
        <p>the page</p>
      </AppShell>
    </QueryClientProvider>,
  );
}

const panel = () => screen.getByRole("navigation");
const row = (name: RegExp) => screen.findByRole("link", { name });
const press = (name: string | RegExp, role = "button") =>
  userEvent.setup().click(screen.getByRole(role, { name }));

/**
 * The fold button in the panel itself. The phone's top bar has one too; a
 * laptop hides that bar with CSS, which jsdom does not apply.
 */
const fold = () =>
  userEvent
    .setup()
    .click(within(panel()).getByRole("button", { name: /the side panel/ }));

async function openRowMenu(title: string) {
  await press(`More options for ${title}`);
}

beforeEach(() => {
  // Radix menus and tooltips measure and scroll; jsdom does neither.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = () => undefined;
  Element.prototype.hasPointerCapture = () => false;
  onScreen("laptop");

  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
  panelPreference.remember(true);
  address.pathname = "/";
  address.search = "";
  address.push.mockReset();
  address.replace.mockReset();
  leaveAmbrace.mockReset();
  toast.mockReset();
  toastError.mockReset();
  for (const mock of Object.values(api)) mock.mockReset();
  api.getHistory.mockResolvedValue(NEWEST);
  api.renameViva.mockResolvedValue(undefined);
  api.deleteViva.mockResolvedValue(undefined);
});

describe("the frame around every page", () => {
  test("puts the panel beside the page, with the ways to move about", async () => {
    renderShell();

    expect(screen.getByText("the page")).toBeTruthy();
    expect(panel().getAttribute("aria-label")).toBe("Your vivas and account");
    expect(
      screen.getByRole("link", { name: "New viva" }).getAttribute("href"),
    ).toBe("/");
    // The logo leads home, in the panel and in the phone's top bar.
    for (const logo of screen.getAllByRole("link", { name: "Ambrace" }))
      expect(logo.getAttribute("href")).toBe("/");
    await row(/Electricity/);
  });

  test("prepared ahead on the server, it is laid out as a laptop with the panel open", () => {
    // No screen and no stored preference exist there; nothing may be asked.
    vi.stubGlobal("matchMedia", undefined);
    panelPreference.remember(false);
    const client = new QueryClient();
    client.setQueryData(["me"], ME);

    const html = renderToString(
      <QueryClientProvider client={client}>
        <AppShell>
          <p>the page</p>
        </AppShell>
      </QueryClientProvider>,
    );

    expect(html).toContain("New viva");
    expect(html).toContain("Loading your vivas");
    expect(html).toContain("the page");
  });

  test("the list has an outline of its own for a page still being prepared", () => {
    render(<HistoryOutline />);

    expect(screen.getByRole("heading", { name: "Your vivas" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Loading your vivas");
  });

  test("the panel's parts refuse to work outside the panel's frame", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const Lost = () => <p>{useSidebar().state}</p>;

    expect(() => render(<Lost />)).toThrow(/within a SidebarProvider/);
  });
});

describe("the page the student is on", () => {
  const newViva = () => screen.getByRole("link", { name: "New viva" });

  test("New viva is marked on home, where a viva is chosen", () => {
    address.pathname = "/";
    renderShell();

    expect(newViva().getAttribute("aria-current")).toBe("page");
    expect(newViva().getAttribute("data-active")).toBe("true");
  });

  test("and is not marked anywhere else", () => {
    address.pathname = "/v";
    renderShell();

    expect(newViva().getAttribute("aria-current")).toBeNull();
    expect(newViva().getAttribute("data-active")).toBe("false");
  });
});

describe("a page that needs the whole screen", () => {
  let built = 0;
  beforeEach(() => {
    built = 0;
  });

  /** Stands in for the viva room: a setup screen, then a live one. */
  function Room() {
    const [live, setLive] = useState(false);
    // Counts how often the page is built from nothing.
    useState(() => built++);
    useWholeScreen(live);
    return (
      <button onClick={() => setLive(!live)}>
        {live ? "end the viva" : "begin the viva"}
      </button>
    );
  }

  function renderRoom() {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(["me"], ME);
    const page = (room: boolean) => (
      <QueryClientProvider client={client}>
        <AppShell>{room ? <Room /> : <p>another page</p>}</AppShell>
      </QueryClientProvider>
    );
    const view = render(page(true));
    return { leave: () => view.rerender(page(false)) };
  }

  test("has the panel beside it until it asks", () => {
    renderRoom();

    expect(screen.getByRole("navigation")).toBeTruthy();
  });

  test("asking puts the panel away, and handing the screen back returns it", async () => {
    renderRoom();

    await press("begin the viva");

    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("link", { name: "New viva" })).toBeNull();

    await press("end the viva");

    expect(screen.getByRole("navigation")).toBeTruthy();
  });

  test("the page is never built again when the panel goes or comes back", async () => {
    // Building it again would throw away a viva that had just begun.
    renderRoom();

    await press("begin the viva");
    await press("end the viva");

    expect(built).toBe(1);
  });

  test("leaving the page hands the screen back by itself", async () => {
    const room = renderRoom();
    await press("begin the viva");

    room.leave();

    expect(screen.getByText("another page")).toBeTruthy();
    expect(screen.getByRole("navigation")).toBeTruthy();
  });

  test("with the panel away, search cannot be opened from the keyboard", async () => {
    renderRoom();
    await press("begin the viva");

    await userEvent.setup().keyboard("{Control>}k{/Control}");

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("on a phone, the bar that opens the drawer goes too", async () => {
    onScreen("phone");
    renderRoom();
    expect(
      screen.getByRole("button", { name: "Open the side panel" }),
    ).toBeTruthy();

    await press("begin the viva");

    expect(
      screen.queryByRole("button", { name: "Open the side panel" }),
    ).toBeNull();
  });
});

describe("the list of past vivas", () => {
  test("a finished viva links to its report and shows when it was, with no score", async () => {
    renderShell();

    const link = await row(/Electricity/);

    expect(link.getAttribute("href")).toBe("/v?id=a");
    expect(link.textContent).toMatch(/^Electricity21 Nov( \d{4})?$/);
  });

  test("a viva that ended early is listed, and pressing it says there is no report", async () => {
    renderShell();
    await row(/Electricity/);
    expect(screen.queryByRole("link", { name: /Motion/ })).toBeNull();

    await press(/Motion.*Ended early/);

    expect(toast).toHaveBeenCalledWith(
      "This viva ended early, so there's no report for it.",
    );
    expect(address.push).not.toHaveBeenCalled();
  });

  test("a viva still running says its report comes at the end", async () => {
    api.getHistory.mockResolvedValue({
      sessions: [viva("d", "Sound", { status: "in_progress" })],
      next_cursor: null,
    });
    renderShell();

    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: /Sound.*In progress/ }));

    expect(toast).toHaveBeenCalledWith(
      "This viva is still in progress. Its report comes at the end.",
    );
  });

  test("the report on screen is marked as the current one", async () => {
    address.pathname = "/v";
    address.search = "id=b";
    renderShell();

    expect((await row(/Metals/)).getAttribute("aria-current")).toBe("page");
    expect((await row(/Electricity/)).getAttribute("aria-current")).toBeNull();
  });

  test("the row under the pointer is highlighted, except the current one", async () => {
    address.pathname = "/v";
    address.search = "id=b";
    const { container } = renderShell();
    const glide = () => container.querySelector("li > span[aria-hidden]");
    const item = (link: HTMLElement) => link.closest("li")!;

    fireEvent.pointerEnter(item(await row(/Electricity/)));
    expect(item(await row(/Electricity/)).contains(glide())).toBe(true);

    // The current report already stands out; it takes no second highlight.
    fireEvent.pointerEnter(item(await row(/Metals/)));
    expect(glide()).toBeNull();

    fireEvent.pointerEnter(item(await row(/Electricity/)));
    fireEvent.pointerLeave(screen.getAllByRole("list")[1]);
    expect(glide()).toBeNull();
  });

  test("shows an outline, announced to screen readers, while it loads", () => {
    api.getHistory.mockReturnValue(new Promise(() => undefined));

    renderShell();

    expect(screen.getByRole("status").textContent).toBe("Loading your vivas");
  });

  test("with no vivas yet, says what will appear here", async () => {
    api.getHistory.mockResolvedValue({ sessions: [], next_cursor: null });

    renderShell();

    expect(await screen.findByText(/Your reports collect here/)).toBeTruthy();
  });

  test("a failed load says so, and trying again brings the list", async () => {
    api.getHistory.mockRejectedValueOnce(new Error("offline"));
    renderShell();
    await screen.findByText(/couldn't load your vivas/);

    await press("Try again");

    await row(/Electricity/);
  });

  test("older vivas are fetched on request, and the offer goes when none are left", async () => {
    api.getHistory.mockImplementation((cursor?: string) =>
      Promise.resolve(
        cursor
          ? { sessions: [viva("z", "Sound")], next_cursor: null }
          : { ...NEWEST, next_cursor: "c" },
      ),
    );
    renderShell();
    await row(/Electricity/);

    await press("Show older vivas");

    await row(/Sound/);
    expect(api.getHistory).toHaveBeenLastCalledWith("c");
    expect(screen.queryByRole("button", { name: /older vivas/ })).toBeNull();
  });

  test("says so while older vivas load, and when they could not be loaded", async () => {
    let fail: (error: Error) => void = () => undefined;
    api.getHistory.mockImplementation((cursor?: string) =>
      cursor
        ? new Promise((_, reject) => {
            fail = reject;
          })
        : Promise.resolve({ ...NEWEST, next_cursor: "c" }),
    );
    renderShell();
    await row(/Electricity/);

    await press("Show older vivas");
    const loading = await screen.findByRole("button", { name: "Loading" });
    expect((loading as HTMLButtonElement).disabled).toBe(true);

    fail(new Error("offline"));

    await screen.findByRole("button", {
      name: "Couldn't load more. Try again",
    });
    // What was already on screen stays there.
    expect(screen.getByRole("link", { name: /Electricity/ })).toBeTruthy();
  });
});

describe("folding the panel", () => {
  test("folded, it keeps its icons and hides the list; unfolding brings it back", async () => {
    renderShell();
    await row(/Electricity/);

    await fold();

    expect(screen.queryByRole("link", { name: /Electricity/ })).toBeNull();
    expect(screen.getByRole("link", { name: "New viva" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Search vivas" })).toBeTruthy();

    await press("Show your vivas");

    await row(/Electricity/);
  });

  test("the choice is remembered for the next visit", async () => {
    renderShell();

    await fold();

    expect(panelPreference.isOpen()).toBe(false);
    expect(
      within(panel())
        .getByRole("button", { name: "Open the side panel" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  test("Ctrl+B folds and unfolds it from the keyboard", async () => {
    renderShell();
    await row(/Electricity/);

    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: /Electricity/ })).toBeNull(),
    );

    fireEvent.keyDown(window, { key: "b", metaKey: true });
    await row(/Electricity/);
  });

  test("a plain B typed anywhere does nothing", async () => {
    renderShell();
    await row(/Electricity/);

    fireEvent.keyDown(window, { key: "b" });

    expect(panelPreference.isOpen()).toBe(true);
  });
});

describe("renaming a viva", () => {
  async function startRenaming() {
    renderShell();
    await row(/Electricity/);
    await openRowMenu("Electricity");
    await press("Rename", "menuitem");
    return screen.findByRole("textbox", { name: "New name for Electricity" });
  }

  test("opens the name for editing, already selected and in focus", async () => {
    const field = (await startRenaming()) as HTMLInputElement;

    expect(field.value).toBe("Electricity");
    await waitFor(() => expect(document.activeElement).toBe(field));
  });

  test("Enter saves the new name and shows it at once", async () => {
    // The server has not answered yet: the new name shows on the press.
    api.renameViva.mockReturnValue(new Promise(() => undefined));
    const field = await startRenaming();
    const user = userEvent.setup();

    await user.clear(field);
    await user.type(field, "  Volts and amps {Enter}");

    expect(api.renameViva).toHaveBeenCalledWith("a", "Volts and amps");
    await row(/Volts and amps/);
  });

  test("clicking away saves too", async () => {
    const field = await startRenaming();
    const user = userEvent.setup();

    await user.clear(field);
    await user.type(field, "Circuits");
    await user.click(screen.getByText("the page"));

    expect(api.renameViva).toHaveBeenCalledWith("a", "Circuits");
  });

  test("Escape leaves the name as it was", async () => {
    const field = await startRenaming();
    const user = userEvent.setup();

    await user.clear(field);
    await user.type(field, "Circuits{Escape}");

    await row(/Electricity/);
    expect(api.renameViva).not.toHaveBeenCalled();
  });

  test.each([
    ["the same name", "Electricity"],
    ["nothing but spaces", "   "],
  ])("%s is not sent to the server", async (_, typed) => {
    const field = await startRenaming();
    const user = userEvent.setup();

    await user.clear(field);
    await user.type(field, `${typed}{Enter}`);

    await row(/Electricity/);
    expect(api.renameViva).not.toHaveBeenCalled();
  });

  test("a refused rename says so and puts the old name back", async () => {
    api.renameViva.mockRejectedValue(new Error("offline"));
    const field = await startRenaming();
    const user = userEvent.setup();

    await user.clear(field);
    await user.type(field, "Circuits{Enter}");

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Couldn't rename that viva. Try again.",
      ),
    );
    await row(/Electricity/);
  });
});

describe("deleting a viva", () => {
  async function askToDelete(title = "Electricity") {
    renderShell();
    await row(/Electricity/);
    await openRowMenu(title);
    await press("Delete", "menuitem");
    return screen.findByRole("dialog");
  }

  test("asks first, naming the viva and saying it cannot be undone", async () => {
    const question = await askToDelete();

    expect(question.textContent).toMatch(/Delete this viva\?/);
    expect(question.textContent).toMatch(/“Electricity”.*for good/);
    expect(api.deleteViva).not.toHaveBeenCalled();
  });

  test("Cancel keeps it", async () => {
    await askToDelete();

    await press("Cancel");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.deleteViva).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /Electricity/ })).toBeTruthy();
  });

  test("dismissing the question keeps it too", async () => {
    await askToDelete();

    await userEvent.setup().keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.deleteViva).not.toHaveBeenCalled();
  });

  test("Delete removes it from the list at once", async () => {
    // The server has not answered yet: the row is gone on the press.
    api.deleteViva.mockReturnValue(new Promise(() => undefined));
    await askToDelete();

    await press("Delete");

    expect(api.deleteViva).toHaveBeenCalledWith("a");
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: /Electricity/ })).toBeNull(),
    );
    expect(address.replace).not.toHaveBeenCalled();
  });

  test("a viva with no report can be deleted as well", async () => {
    api.deleteViva.mockReturnValue(new Promise(() => undefined));
    await askToDelete("Motion");

    await press("Delete");

    expect(api.deleteViva).toHaveBeenCalledWith("c");
  });

  test("deleting the report on screen goes home, not to a missing page", async () => {
    address.pathname = "/v";
    address.search = "id=a";
    await askToDelete();

    await press("Delete");

    expect(address.replace).toHaveBeenCalledWith("/");
  });

  test("a refused delete says so and puts the viva back", async () => {
    api.deleteViva.mockRejectedValue(new Error("offline"));
    await askToDelete();

    await press("Delete");

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Couldn't delete that viva. Try again.",
      ),
    );
    await row(/Electricity/);
  });
});

describe("searching", () => {
  async function openSearch() {
    renderShell();
    await row(/Electricity/);
    await press("Search vivas");
    return screen.findByRole("textbox", { name: "Search your vivas" });
  }
  const results = () =>
    screen
      .getAllByRole("link")
      .filter((link) => link.closest("[role=dialog]"))
      .map((link) => link.getAttribute("href"));

  test("while closed it does not ask for the list; opening it does", async () => {
    // Asking early would fetch the list before the panel is ready to show
    // it, and the page would then disagree with what the server sent.
    panelPreference.remember(false);
    renderShell();
    expect(api.getHistory).not.toHaveBeenCalled();

    await press("Search vivas");

    await waitFor(() => expect(api.getHistory).toHaveBeenCalledTimes(1));
  });

  test("opens on the most recent reports, leaving out vivas that have none", async () => {
    await openSearch();

    expect(screen.getByText("Recent")).toBeTruthy();
    expect(results()).toEqual(["/v?id=a", "/v?id=b"]);
  });

  test("typing narrows the list to what matches", async () => {
    const field = await openSearch();

    await userEvent.setup().type(field, "metal");

    expect(screen.getByText("Matches")).toBeTruthy();
    expect(results()).toEqual(["/v?id=b"]);
  });

  test("Enter opens the first match and closes search", async () => {
    const field = await openSearch();

    await userEvent.setup().type(field, "metal{Enter}");

    expect(address.push).toHaveBeenCalledWith("/v?id=b");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  test("choosing a result closes search", async () => {
    await openSearch();

    await userEvent
      .setup()
      .click(
        screen
          .getAllByRole("link", { name: /Electricity/ })
          .find((link) => link.closest("[role=dialog]"))!,
      );

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  test("with no match it says so, and Enter goes nowhere", async () => {
    const field = await openSearch();

    await userEvent.setup().type(field, "geometry{Enter}");

    expect(screen.getByText("No viva matches that.")).toBeTruthy();
    expect(address.push).not.toHaveBeenCalled();
  });

  test("what was typed is cleared when search is closed", async () => {
    const field = await openSearch();
    const user = userEvent.setup();
    await user.type(field, "metal");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await press("Search vivas");

    const reopened = await screen.findByRole("textbox", {
      name: "Search your vivas",
    });
    expect((reopened as HTMLInputElement).value).toBe("");
  });

  test("Ctrl+K opens search from anywhere; a plain K does not", async () => {
    renderShell();
    await row(/Electricity/);

    fireEvent.keyDown(window, { key: "k" });
    fireEvent.keyDown(window, { key: "x", ctrlKey: true });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.keyDown(window, { key: "K", ctrlKey: true });

    await screen.findByRole("textbox", { name: "Search your vivas" });
  });

  test("when older vivas are not loaded, it offers to fetch them instead of saying there is no match", async () => {
    let arrive: (page: HistoryResponse) => void = () => undefined;
    api.getHistory.mockImplementation((cursor?: string) =>
      cursor
        ? new Promise((resolve) => {
            arrive = resolve;
          })
        : Promise.resolve({ ...NEWEST, next_cursor: "c" }),
    );
    const field = await openSearch();
    const user = userEvent.setup();

    await user.type(field, "sound");
    expect(
      screen.getByText("No match in the vivas loaded so far."),
    ).toBeTruthy();

    await press("Load older vivas to search");
    expect(
      (await screen.findByRole("button", { name: "Loading" })).hasAttribute(
        "disabled",
      ),
    ).toBe(true);
    arrive({ sessions: [viva("z", "Sound")], next_cursor: null });

    await waitFor(() => expect(results()).toEqual(["/v?id=z"]));
  });

  test("before the first viva, it says reports will appear here", async () => {
    api.getHistory.mockResolvedValue({ sessions: [], next_cursor: null });
    renderShell();
    await screen.findByText(/Your reports collect here/);

    await press("Search vivas");

    expect(
      await screen.findByText(/reports will appear here after your first/),
    ).toBeTruthy();
  });
});

describe("the account menu", () => {
  test("shows who is signed in, with their class and board", () => {
    renderShell();

    const account = screen.getByRole("button", {
      name: "Account menu for Asha Rao",
    });
    expect(account.textContent).toBe("AAsha RaoClass 9 · CBSE");
  });

  test("a student with no board shows the class alone", () => {
    renderShell({ ...ME, profile: { ...ME.profile!, board: null } });

    expect(
      screen.getByRole("button", { name: /Account menu/ }).textContent,
    ).toBe("AAsha RaoClass 9");
  });

  test("until the profile is known it does not guess a name", () => {
    renderShell(null);

    expect(
      screen.getByRole("button", { name: "Account menu for Your account" })
        .textContent,
    ).toBe("YYour account");
  });

  test("Settings is in the menu, above the way out, and opens the Settings window", async () => {
    renderShell();
    await press("Account menu for Asha Rao");
    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(["Settings", "Sign out"]);

    await press("Settings", "menuitem");

    expect(
      await screen.findByRole("dialog", { name: "Settings" }),
    ).toBeTruthy();
    expect(window.location.hash).toBe("#settings/profile");
  });

  test("the theme is not in the menu: it lives in Settings, under Appearance", async () => {
    renderShell();
    await press("Account menu for Asha Rao");

    expect(screen.queryAllByRole("menuitemradio")).toHaveLength(0);
    expect(screen.queryByText("Theme")).toBeNull();
  });

  test("on a phone, opening Settings puts the drawer away first", async () => {
    onScreen("phone");
    renderShell();
    await press("Open the side panel");
    await press("Account menu for Asha Rao");

    await press("Settings", "menuitem");

    expect(
      await screen.findByRole("dialog", { name: "Settings" }),
    ).toBeTruthy();
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Your vivas and account" }),
      ).toBeNull(),
    );
  });

  test("Settings cannot open over a page that has the whole screen", async () => {
    function Viva() {
      useWholeScreen(true);
      return <p>a viva</p>;
    }
    window.history.replaceState(null, "", "#settings/profile");
    const client = new QueryClient();
    client.setQueryData(["me"], ME);

    render(
      <QueryClientProvider client={client}>
        <AppShell>
          <Viva />
        </AppShell>
      </QueryClientProvider>,
    );

    expect(screen.getByText("a viva")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("signing out is one step inside the menu, and shows that it is working", async () => {
    renderShell();
    await press("Account menu for Asha Rao");

    await press("Sign out", "menuitem");

    expect(leaveAmbrace).toHaveBeenCalledTimes(1);
    const working = await screen.findByRole("menuitem", {
      name: "Signing out",
    });
    expect(working.getAttribute("aria-disabled")).toBe("true");
  });
});

describe("on a phone", () => {
  beforeEach(() => onScreen("phone"));

  test("the panel is a drawer, closed until asked for", async () => {
    renderShell();

    expect(screen.queryByRole("link", { name: "New viva" })).toBeNull();
    expect(screen.getByText("the page")).toBeTruthy();

    await press("Open the side panel");

    const drawer = await screen.findByRole("dialog", {
      name: "Your vivas and account",
    });
    expect(drawer.textContent).toMatch(/New viva/);
    await row(/Electricity/);
  });

  test("choosing where to go puts the drawer away", async () => {
    renderShell();
    await press("Open the side panel");

    await userEvent.setup().click(await row(/Electricity/));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // Opening the drawer never changes the laptop preference.
    expect(panelPreference.isOpen()).toBe(true);
  });

  test("Ctrl+K opens the drawer along with search", async () => {
    renderShell();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    await screen.findByRole("textbox", { name: "Search your vivas" });
    // The drawer is open underneath, with search on top of it.
    expect(screen.getByText("New viva")).toBeTruthy();
  });

  test("the row menu opens below its button, where a thumb expects it", async () => {
    renderShell();
    await press("Open the side panel");
    await row(/Electricity/);

    await openRowMenu("Electricity");

    expect((await screen.findByRole("menu")).getAttribute("data-side")).toBe(
      "bottom",
    );
  });
});
