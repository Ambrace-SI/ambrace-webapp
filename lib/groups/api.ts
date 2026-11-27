import api from "@/lib/api/axios";
import type {
  Assignment,
  AssignmentCreate,
  AssignmentResults,
  ClassInsightState,
  StudentAssignment,
  StudentReport,
} from "@/types/assignments";
import type {
  GroupCreate,
  GroupDetail,
  GroupSummary,
  InvitePreview,
  JoinedGroup,
  JoinGroupResult,
} from "@/types/groups";
import type { VivaStartResponse } from "@/types/viva";

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

// ------------------------------------------------------------ set vivas

const assignmentsPath = (groupId: string) =>
  `${groupPath(groupId)}/assignments`;

export async function listAssignments(groupId: string): Promise<Assignment[]> {
  return (await api.get<Assignment[]>(assignmentsPath(groupId))).data;
}

export async function createAssignment(
  groupId: string,
  assignment: AssignmentCreate,
): Promise<Assignment> {
  return (await api.post<Assignment>(assignmentsPath(groupId), assignment))
    .data;
}

export async function deleteAssignment(
  groupId: string,
  assignmentId: string,
): Promise<void> {
  await api.delete(
    `${assignmentsPath(groupId)}/${encodeURIComponent(assignmentId)}`,
  );
}

/** Every viva set for the signed-in student, across their groups. */
export async function listAssigned(): Promise<StudentAssignment[]> {
  return (await api.get<StudentAssignment[]>(`${GROUPS_PATH}/assigned`)).data;
}

/**
 * Starts a set viva. The server builds it from the assignment and answers
 * exactly as /viva/start does, so the voice engine takes it unchanged.
 */
export async function startAssignment(
  groupId: string,
  assignmentId: string,
): Promise<VivaStartResponse> {
  return (
    await api.post<VivaStartResponse>(
      `${assignmentsPath(groupId)}/${encodeURIComponent(assignmentId)}/start`,
    )
  ).data;
}

// ------------------------------------------------------ what the owner reads

const resultsPath = (groupId: string, assignmentId: string) =>
  `${assignmentsPath(groupId)}/${encodeURIComponent(assignmentId)}/results`;

export async function getAssignmentResults(
  groupId: string,
  assignmentId: string,
): Promise<AssignmentResults> {
  return (await api.get<AssignmentResults>(resultsPath(groupId, assignmentId)))
    .data;
}

/** A student's report for the group's owner. It never holds a transcript. */
export async function getStudentReport(
  groupId: string,
  assignmentId: string,
  studentId: string,
): Promise<StudentReport> {
  return (
    await api.get<StudentReport>(
      `${resultsPath(groupId, assignmentId)}/${encodeURIComponent(studentId)}`,
    )
  ).data;
}

// ------------------------------------------------------ AI class insight

const insightPath = (groupId: string, assignmentId: string) =>
  `${assignmentsPath(groupId)}/${encodeURIComponent(assignmentId)}/insight`;

/** The saved class insight for one set viva, or whether one can be written. */
export async function getClassInsight(
  groupId: string,
  assignmentId: string,
): Promise<ClassInsightState> {
  return (await api.get<ClassInsightState>(insightPath(groupId, assignmentId)))
    .data;
}

/**
 * Writes the class insight. The server returns the saved one unchanged when
 * no results have arrived since, so asking twice costs nothing.
 */
export async function generateClassInsight(
  groupId: string,
  assignmentId: string,
): Promise<ClassInsightState> {
  return (await api.post<ClassInsightState>(insightPath(groupId, assignmentId)))
    .data;
}
