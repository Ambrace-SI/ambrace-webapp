import { beforeEach, describe, expect, test, vi } from "vitest";

import * as groups from "@/lib/groups/api";
import { groupDetails, membersLabel } from "@/lib/groups/wording";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("@/lib/api/axios", () => ({ default: api }));

beforeEach(() => {
  Object.values(api).forEach((fn) => {
    fn.mockReset();
    fn.mockResolvedValue({ data: "answer" });
  });
});

describe("the groups client calls the documented routes", () => {
  test.each([
    ["listOwnedGroups", [], "get", ["/api/v1/groups"]],
    [
      "createGroup",
      [{ name: "9-A", class_level: 9 }],
      "post",
      ["/api/v1/groups", { name: "9-A", class_level: 9 }],
    ],
    ["getGroup", ["g1"], "get", ["/api/v1/groups/g1"]],
    [
      "renameGroup",
      ["g1", "9-B"],
      "patch",
      ["/api/v1/groups/g1", { name: "9-B" }],
    ],
    ["replaceJoinCode", ["g1"], "post", ["/api/v1/groups/g1/join-code"]],
    ["previewInvite", ["K7QX2M"], "get", ["/api/v1/groups/invite/K7QX2M"]],
    [
      "joinGroup",
      ["K7QX2M"],
      "post",
      ["/api/v1/groups/join", { code: "K7QX2M" }],
    ],
    ["listJoinedGroups", [], "get", ["/api/v1/groups/joined"]],
    ["listAssignments", ["g1"], "get", ["/api/v1/groups/g1/assignments"]],
    [
      "createAssignment",
      ["g1", { due_on: null }],
      "post",
      ["/api/v1/groups/g1/assignments", { due_on: null }],
    ],
    ["listAssigned", [], "get", ["/api/v1/groups/assigned"]],
    [
      "startAssignment",
      ["g1", "a1"],
      "post",
      ["/api/v1/groups/g1/assignments/a1/start"],
    ],
  ] as const)("%s", async (name, args, method, expected) => {
    const call = groups[name] as (...a: unknown[]) => Promise<unknown>;

    await expect(call(...args)).resolves.toBe("answer");

    expect(api[method]).toHaveBeenCalledWith(...expected);
  });

  test("removing, leaving and deleting send DELETE, with ids escaped", async () => {
    await groups.deleteGroup("g1");
    await groups.deleteAssignment("g1", "a 1");
    await groups.removeMember("g1", "a/b");
    await groups.leaveGroup("g 1");

    expect(api.delete).toHaveBeenCalledWith("/api/v1/groups/g1/members/a%2Fb");
    expect(api.delete).toHaveBeenCalledWith("/api/v1/groups/joined/g%201");
    expect(api.delete).toHaveBeenCalledWith("/api/v1/groups/g1");
    expect(api.delete).toHaveBeenCalledWith(
      "/api/v1/groups/g1/assignments/a%201",
    );
  });
});

describe("how a group is described", () => {
  test("teachers have students, parents have children", () => {
    expect(membersLabel("teacher", 1)).toBe("1 student");
    expect(membersLabel("teacher", 3)).toBe("3 students");
    expect(membersLabel("parent", 1)).toBe("1 child");
    expect(membersLabel("parent", 2)).toBe("2 children");
  });

  test("the class is left out when the group has none", () => {
    expect(groupDetails("parent", { class_level: null, member_count: 2 })).toBe(
      "2 children",
    );
    expect(groupDetails("teacher", { class_level: 9, member_count: 0 })).toBe(
      "Class 9 · 0 students",
    );
  });
});
