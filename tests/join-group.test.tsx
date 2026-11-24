// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { JoinGroup } from "@/components/groups/join-group";
import type { InvitePreview, JoinGroupResult } from "@/types/groups";

const address = vi.hoisted(() => ({ search: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(address.search),
  useRouter: () => ({ replace: address.replace }),
}));

const analytics = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@/lib/analytics/events", () => ({ track: analytics.track }));

const { toast } = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));
vi.mock("sonner", () => ({ toast }));

const groupsApi = vi.hoisted(() => ({
  previewInvite: vi.fn(),
  joinGroup: vi.fn(),
  listJoinedGroups: vi.fn(),
  leaveGroup: vi.fn(),
}));
vi.mock("@/lib/groups/api", () => groupsApi);

const PREVIEW: InvitePreview = {
  group_name: "Class 9-A",
  owner_name: "Meera Sharma",
  owner_type: "teacher",
  class_level: 9,
  already_member: false,
};
const JOINED: JoinGroupResult = {
  group_id: "g1",
  name: "Class 9-A",
  owner_name: "Meera Sharma",
  owner_type: "teacher",
  class_level: 9,
  joined_at: "2026-11-24T10:00:00Z",
  already_member: false,
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

function open(search: string) {
  address.search = search;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <JoinGroup />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  Object.values(groupsApi).forEach((fn) => fn.mockReset());
  analytics.track.mockReset();
  address.replace.mockReset();
  toast.success.mockReset();
});
afterEach(cleanup);

describe("an invite link", () => {
  test("says who is inviting and what joining shares, before anything happens", async () => {
    groupsApi.previewInvite.mockResolvedValue(PREVIEW);
    open("code=K7QX2M");

    await screen.findByRole("heading", { name: "Join Class 9-A" });
    expect(screen.getByText("Teacher · Meera Sharma · Class 9")).toBeTruthy();
    expect(screen.getByText(/never hear or read what you said/)).toBeTruthy();
    expect(groupsApi.joinGroup).not.toHaveBeenCalled();
    expect(analytics.track).toHaveBeenCalledWith("group_invite_opened", {
      found: true,
    });
  });

  test("joining takes the student home with a confirmation", async () => {
    groupsApi.previewInvite.mockResolvedValue(PREVIEW);
    groupsApi.joinGroup.mockResolvedValue(JOINED);
    const user = open("code=K7QX2M");

    await user.click(await screen.findByRole("button", { name: "Join group" }));

    await waitFor(() => expect(address.replace).toHaveBeenCalledWith("/"));
    expect(groupsApi.joinGroup).toHaveBeenCalledWith("K7QX2M");
    expect(toast.success).toHaveBeenCalledWith("You're in Class 9-A");
    expect(analytics.track).toHaveBeenCalledWith("group_joined", {
      owner_type: "teacher",
    });
  });

  test.each([
    [409, /group is full/],
    [404, /just been changed/],
    [429, /Too many tries/],
    [503, /couldn't join you/],
  ])(
    "a refused join (%s) is explained and the student stays",
    async (status, message) => {
      groupsApi.previewInvite.mockResolvedValue(PREVIEW);
      groupsApi.joinGroup.mockRejectedValue(failure(status));
      const user = open("code=K7QX2M");

      await user.click(
        await screen.findByRole("button", { name: "Join group" }),
      );

      await screen.findByText(message);
      expect(address.replace).not.toHaveBeenCalled();
    },
  );

  test("a student already in the group is told so, with no Join button", async () => {
    groupsApi.previewInvite.mockResolvedValue({
      ...PREVIEW,
      already_member: true,
    });
    const user = open("code=K7QX2M");

    await screen.findByRole("heading", {
      name: "You're already part of Class 9-A",
    });
    expect(screen.queryByRole("button", { name: "Join group" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Go to home" }));

    expect(address.replace).toHaveBeenCalledWith("/");
    expect(groupsApi.joinGroup).not.toHaveBeenCalled();
  });

  test("joining from a page opened before joining elsewhere says so too", async () => {
    groupsApi.previewInvite.mockResolvedValue(PREVIEW);
    groupsApi.joinGroup.mockResolvedValue({ ...JOINED, already_member: true });
    const user = open("code=K7QX2M");

    await user.click(await screen.findByRole("button", { name: "Join group" }));

    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith(
        "You're already part of Class 9-A",
      ),
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(analytics.track).not.toHaveBeenCalledWith(
      "group_joined",
      expect.anything(),
    );
  });

  test("Not now leaves without joining", async () => {
    groupsApi.previewInvite.mockResolvedValue(PREVIEW);
    const user = open("code=K7QX2M");

    await user.click(await screen.findByRole("button", { name: "Not now" }));

    expect(address.replace).toHaveBeenCalledWith("/");
    expect(groupsApi.joinGroup).not.toHaveBeenCalled();
  });

  test("a dead code asks for the right one", async () => {
    groupsApi.previewInvite.mockRejectedValue(failure(404));
    open("code=ZZZZZZ");

    await screen.findByText(/doesn't match a group/);
    expect(screen.getByLabelText("Code")).toBeTruthy();
    expect(analytics.track).toHaveBeenCalledWith("group_invite_opened", {
      found: false,
    });
  });

  test("an outage offers a retry", async () => {
    groupsApi.previewInvite.mockRejectedValueOnce(failure(503));
    groupsApi.previewInvite.mockResolvedValueOnce(PREVIEW);
    const user = open("code=K7QX2M");

    await user.click(await screen.findByRole("button", { name: "Try again" }));

    await screen.findByRole("heading", { name: "Join Class 9-A" });
  });
});

describe("typing a code", () => {
  test("accepts it as people type it and opens the invite", async () => {
    const user = open("");

    await user.type(screen.getByLabelText("Code"), "k7q x2m");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(address.replace).toHaveBeenCalledWith("/join?code=K7QX2M");
  });

  test("a code of the wrong length is pointed out", async () => {
    const user = open("");

    await user.type(screen.getByLabelText("Code"), "K7Q");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText("A code has 6 letters and numbers.")).toBeTruthy();
    expect(address.replace).not.toHaveBeenCalled();
  });
});
