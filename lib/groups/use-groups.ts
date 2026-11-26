"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import {
  createAssignment,
  createGroup,
  deleteAssignment,
  deleteGroup,
  getAssignmentResults,
  getGroup,
  getStudentReport,
  joinGroup,
  leaveGroup,
  listAssigned,
  listAssignments,
  listJoinedGroups,
  listOwnedGroups,
  previewInvite,
  removeMember,
  renameGroup,
  replaceJoinCode,
} from "@/lib/groups/api";
import type {
  Assignment,
  AssignmentCreate,
  StudentAssignment,
} from "@/types/assignments";
import type { GroupCreate, GroupDetail, GroupSummary } from "@/types/groups";

export const OWNED_GROUPS_KEY = ["groups", "owned"] as const;
export const JOINED_GROUPS_KEY = ["groups", "joined"] as const;
export const groupKey = (groupId: string) =>
  ["groups", "one", groupId] as const;
export const assignmentsKey = (groupId: string) =>
  ["groups", "assignments", groupId] as const;
/** Under assignmentsKey, so refreshing a group's vivas refreshes these too. */
export const resultsKey = (groupId: string, assignmentId: string) =>
  [...assignmentsKey(groupId), "results", assignmentId] as const;
export const reportKey = (
  groupId: string,
  assignmentId: string,
  studentId: string,
) => [...resultsKey(groupId, assignmentId), studentId] as const;
/** The student's set vivas. Refreshed whenever a viva ends. */
export const ASSIGNED_KEY = ["groups", "assigned"] as const;

/**
 * A change to one group is also a change to the list beside it (name, code,
 * member count). Both are written straight away from the server's answer,
 * so the screen never shows the old value after a save.
 */
function storeSummary(queryClient: QueryClient, summary: GroupSummary) {
  queryClient.setQueryData<GroupDetail>(groupKey(summary.group_id), (group) =>
    group ? { ...group, ...summary } : group,
  );
  queryClient.setQueryData<GroupSummary[]>(OWNED_GROUPS_KEY, (groups) =>
    groups?.map((group) =>
      group.group_id === summary.group_id ? { ...group, ...summary } : group,
    ),
  );
}

// --------------------------------------------------------------- educator

/**
 * What changes while a teacher watches: students join and vivas get done in
 * other people's browsers. So these are re-checked whenever the page is
 * opened or comes back into view, and every 20 seconds while it is on screen
 * (React Query pauses the interval in a background tab).
 */
const LIVE = { staleTime: 0, refetchInterval: 20_000 } as const;

export function useOwnedGroups() {
  return useQuery({ queryKey: OWNED_GROUPS_KEY, queryFn: listOwnedGroups });
}

export function useGroup(groupId: string | null) {
  return useQuery({
    queryKey: groupKey(groupId ?? ""),
    queryFn: () => getGroup(groupId as string),
    enabled: Boolean(groupId),
    ...LIVE,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (group: GroupCreate) => createGroup(group),
    onSuccess: (group) => {
      queryClient.setQueryData(groupKey(group.group_id), group);
      queryClient.setQueryData<GroupSummary[]>(OWNED_GROUPS_KEY, (groups) =>
        groups ? [...groups, group] : groups,
      );
    },
  });
}

export function useRenameGroup(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => renameGroup(groupId, name),
    onSuccess: (summary) => storeSummary(queryClient, summary),
  });
}

export function useDeleteGroup(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteGroup(groupId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: groupKey(groupId) });
      queryClient.setQueryData<GroupSummary[]>(OWNED_GROUPS_KEY, (groups) =>
        groups?.filter((group) => group.group_id !== groupId),
      );
    },
  });
}

export function useReplaceJoinCode(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => replaceJoinCode(groupId),
    onSuccess: (summary) => storeSummary(queryClient, summary),
  });
}

export function useRemoveMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (studentId: string) => removeMember(groupId, studentId),
    onSuccess: (_result, studentId) => {
      queryClient.setQueryData<GroupDetail>(groupKey(groupId), (group) =>
        group
          ? {
              ...group,
              member_count: group.member_count - 1,
              members: group.members.filter((m) => m.student_id !== studentId),
            }
          : group,
      );
      void queryClient.invalidateQueries({ queryKey: OWNED_GROUPS_KEY });
      // Their results stay, but the vivas' counts no longer include them.
      void queryClient.invalidateQueries({ queryKey: assignmentsKey(groupId) });
    },
  });
}

// ---------------------------------------------------------------- student

export function useInvitePreview(code: string | null) {
  return useQuery({
    queryKey: ["groups", "invite", code],
    queryFn: () => previewInvite(code as string),
    enabled: Boolean(code),
    // A dead code stays dead; asking again only spends the rate limit.
    retry: false,
  });
}

export function useJoinedGroups() {
  return useQuery({ queryKey: JOINED_GROUPS_KEY, queryFn: listJoinedGroups });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => joinGroup(code),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: JOINED_GROUPS_KEY });
    },
  });
}

export function useLeaveGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => leaveGroup(groupId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: JOINED_GROUPS_KEY });
    },
  });
}

// ------------------------------------------------------------ set vivas

export function useGroupAssignments(groupId: string | null) {
  return useQuery({
    queryKey: assignmentsKey(groupId ?? ""),
    queryFn: () => listAssignments(groupId as string),
    enabled: Boolean(groupId),
    ...LIVE,
  });
}

export function useCreateAssignment(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignment: AssignmentCreate) =>
      createAssignment(groupId, assignment),
    onSuccess: (created) => {
      // Written straight in from the server's answer, so the group page the
      // teacher lands on already lists it; the refetch only confirms.
      queryClient.setQueryData<Assignment[]>(assignmentsKey(groupId), (list) =>
        list ? [created, ...list] : list,
      );
      void queryClient.invalidateQueries({ queryKey: assignmentsKey(groupId) });
    },
  });
}

export function useDeleteAssignment(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) =>
      deleteAssignment(groupId, assignmentId),
    onSuccess: (_result, assignmentId) => {
      // Gone from the list before the teacher is back on it.
      queryClient.setQueryData<Assignment[]>(assignmentsKey(groupId), (list) =>
        list?.filter((a) => a.assignment_id !== assignmentId),
      );
      queryClient.removeQueries({
        queryKey: resultsKey(groupId, assignmentId),
      });
      void queryClient.invalidateQueries({ queryKey: assignmentsKey(groupId) });
    },
  });
}

export function useAssigned() {
  // A teacher may set one at any moment: checked again on every visit.
  return useQuery({
    queryKey: ASSIGNED_KEY,
    queryFn: listAssigned,
    staleTime: 0,
  });
}

const isPending = (assignments: StudentAssignment[]) =>
  assignments.filter((a) => a.status === "pending");

/** Vivas set for the student and not done yet: what is waiting. */
export function usePendingAssigned(): StudentAssignment[] {
  const { data } = useQuery({
    queryKey: ASSIGNED_KEY,
    queryFn: listAssigned,
    staleTime: 0,
    select: isPending,
  });
  return data ?? [];
}

// ------------------------------------------------------ what the owner reads

export function useAssignmentResults(
  groupId: string | null,
  assignmentId: string | null,
) {
  return useQuery({
    queryKey: resultsKey(groupId ?? "", assignmentId ?? ""),
    queryFn: () =>
      getAssignmentResults(groupId as string, assignmentId as string),
    enabled: Boolean(groupId && assignmentId),
    ...LIVE,
  });
}

export function useStudentReport(
  groupId: string | null,
  assignmentId: string | null,
  studentId: string | null,
) {
  return useQuery({
    queryKey: reportKey(groupId ?? "", assignmentId ?? "", studentId ?? ""),
    queryFn: () =>
      getStudentReport(
        groupId as string,
        assignmentId as string,
        studentId as string,
      ),
    enabled: Boolean(groupId && assignmentId && studentId),
  });
}
