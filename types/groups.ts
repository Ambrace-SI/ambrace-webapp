/** Mirrors the backend's /api/v1/groups contract (ambrace-backend/app/schemas/group.py). */

import type { EducatorType } from "@/types/profile";

/** A group as its owner sees it in their list. */
export type GroupSummary = {
  group_id: string;
  name: string;
  class_level: number | null;
  member_count: number;
  join_code: string;
  created_at: string;
};

export type GroupMember = {
  student_id: string;
  name: string;
  class_level: number | null;
  joined_at: string;
};

export type GroupDetail = GroupSummary & { members: GroupMember[] };

/** What a student sees before joining. Never the roster. */
export type InvitePreview = {
  group_name: string;
  owner_name: string;
  owner_type: EducatorType;
  class_level: number | null;
  /** The student is in this group already; the page says so instead of "Join". */
  already_member: boolean;
};

/** A group as one of its students sees it. No roster and no code. */
export type JoinedGroup = {
  group_id: string;
  name: string;
  owner_name: string;
  owner_type: EducatorType;
  class_level: number | null;
  joined_at: string;
};

/** The group just joined; already_member is true when nothing changed. */
export type JoinGroupResult = JoinedGroup & { already_member: boolean };

export type GroupCreate = { name: string; class_level?: number | null };

export const GROUP_NAME_MAX_LENGTH = 60;
export const MAX_MEMBERS_PER_GROUP = 200;
