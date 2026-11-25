// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
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

import { GroupPage } from "@/components/teach/group-page";
import { NewGroupDialog } from "@/components/teach/group-name-dialog";
import { TeachHome } from "@/components/teach/teach-home";
import { TeachSidebar } from "@/components/teach/teach-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { newGroupDialog } from "@/lib/groups/new-group-dialog";
import type { GroupDetail, GroupSummary } from "@/types/groups";
import type { Me } from "@/types/profile";

/**
 * The teacher's screens over the real query hooks; only the API, the address
 * bar, analytics and toasts are stand-ins.
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
  pathname: "/teach/group",
  search: "id=g1",
  push: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => address.pathname,
  useSearchParams: () => new URLSearchParams(address.search),
  useRouter: () => ({ push: address.push, replace: address.replace }),
}));

const analytics = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@/lib/analytics/events", () => ({ track: analytics.track }));

const { toast } = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast, Toaster: () => null }));

const groupsApi = vi.hoisted(() => ({
  listOwnedGroups: vi.fn(),
  createGroup: vi.fn(),
  getGroup: vi.fn(),
  listAssignments: vi.fn(),
  renameGroup: vi.fn(),
  replaceJoinCode: vi.fn(),
  removeMember: vi.fn(),
  deleteGroup: vi.fn(),
}));
vi.mock("@/lib/groups/api", () => groupsApi);

vi.mock("@/lib/app/sign-out", () => ({ leaveAmbrace: vi.fn() }));

const TEACHER: Me = {
  user_id: "teacher",
  onboarding_complete: true,
  profile: {
    name: "Meera Sharma",
    account_type: "teacher",
    class_level: null,
    board: null,
    school_name: null,
    school_address: null,
    created_at: "2026-11-24T09:00:00Z",
    updated_at: "2026-11-24T09:00:00Z",
  },
};
const PARENT: Me = {
  ...TEACHER,
  profile: { ...TEACHER.profile!, account_type: "parent" },
};

const SUMMARY: GroupSummary = {
  group_id: "g1",
  name: "Class 9-A",
  class_level: 9,
  member_count: 2,
  join_code: "K7QX2M",
  created_at: "2026-11-24T09:00:00Z",
};
const GROUP: GroupDetail = {
  ...SUMMARY,
  members: [
    {
      student_id: "riya",
      name: "Riya Verma",
      class_level: 9,
      joined_at: "2026-11-24T10:00:00Z",
    },
    {
      student_id: "aman",
      name: "Aman Gupta",
      class_level: 9,
      joined_at: "2026-11-24T10:05:00Z",
    },
  ],
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

function renderWith(ui: ReactNode, me: Me = TEACHER) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["me"], me);
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { client, user: userEvent.setup() };
}

beforeEach(() => {
  Object.values(groupsApi).forEach((fn) => fn.mockReset());
  groupsApi.listAssignments.mockResolvedValue([]);
  analytics.track.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
  address.push.mockReset();
  address.replace.mockReset();
  address.pathname = "/teach/group";
  address.search = "id=g1";
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  act(() => newGroupDialog.close());
});

describe("the teacher's start page", () => {
  test("a first visit explains the idea and offers to create a group", async () => {
    groupsApi.listOwnedGroups.mockResolvedValue([]);
    const { user } = renderWith(<TeachHome />);

    await screen.findByRole("heading", { name: "Set up your first group" });
    expect(screen.getByText("Share the link")).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Create your first group" }),
    );
    expect(newGroupDialog.isOpen()).toBe(true);
  });

  test("a parent is spoken to about children, not students", async () => {
    groupsApi.listOwnedGroups.mockResolvedValue([]);
    renderWith(<TeachHome />, PARENT);

    await screen.findByText("One group for your children.");
    expect(screen.getByText(/join with one tap/).textContent).toMatch(
      /Your children/,
    );
  });

  test("lists each group with its class and size, linking to it", async () => {
    groupsApi.listOwnedGroups.mockResolvedValue([SUMMARY]);
    renderWith(<TeachHome />);

    const card = await screen.findByRole("link", { name: /Class 9-A/ });
    expect(card.getAttribute("href")).toBe("/teach/group?id=g1");
    expect(within(card).getByText("Class 9 · 2 students")).toBeTruthy();
    // The join code lives in the group's invite panel, not on the card.
    expect(within(card).queryByText("K7QX2M")).toBeNull();
  });

  test("a failed load offers a retry", async () => {
    groupsApi.listOwnedGroups.mockRejectedValueOnce(failure(503));
    groupsApi.listOwnedGroups.mockResolvedValueOnce([SUMMARY]);
    const { user } = renderWith(<TeachHome />);

    await user.click(await screen.findByRole("button", { name: "Try again" }));

    await screen.findByRole("link", { name: /Class 9-A/ });
  });

  test("shows an outline while the groups load", () => {
    groupsApi.listOwnedGroups.mockReturnValue(new Promise(() => undefined));
    renderWith(<TeachHome />);

    expect(
      screen.getByRole("status", { name: "Loading your groups" }),
    ).toBeTruthy();
  });
});

describe("creating a group", () => {
  test("needs a name, then opens the new group", async () => {
    groupsApi.createGroup.mockResolvedValue({ ...GROUP, members: [] });
    const { user } = renderWith(<NewGroupDialog />);
    act(() => newGroupDialog.open());

    await user.click(
      await screen.findByRole("button", { name: "Create group" }),
    );
    expect(screen.getByText("Give the group a name.")).toBeTruthy();
    expect(groupsApi.createGroup).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Group name"), "  Class 9-A ");
    await user.click(screen.getByRole("radio", { name: "9" }));
    await user.click(screen.getByRole("button", { name: "Create group" }));

    await waitFor(() =>
      expect(address.push).toHaveBeenCalledWith("/teach/group?id=g1"),
    );
    expect(groupsApi.createGroup).toHaveBeenCalledWith({
      name: "Class 9-A",
      class_level: 9,
    });
    expect(analytics.track).toHaveBeenCalledWith("group_created", {
      class_level: 9,
    });
    expect(newGroupDialog.isOpen()).toBe(false);
  });

  test("a failed save keeps the window open and says so", async () => {
    groupsApi.createGroup.mockRejectedValue(failure(503));
    const { user } = renderWith(<NewGroupDialog />);
    act(() => newGroupDialog.open());

    await user.type(await screen.findByLabelText("Group name"), "Tuition");
    await user.click(screen.getByRole("button", { name: "Create group" }));

    await screen.findByText(/couldn't save that/);
    expect(newGroupDialog.isOpen()).toBe(true);
  });

  test("names with hidden characters are refused before sending", async () => {
    const { user } = renderWith(<NewGroupDialog />);
    act(() => newGroupDialog.open());

    await user.click(await screen.findByLabelText("Group name"));
    await user.paste("9‮A");
    await user.click(screen.getByRole("button", { name: "Create group" }));

    expect(screen.getByText(/character we can't use/)).toBeTruthy();
    expect(groupsApi.createGroup).not.toHaveBeenCalled();
  });
});

describe("a group's page", () => {
  /** Invite, students, rename and delete live behind the ⋯ menu. */
  async function choose(
    user: ReturnType<typeof userEvent.setup>,
    item: string,
  ) {
    await user.click(
      await screen.findByRole("button", { name: "Group options" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: item }));
  }

  test("shows only the vivas, with everything else in the menu", async () => {
    groupsApi.getGroup.mockResolvedValue(GROUP);
    const { user } = renderWith(<GroupPage />);

    await screen.findByRole("heading", { name: "Class 9-A" });
    expect(groupsApi.getGroup).toHaveBeenCalledWith("g1");
    await screen.findByRole("heading", { name: "No vivas yet" });
    expect(screen.queryByLabelText(/Join code/)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Group options" }));
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Invite students",
      "Students2",
      "Rename group",
      "Delete group",
    ]);
  });

  test("names who is in the group under its title; tapping opens the list", async () => {
    groupsApi.getGroup.mockResolvedValue(GROUP);
    const { user } = renderWith(<GroupPage />);

    await user.click(
      await screen.findByRole("button", { name: "Aman Gupta, Riya Verma" }),
    );

    await screen.findByRole("dialog", { name: "Students · 2" });
  });

  test("with no one in it, the line under the title invites them", async () => {
    groupsApi.getGroup.mockResolvedValue({
      ...GROUP,
      member_count: 0,
      members: [],
    });
    const { user } = renderWith(<GroupPage />);

    await user.click(
      await screen.findByRole("button", {
        name: "No students yet. Tap to invite them.",
      }),
    );

    await screen.findByRole("dialog", { name: "Invite students" });
  });

  test("the invite panel has the code, the link and ways to share them", async () => {
    groupsApi.getGroup.mockResolvedValue(GROUP);
    const { user } = renderWith(<GroupPage />);

    await choose(user, "Invite students");

    const panel = await screen.findByRole("dialog", {
      name: "Invite students",
    });
    expect(within(panel).getByLabelText("Join code K 7 Q X 2 M")).toBeTruthy();
    expect(
      within(panel).getByText("http://localhost:3000/join?code=K7QX2M"),
    ).toBeTruthy();
    await user.click(within(panel).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  test("copying the link puts it on the clipboard", async () => {
    groupsApi.getGroup.mockResolvedValue(GROUP);
    const { user } = renderWith(<GroupPage />);
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);

    await choose(user, "Invite students");
    await user.click(await screen.findByRole("button", { name: "Copy link" }));

    expect(writeText).toHaveBeenCalledWith(
      "http://localhost:3000/join?code=K7QX2M",
    );
    expect(toast.success).toHaveBeenCalledWith("Link copied");
    expect(analytics.track).toHaveBeenCalledWith("group_invite_shared", {
      via: "copy_link",
    });
  });

  test("a clipboard that refuses is explained", async () => {
    groupsApi.getGroup.mockResolvedValue(GROUP);
    const { user } = renderWith(<GroupPage />);
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("denied"),
    );

    await choose(user, "Invite students");
    await user.click(await screen.findByRole("button", { name: "Copy code" }));

    expect(toast.error).toHaveBeenCalledWith(
      "Couldn't copy the code. Select it and copy it instead.",
    );
  });

  test("WhatsApp gets a message with the link", async () => {
    groupsApi.getGroup.mockResolvedValue(GROUP);
    const { user } = renderWith(<GroupPage />);

    await choose(user, "Invite students");
    const share = await screen.findByRole("link", {
      name: "Share on WhatsApp",
    });

    expect(decodeURIComponent(share.getAttribute("href") ?? "")).toBe(
      'https://wa.me/?text=Join "Class 9-A" on Ambrace: http://localhost:3000/join?code=K7QX2M',
    );
  });

  test("a new code is only made after saying what happens to the old one", async () => {
    groupsApi.getGroup.mockResolvedValue(GROUP);
    groupsApi.replaceJoinCode.mockResolvedValue({
      ...SUMMARY,
      join_code: "P3RT9W",
    });
    const { user } = renderWith(<GroupPage />);

    await choose(user, "Invite students");
    await user.click(
      await screen.findByRole("button", { name: /Get a new code/ }),
    );
    expect(screen.getByText(/will stop working/)).toBeTruthy();
    expect(groupsApi.replaceJoinCode).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Get new code" }));

    await screen.findByLabelText("Join code P 3 R T 9 W");
    expect(analytics.track).toHaveBeenCalledWith("group_code_replaced");
  });

  test("the students panel lists who joined; removing one asks first", async () => {
    groupsApi.getGroup.mockResolvedValue(GROUP);
    groupsApi.removeMember.mockResolvedValue(undefined);
    const { user } = renderWith(<GroupPage />);

    await choose(user, "Students2");
    await screen.findByRole("dialog", { name: "Students · 2" });
    expect(screen.getByText("Aman Gupta")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Remove Riya" }));
    expect(groupsApi.removeMember).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(screen.queryByText("Riya Verma")).toBeNull());
    expect(groupsApi.removeMember).toHaveBeenCalledWith("g1", "riya");
    expect(screen.getByRole("dialog", { name: "Students · 1" })).toBeTruthy();
  });

  test("changing one's mind keeps the student", async () => {
    groupsApi.getGroup.mockResolvedValue(GROUP);
    const { user } = renderWith(<GroupPage />);

    await choose(user, "Students2");
    await user.click(
      await screen.findByRole("button", { name: "Remove Aman" }),
    );
    await user.click(screen.getByRole("button", { name: "Keep" }));

    expect(screen.getByRole("button", { name: "Remove Aman" })).toBeTruthy();
    expect(groupsApi.removeMember).not.toHaveBeenCalled();
  });

  test("renaming updates the heading", async () => {
    groupsApi.getGroup.mockResolvedValue(GROUP);
    groupsApi.renameGroup.mockResolvedValue({
      ...SUMMARY,
      name: "9-A Science",
    });
    const { user } = renderWith(<GroupPage />);

    await choose(user, "Rename group");
    const field = await screen.findByLabelText("Group name");
    await user.clear(field);
    await user.type(field, "9-A Science");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByRole("heading", { name: "9-A Science" });
    expect(groupsApi.renameGroup).toHaveBeenCalledWith("g1", "9-A Science");
  });

  test("deleting asks first, saying what is lost, then returns to the groups", async () => {
    groupsApi.getGroup.mockResolvedValue(GROUP);
    groupsApi.deleteGroup.mockResolvedValue(undefined);
    const { user } = renderWith(<GroupPage />);

    await choose(user, "Delete group");
    expect(await screen.findByText(/can't be undone/)).toBeTruthy();
    expect(groupsApi.deleteGroup).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Delete group" }));

    await waitFor(() => expect(address.replace).toHaveBeenCalledWith("/teach"));
    expect(groupsApi.deleteGroup).toHaveBeenCalledWith("g1");
    expect(analytics.track).toHaveBeenCalledWith("group_deleted", {
      members: 2,
    });
  });

  test("keeping it, or a failed delete, leaves the group in place", async () => {
    groupsApi.getGroup.mockResolvedValue(GROUP);
    groupsApi.deleteGroup.mockRejectedValue(failure(503));
    const { user } = renderWith(<GroupPage />);

    await choose(user, "Delete group");
    await user.click(await screen.findByRole("button", { name: "Keep it" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await choose(user, "Delete group");
    await user.click(
      await screen.findByRole("button", { name: "Delete group" }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Couldn't delete the group. Try again.",
      ),
    );
    expect(address.replace).not.toHaveBeenCalled();
  });

  test("an empty group leads with inviting, and its students panel says so", async () => {
    groupsApi.getGroup.mockResolvedValue({
      ...GROUP,
      member_count: 0,
      members: [],
    });
    const { user } = renderWith(<GroupPage />, PARENT);

    await screen.findByRole("heading", { name: "Invite your children first" });
    await choose(user, "Children0");
    await screen.findByText(/No one has joined yet/);
    await user.click(screen.getByRole("button", { name: "Invite children" }));

    await screen.findByRole("dialog", { name: "Invite children" });
  });

  test("inviting from the empty state opens the invite panel", async () => {
    groupsApi.getGroup.mockResolvedValue({
      ...GROUP,
      member_count: 0,
      members: [],
    });
    const { user } = renderWith(<GroupPage />);

    await user.click(
      await screen.findByRole("button", { name: "Invite students" }),
    );

    await screen.findByRole("dialog", { name: "Invite students" });
  });

  test.each([404, 403])(
    "a group that is not theirs (%s) is not found",
    async (status) => {
      groupsApi.getGroup.mockRejectedValue(failure(status));
      renderWith(<GroupPage />);

      await screen.findByRole("heading", { name: "We can't find that group" });
    },
  );

  test("no id in the address is not found", async () => {
    address.search = "";
    renderWith(<GroupPage />);

    await screen.findByRole("heading", { name: "We can't find that group" });
    expect(groupsApi.getGroup).not.toHaveBeenCalled();
  });

  test("an outage offers a retry", async () => {
    groupsApi.getGroup.mockRejectedValueOnce(failure(503));
    groupsApi.getGroup.mockResolvedValueOnce(GROUP);
    const { user } = renderWith(<GroupPage />);

    await user.click(await screen.findByRole("button", { name: "Try again" }));

    await screen.findByRole("heading", { name: "Class 9-A" });
  });
});

describe("the teacher's side panel", () => {
  function renderPanel() {
    // Tooltips measure themselves when they open.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    // A laptop-width screen: the panel is beside the page, not a drawer.
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    return renderWith(
      <TooltipProvider>
        <SidebarProvider open onOpenChange={() => undefined}>
          <TeachSidebar />
        </SidebarProvider>
      </TooltipProvider>,
    );
  }

  test("lists the groups and marks the open one", async () => {
    groupsApi.listOwnedGroups.mockResolvedValue([
      SUMMARY,
      { ...SUMMARY, group_id: "g2", name: "Class 10-B" },
    ]);
    renderPanel();

    const open = await screen.findByRole("link", { name: "Class 9-A" });
    expect(open.getAttribute("aria-current")).toBe("page");
    expect(
      screen
        .getByRole("link", { name: "Class 10-B" })
        .getAttribute("aria-current"),
    ).toBeNull();
  });

  test("with no groups, says where they will appear; New group opens the window", async () => {
    groupsApi.listOwnedGroups.mockResolvedValue([]);
    const { user } = renderPanel();

    await screen.findByText("Groups you create appear here.");
    await user.click(screen.getByRole("button", { name: "New group" }));

    expect(newGroupDialog.isOpen()).toBe(true);
  });
});
