import api from "@/lib/api/axios";
import type {
  GroupCreate,
  GroupDetail,
  GroupSummary,
  InvitePreview,
  JoinedGroup,
  JoinGroupResult,
} from "@/types/groups";

/**
 * Calls to /api/v1/groups. Kept out of lib/api/, which holds the frozen
 * Veenoe client; this only reuses its configured instance, so the token and
 * the sign-out handling are the same as for every other call.
 */

export const GROUPS_PATH = "/api/v1/groups";

const groupPath = (groupId: string) =>
  `${GROUPS_PATH}/${encodeURIComponent(groupId)}`;

// --------------------------------------------------------------- educator

export async function listOwnedGroups(): Promise<GroupSummary[]> {
  return (await api.get<GroupSummary[]>(GROUPS_PATH)).data;
}

export async function createGroup(group: GroupCreate): Promise<GroupDetail> {
  return (await api.post<GroupDetail>(GROUPS_PATH, group)).data;
}

export async function getGroup(groupId: string): Promise<GroupDetail> {
  return (await api.get<GroupDetail>(groupPath(groupId))).data;
}

export async function renameGroup(
  groupId: string,
  name: string,
): Promise<GroupSummary> {
  return (await api.patch<GroupSummary>(groupPath(groupId), { name })).data;
}

export async function deleteGroup(groupId: string): Promise<void> {
  await api.delete(groupPath(groupId));
}

export async function replaceJoinCode(groupId: string): Promise<GroupSummary> {
  return (await api.post<GroupSummary>(`${groupPath(groupId)}/join-code`)).data;
}

export async function removeMember(
  groupId: string,
  studentId: string,
): Promise<void> {
  await api.delete(
    `${groupPath(groupId)}/members/${encodeURIComponent(studentId)}`,
  );
}

// ---------------------------------------------------------------- student

export async function previewInvite(code: string): Promise<InvitePreview> {
  return (
    await api.get<InvitePreview>(
      `${GROUPS_PATH}/invite/${encodeURIComponent(code)}`,
    )
  ).data;
}

export async function joinGroup(code: string): Promise<JoinGroupResult> {
  return (await api.post<JoinGroupResult>(`${GROUPS_PATH}/join`, { code }))
    .data;
}

export async function listJoinedGroups(): Promise<JoinedGroup[]> {
  return (await api.get<JoinedGroup[]>(`${GROUPS_PATH}/joined`)).data;
}

export async function leaveGroup(groupId: string): Promise<void> {
  await api.delete(`${GROUPS_PATH}/joined/${encodeURIComponent(groupId)}`);
}
