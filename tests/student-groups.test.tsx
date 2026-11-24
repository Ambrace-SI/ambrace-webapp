// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  StudentGroup,
  StudentGroups,
} from "@/components/groups/student-groups";
import type { StudentAssignment } from "@/types/assignments";
import type { JoinedGroup } from "@/types/groups";

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

const address = vi.hoisted(() => ({ search: "id=g1", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(address.search),
  useRouter: () => ({ replace: address.replace }),
}));

const { toast } = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast }));

const groupsApi = vi.hoisted(() => ({
  listJoinedGroups: vi.fn(),
  leaveGroup: vi.fn(),
  listAssigned: vi.fn(),
}));
vi.mock("@/lib/groups/api", () => groupsApi);

const CLASS_9A: JoinedGroup = {
  group_id: "g1",
  name: "Class 9-A",
  owner_name: "Meera Sharma",
  owner_type: "teacher",
  class_level: 9,
  joined_at: "2026-11-24T10:00:00Z",
};
const FAMILY: JoinedGroup = {
  ...CLASS_9A,
  group_id: "g2",
  name: "Home",
  owner_name: "Anita",
  owner_type: "parent",
  class_level: null,
};

const VIVA: StudentAssignment = {
  assignment_id: "a1",
  group_id: "g1",
  group_name: "Class 9-A",
  owner_name: "Meera Sharma",
  owner_type: "teacher",
  title: "Motion",
  subject_name: "Science",
  curriculum_selection: {
    catalog_id: "ncert-cbse",
    catalog_version: "v1",
    class_level: 9,
    subject_id: "science",
    subject_name: "Science",
    chapters: [{ id: "motion", name: "Motion", topics: [] }],
  },
  due_on: null,
  created_at: "2026-11-24T10:00:00Z",
  status: "pending",
  score: null,
  session_id: null,
};

function renderPage(page: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(<QueryClientProvider client={client}>{page}</QueryClientProvider>);
  return userEvent.setup();
}

beforeEach(() => {
  groupsApi.listJoinedGroups.mockReset();
  groupsApi.leaveGroup.mockReset();
  groupsApi.listAssigned.mockReset();
  groupsApi.listAssigned.mockResolvedValue([]);
  address.search = "id=g1";
  address.replace.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
});
afterEach(cleanup);

describe("the list of a student's groups", () => {
  test("shows each group with who runs it, linking to it", async () => {
    groupsApi.listJoinedGroups.mockResolvedValue([CLASS_9A, FAMILY]);
    renderPage(<StudentGroups />);

    const first = await screen.findByRole("link", { name: /Class 9-A/ });
    expect(first.getAttribute("href")).toBe("/groups/group?id=g1");
    expect(first.textContent).toMatch(/Teacher · Meera Sharma · Class 9/);
    expect(screen.getByRole("link", { name: /Home/ }).textContent).toMatch(
      /Parent · Anita$/,
    );
    expect(
      screen.getByRole("link", { name: "Join a group" }).getAttribute("href"),
    ).toBe("/join");
  });

  test("with none, explains how to get into one", async () => {
    groupsApi.listJoinedGroups.mockResolvedValue([]);
    renderPage(<StudentGroups />);

    await screen.findByText(/not in any groups yet/);
  });

  test("an outage offers a retry", async () => {
    groupsApi.listJoinedGroups.mockRejectedValueOnce(new Error("offline"));
    groupsApi.listJoinedGroups.mockResolvedValueOnce([CLASS_9A]);
    const user = renderPage(<StudentGroups />);

    await user.click(await screen.findByRole("button", { name: "Try again" }));

    await screen.findByRole("link", { name: /Class 9-A/ });
  });

  test("shows an outline while loading", () => {
    groupsApi.listJoinedGroups.mockReturnValue(new Promise(() => undefined));
    renderPage(<StudentGroups />);

    expect(
      screen.getByRole("status", { name: "Loading your groups" }),
    ).toBeTruthy();
  });
});

describe("one group, as its student sees it", () => {
  test("says who runs it and that no vivas are set yet", async () => {
    groupsApi.listJoinedGroups.mockResolvedValue([CLASS_9A]);
    renderPage(<StudentGroup />);

    await screen.findByRole("heading", { name: "Class 9-A" });
    expect(screen.getByText("Teacher · Meera Sharma · Class 9")).toBeTruthy();
    expect(await screen.findByText("No vivas set yet")).toBeTruthy();
    expect(screen.getByText(/When Meera Sharma sets a viva/)).toBeTruthy();
  });

  test("leaving asks first, then goes back to the list", async () => {
    groupsApi.listJoinedGroups.mockResolvedValue([CLASS_9A]);
    groupsApi.leaveGroup.mockResolvedValue(undefined);
    const user = renderPage(<StudentGroup />);

    await user.click(
      await screen.findByRole("button", { name: "Leave this group" }),
    );
    expect(groupsApi.leaveGroup).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Leave group" }));

    await waitFor(() =>
      expect(address.replace).toHaveBeenCalledWith("/groups"),
    );
    expect(groupsApi.leaveGroup).toHaveBeenCalledWith("g1");
    expect(toast.success).toHaveBeenCalledWith("You left Class 9-A");
  });

  test("staying keeps the student in the group", async () => {
    groupsApi.listJoinedGroups.mockResolvedValue([CLASS_9A]);
    const user = renderPage(<StudentGroup />);

    await user.click(
      await screen.findByRole("button", { name: "Leave this group" }),
    );
    await user.click(screen.getByRole("button", { name: "Stay" }));

    expect(
      screen.getByRole("button", { name: "Leave this group" }),
    ).toBeTruthy();
  });

  test("a failed leave says so and keeps them in", async () => {
    groupsApi.listJoinedGroups.mockResolvedValue([CLASS_9A]);
    groupsApi.leaveGroup.mockRejectedValue(new Error("offline"));
    const user = renderPage(<StudentGroup />);

    await user.click(
      await screen.findByRole("button", { name: "Leave this group" }),
    );
    await user.click(screen.getByRole("button", { name: "Leave group" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Couldn't leave the group. Try again.",
      ),
    );
    expect(address.replace).not.toHaveBeenCalled();
  });

  test("lists the group's vivas: Start for one to do, score and report once done", async () => {
    groupsApi.listJoinedGroups.mockResolvedValue([CLASS_9A]);
    groupsApi.listAssigned.mockResolvedValue([
      { ...VIVA, assignment_id: "a1", title: "Motion", due_on: "2099-01-02" },
      {
        ...VIVA,
        assignment_id: "a2",
        title: "Force",
        status: "done",
        score: 7,
        session_id: "s1",
      },
      // Another group's viva is not shown here.
      { ...VIVA, assignment_id: "a3", group_id: "g2", title: "Fractions" },
    ]);
    renderPage(<StudentGroup />);

    const start = await screen.findByRole("link", { name: "Start Motion" });
    expect(start.getAttribute("href")).toBe("/?assignment=a1");
    expect(screen.getByText(/Science · Due/)).toBeTruthy();
    const report = screen.getByRole("link", { name: /7\/10 Report/ });
    expect(report.getAttribute("href")).toBe("/v?id=s1");
    expect(screen.queryByText("Fractions")).toBeNull();
  });

  test("a failed vivas load offers a retry", async () => {
    groupsApi.listJoinedGroups.mockResolvedValue([CLASS_9A]);
    groupsApi.listAssigned.mockRejectedValueOnce(new Error("offline"));
    groupsApi.listAssigned.mockResolvedValueOnce([
      { ...VIVA, assignment_id: "a1", title: "Motion" },
    ]);
    const user = renderPage(<StudentGroup />);

    await user.click(await screen.findByRole("button", { name: "Try again" }));

    await screen.findByRole("link", { name: "Start Motion" });
  });

  test("a group they are not in says so", async () => {
    groupsApi.listJoinedGroups.mockResolvedValue([FAMILY]);
    renderPage(<StudentGroup />);

    await screen.findByRole("heading", { name: "You're not in this group" });
  });

  test("loading and outages are handled", async () => {
    groupsApi.listJoinedGroups.mockRejectedValueOnce(new Error("offline"));
    groupsApi.listJoinedGroups.mockResolvedValueOnce([CLASS_9A]);
    const user = renderPage(<StudentGroup />);

    expect(
      screen.getByRole("status", { name: "Loading the group" }),
    ).toBeTruthy();
    await user.click(await screen.findByRole("button", { name: "Try again" }));

    await screen.findByRole("heading", { name: "Class 9-A" });
  });
});
