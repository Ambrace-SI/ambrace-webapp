// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  assignmentsKey,
  resultsKey,
  useCreateAssignment,
  useDeleteAssignment,
} from "@/lib/groups/use-groups";
import type { Assignment } from "@/types/assignments";

/**
 * Setting or removing a viva navigates straight back to the group page, so
 * its list must already be right when the page appears, not after a refetch.
 */
const groupsApi = vi.hoisted(() => ({
  listAssignments: vi.fn(),
  createAssignment: vi.fn(),
  deleteAssignment: vi.fn(),
}));
vi.mock("@/lib/groups/api", () => groupsApi);

const viva = (assignment_id: string): Assignment => ({
  assignment_id,
  title: assignment_id,
  curriculum_selection: {
    catalog_id: "ncert-cbse",
    catalog_version: "v1",
    class_level: 9,
    subject_id: "science",
    subject_name: "Science",
    chapters: [{ id: "motion", name: "Motion", topics: [] }],
  },
  due_on: null,
  created_at: "2026-11-25T10:00:00Z",
  completed_count: 0,
  average_score: null,
});

function setUp() {
  // A refetch that never answers: anything on screen came from the cache write.
  groupsApi.listAssignments.mockReturnValue(new Promise(() => undefined));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(assignmentsKey("g1"), [viva("old")]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

beforeEach(() => {
  Object.values(groupsApi).forEach((fn) => fn.mockReset());
});

describe("the group's vivas list stays right across a navigation", () => {
  test("a new viva is listed first, straight from the server's answer", async () => {
    const { client, wrapper } = setUp();
    groupsApi.createAssignment.mockResolvedValue(viva("new"));
    const { result } = renderHook(() => useCreateAssignment("g1"), {
      wrapper,
    });

    await act(() =>
      result.current.mutateAsync({
        curriculum_selection: viva("new").curriculum_selection,
      }),
    );

    expect(
      client
        .getQueryData<Assignment[]>(assignmentsKey("g1"))
        ?.map((a) => a.assignment_id),
    ).toEqual(["new", "old"]);
  });

  test("a removed viva leaves the list and its results at once", async () => {
    const { client, wrapper } = setUp();
    client.setQueryData(resultsKey("g1", "old"), { students: [] });
    groupsApi.deleteAssignment.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteAssignment("g1"), {
      wrapper,
    });

    await act(() => result.current.mutateAsync("old"));

    expect(client.getQueryData(assignmentsKey("g1"))).toEqual([]);
    expect(client.getQueryData(resultsKey("g1", "old"))).toBeUndefined();
  });

  test("with no list loaded yet, there is nothing to write into", async () => {
    const { client, wrapper } = setUp();
    client.removeQueries({ queryKey: assignmentsKey("g1") });
    groupsApi.createAssignment.mockResolvedValue(viva("new"));
    groupsApi.deleteAssignment.mockResolvedValue(undefined);
    const create = renderHook(() => useCreateAssignment("g1"), { wrapper });
    const remove = renderHook(() => useDeleteAssignment("g1"), { wrapper });

    await act(() =>
      create.result.current.mutateAsync({
        curriculum_selection: viva("new").curriculum_selection,
      }),
    );
    await act(() => remove.result.current.mutateAsync("new"));

    expect(client.getQueryData(assignmentsKey("g1"))).toBeUndefined();
  });
});
