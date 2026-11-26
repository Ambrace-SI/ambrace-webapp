// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
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

import { AssignViva } from "@/components/teach/assign-viva";
import { GroupPage, dueLabel } from "@/components/teach/group-page";
import { AssignedList } from "@/components/viva/assigned-list";
import type { CurriculumSelection } from "@/lib/curriculum/types";
import type { Assignment, StudentAssignment } from "@/types/assignments";
import type { GroupDetail } from "@/types/groups";
import type { Me } from "@/types/profile";

/**
 * Set vivas on both sides: the teacher sets one and sees progress, the
 * student sees what is waiting on home. Only the API, the address bar,
 * analytics and toasts are stand-ins; the chapter picker is the real one.
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

const address = vi.hoisted(() => ({
  search: "id=g1",
  push: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/teach/group",
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
  getGroup: vi.fn(),
  listAssignments: vi.fn(),
  createAssignment: vi.fn(),
  deleteAssignment: vi.fn(),
  listAssigned: vi.fn(),
  replaceJoinCode: vi.fn(),
  removeMember: vi.fn(),
  renameGroup: vi.fn(),
  deleteGroup: vi.fn(),
}));
vi.mock("@/lib/groups/api", () => groupsApi);

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

const GROUP: GroupDetail = {
  group_id: "g1",
  name: "Class 9-A",
  class_level: 9,
  member_count: 12,
  join_code: "K7QX2M",
  created_at: "2026-11-24T09:00:00Z",
  members: [],
};

const MOTION: CurriculumSelection = {
  catalog_id: "ncert-cbse",
  catalog_version: "v1",
  class_level: 9,
  subject_id: "science",
  subject_name: "Science",
  chapters: [
    {
      id: "motion",
      name: "Motion",
      topics: [{ id: "speed", name: "Speed" }],
    },
  ],
};

const SET: Assignment = {
  assignment_id: "a1",
  title: "Motion",
  curriculum_selection: MOTION,
  due_on: "2099-01-02",
  created_at: "2026-11-24T10:00:00Z",
  completed_count: 3,
  average_score: 6.4,
};

const WAITING: StudentAssignment = {
  assignment_id: "a1",
  group_id: "g1",
  group_name: "Class 9-A",
  owner_name: "Meera Sharma",
  owner_type: "teacher",
  title: "Motion",
  subject_name: "Science",
  curriculum_selection: MOTION,
  due_on: null,
  created_at: "2026-11-24T10:00:00Z",
  status: "pending",
  score: null,
  session_id: null,
};

function failure(status: number, detail?: string) {
  return new AxiosError("failed", undefined, undefined, undefined, {
    status,
    statusText: "",
    data: detail ? { detail } : {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

function renderWith(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["me"], TEACHER);
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return userEvent.setup();
}

beforeEach(() => {
  Object.values(groupsApi).forEach((fn) => fn.mockReset());
  // A laptop-width screen, as the picker asks.
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  analytics.track.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
  address.push.mockReset();
  address.search = "id=g1";
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the vivas on a teacher's group page", () => {
  const PAST = "2020-01-01";
  const ALL_DONE = { completed_count: 12 };

  test("each row is one line: what it is, then its average and progress", async () => {
    groupsApi.getGroup.mockResolvedValue(GROUP);
    groupsApi.listAssignments.mockResolvedValue([SET]);
    renderWith(<GroupPage />);

    // The group loads first, then its vivas: allow for both under coverage.
    const row = await screen.findByRole(
      "link",
      { name: /Motion/ },
      { timeout: 3000 },
    );
    expect(row.getAttribute("href")).toBe("/teach/viva?id=g1&viva=a1");
    expect(
      within(row).getByText(/^Science · Speed · Due .*2 Jan/),
    ).toBeTruthy();
    expect(within(row).getByText("6.4").textContent).toBe("6.4/10");
    expect(within(row).getByText("3 of 12 done")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Set a viva" }).getAttribute("href"),
    ).toBe("/teach/assign?id=g1");
  });

  test("every viva is on the Vivas tab; only overdue gets colour", async () => {
    groupsApi.getGroup.mockResolvedValue(GROUP);
    groupsApi.listAssignments.mockResolvedValue([
      // Past due and everyone done: finished, still listed.
      {
        ...SET,
        assignment_id: "a1",
        title: "Motion",
        due_on: PAST,
        ...ALL_DONE,
      },
      // Past due, someone still to do it: overdue.
      { ...SET, assignment_id: "a2", title: "Force", due_on: PAST },
    ]);
    renderWith(<GroupPage />);

    const vivas = await screen.findByRole("tab", { name: /Vivas/ });
    expect(vivas.getAttribute("aria-selected")).toBe("true");
    await waitFor(() => expect(vivas.textContent).toBe("Vivas2"));
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("Motion")).toBeTruthy();
    expect(within(panel).getByText("Force")).toBeTruthy();
    const overdue = within(panel).getAllByText(/^Overdue, was due /);
    expect(overdue).toHaveLength(1);
    expect(overdue[0].className).toMatch(/text-ember-text/);
  });

  test("a viva set for nobody yet has nothing to average", async () => {
    groupsApi.getGroup.mockResolvedValue({ ...GROUP, member_count: 0 });
    groupsApi.listAssignments.mockResolvedValue([
      { ...SET, completed_count: 0, average_score: null },
    ]);
    renderWith(<GroupPage />);

    await screen.findByText("No one joined yet");
    expect(screen.getByLabelText("No scores yet").textContent).toBe("–");
  });

  test("with none set, say what setting one does", async () => {
    groupsApi.getGroup.mockResolvedValue(GROUP);
    groupsApi.listAssignments.mockResolvedValue([]);
    renderWith(<GroupPage />);

    await screen.findByRole("heading", { name: "No vivas yet" });
    expect(screen.getByText(/see it on their home page/)).toBeTruthy();
  });

  test("a failed load offers a retry", async () => {
    groupsApi.getGroup.mockResolvedValue(GROUP);
    groupsApi.listAssignments.mockRejectedValueOnce(failure(503));
    groupsApi.listAssignments.mockResolvedValueOnce([SET]);
    const user = renderWith(<GroupPage />);

    await user.click(await screen.findByRole("button", { name: "Try again" }));

    await screen.findByRole("link", { name: /Motion/ });
  });

  test("due days read as calendar days", () => {
    expect(dueLabel(null)).toBe("No due date");
    expect(dueLabel("2099-01-02")).toMatch(/^Due .*2 Jan/);
  });
});

describe("setting a viva", () => {
  /** The real Class 9 catalogue, chosen the way a teacher would. */
  async function pickMotion(user: ReturnType<typeof userEvent.setup>) {
    const subject = await screen.findByRole("button", { name: /^Subject/ });
    await waitFor(() =>
      expect((subject as HTMLButtonElement).disabled).toBe(false),
    );
    await user.click(subject);
    await user.click(screen.getByRole("radio", { name: "Science" }));
    await user.click(
      screen.getByRole("radio", { name: /Cell: The Building Block of Life/ }),
    );
  }

  test("uses the student's picker for the group's class, then returns to the group", async () => {
    groupsApi.getGroup.mockResolvedValue(GROUP);
    groupsApi.createAssignment.mockResolvedValue(SET);
    const user = renderWith(<AssignViva />);

    await screen.findByRole("heading", { name: "Set a viva" });
    // The group is Class 9, so no class is asked.
    expect(
      screen.queryByRole("radiogroup", { name: /Which class/ }),
    ).toBeNull();
    await pickMotion(user);
    await user.click(screen.getByRole("button", { name: "Set viva" }));

    await waitFor(() =>
      expect(address.push).toHaveBeenCalledWith("/teach/group?id=g1"),
    );
    const [groupId, body] = groupsApi.createAssignment.mock.calls[0];
    expect(groupId).toBe("g1");
    expect(body.due_on).toBeNull();
    expect(body.curriculum_selection).toMatchObject({
      class_level: 9,
      subject_id: "science",
      chapters: [{ name: "Cell: The Building Block of Life" }],
    });
    expect(analytics.track).toHaveBeenCalledWith(
      "assignment_created",
      expect.objectContaining({ class_level: 9, has_due_date: false }),
    );
    expect(toast.success).toHaveBeenCalledWith("Viva set for Class 9-A");
  });

  test("a group without a class asks for one first", async () => {
    groupsApi.getGroup.mockResolvedValue({ ...GROUP, class_level: null });
    const user = renderWith(<AssignViva />);

    await screen.findByRole("radiogroup", { name: /Which class/ });
    expect(screen.queryByRole("button", { name: "Set viva" })).toBeNull();
    await user.click(screen.getByRole("radio", { name: "9" }));

    await screen.findByRole("button", { name: "Set viva" });
  });

  test("the server's reason for refusing is shown", async () => {
    groupsApi.getGroup.mockResolvedValue(GROUP);
    groupsApi.createAssignment.mockRejectedValue(
      failure(422, "The due date has already passed."),
    );
    const user = renderWith(<AssignViva />);

    await pickMotion(user);
    await user.click(screen.getByRole("button", { name: "Set viva" }));

    await screen.findByText("The due date has already passed.");
    expect(address.push).not.toHaveBeenCalled();
  });

  test("an outage is explained", async () => {
    groupsApi.getGroup.mockResolvedValue(GROUP);
    groupsApi.createAssignment.mockRejectedValue(failure(503));
    const user = renderWith(<AssignViva />);

    await pickMotion(user);
    await user.click(screen.getByRole("button", { name: "Set viva" }));

    await screen.findByText(/couldn't set that viva/);
  });

  test.each([
    [404, "We can't find that group"],
    [503, "We can't load this group"],
  ])("a group that cannot be loaded (%s) says so", async (status, title) => {
    groupsApi.getGroup.mockRejectedValue(failure(status));
    renderWith(<AssignViva />);

    await screen.findByRole("heading", { name: title });
  });

  test("no group in the address is not found", async () => {
    address.search = "";
    renderWith(<AssignViva />);

    await screen.findByRole("heading", { name: "We can't find that group" });
  });
});

describe("set vivas on the student's home", () => {
  test("list what is waiting, and start one on request", async () => {
    groupsApi.listAssigned.mockResolvedValue([
      { ...WAITING, due_on: "2099-01-02" },
      { ...WAITING, assignment_id: "a2", status: "done", title: "Force" },
    ]);
    const onStart = vi.fn();
    const user = renderWith(
      <AssignedList starting={false} onStart={onStart} />,
    );

    const start = await screen.findByRole("button", {
      name: "Start Motion, set by Meera Sharma",
    });
    expect(screen.getByText(/Science · Meera Sharma · Due/)).toBeTruthy();
    // Done ones are not waiting.
    expect(screen.queryByText("Force")).toBeNull();
    await user.click(start);

    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({ assignment_id: "a1" }),
    );
  });

  test("show nothing when nothing is waiting", async () => {
    groupsApi.listAssigned.mockResolvedValue([]);
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <AssignedList starting={false} onStart={vi.fn()} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(groupsApi.listAssigned).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  test("show three, point to the rest, and always include the one asked for", async () => {
    address.search = "assignment=a5";
    Element.prototype.scrollIntoView = vi.fn();
    groupsApi.listAssigned.mockResolvedValue(
      [1, 2, 3, 4, 5].map((n) => ({
        ...WAITING,
        assignment_id: `a${n}`,
        title: `Chapter ${n}`,
      })),
    );
    renderWith(<AssignedList starting={false} onStart={vi.fn()} />);

    await screen.findByText("Chapter 5");
    expect(screen.getByText("Chapter 1")).toBeTruthy();
    expect(screen.queryByText("Chapter 3")).toBeNull();
    expect(
      screen.getByRole("link", { name: "2 more in Your groups" }),
    ).toBeTruthy();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  test("cannot be started twice while one is starting", async () => {
    groupsApi.listAssigned.mockResolvedValue([WAITING]);
    renderWith(<AssignedList starting onStart={vi.fn()} />);

    const start = await screen.findByRole("button", { name: /Start Motion/ });
    expect((start as HTMLButtonElement).disabled).toBe(true);
  });
});
