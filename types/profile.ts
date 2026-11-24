/** Mirrors the backend's /api/v1/me contract (ambrace-backend/app/schemas/profile.py). */

export const BOARDS = ["CBSE", "ICSE", "STATE_BOARD", "OTHER"] as const;
export type Board = (typeof BOARDS)[number];

export const BOARD_LABELS: Record<Board, string> = {
  CBSE: "CBSE",
  ICSE: "ICSE",
  STATE_BOARD: "State board",
  OTHER: "Other",
};

export const MIN_CLASS_LEVEL = 5;
export const MAX_CLASS_LEVEL = 12;
export const CLASS_LEVELS = Array.from(
  { length: MAX_CLASS_LEVEL - MIN_CLASS_LEVEL + 1 },
  (_, index) => MIN_CLASS_LEVEL + index,
);

/**
 * Who the person is, as onboarding asks it. Fixed once saved.
 *
 * Teachers and parents have exactly the same powers: both are "educators"
 * and see the app's teaching side. The difference only changes wording.
 */
export type AccountType = "student" | "teacher" | "parent";
export type EducatorType = Exclude<AccountType, "student">;
/** Which side of the app a person belongs on. */
export type Side = "student" | "educator";

export function isEducator(type: AccountType): type is EducatorType {
  return type !== "student";
}

export const sideOf = (type: AccountType): Side =>
  isEducator(type) ? "educator" : "student";

export const ACCOUNT_TYPES: readonly AccountType[] = [
  "student",
  "teacher",
  "parent",
];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  student: "Student",
  teacher: "Teacher",
  parent: "Parent",
};

export const EDUCATOR_LABELS: Record<EducatorType, string> = {
  teacher: "Teacher",
  parent: "Parent",
};

export type Profile = {
  name: string;
  account_type: AccountType;
  /** A student's class. Teachers and parents have none: it is per group. */
  class_level: number | null;
  board: Board | null;
  school_name: string | null;
  school_address: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * What a person can set. A student needs a name and a class; a teacher or
 * parent only a name. The type can be changed later, within the rules the
 * server enforces (see Settings → Profile).
 */
export type ProfileUpdate = {
  name: string;
  account_type: AccountType;
  class_level?: number | null;
  board?: Board | null;
  school_name?: string | null;
  school_address?: string | null;
};

export type Me = {
  user_id: string;
  onboarding_complete: boolean;
  profile: Profile | null;
};
