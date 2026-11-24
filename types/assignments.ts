/** Mirrors the backend's set-viva contract (ambrace-backend/app/schemas/assignment.py). */

import type { CurriculumSelection } from "@/lib/curriculum/types";
import type { EducatorType } from "@/types/profile";

/** A viva set for a group, as its owner sees it. */
export type Assignment = {
  assignment_id: string;
  /** The chapter's name. */
  title: string;
  curriculum_selection: CurriculumSelection;
  /** A calendar day (YYYY-MM-DD), or none. */
  due_on: string | null;
  created_at: string;
  completed_count: number;
};

export type AssignmentCreate = {
  curriculum_selection: CurriculumSelection;
  due_on?: string | null;
};

/** A viva set for the signed-in student, in one of their groups. */
export type StudentAssignment = {
  assignment_id: string;
  group_id: string;
  group_name: string;
  owner_name: string;
  owner_type: EducatorType;
  title: string;
  subject_name: string;
  curriculum_selection: CurriculumSelection;
  due_on: string | null;
  created_at: string;
  status: "pending" | "done";
  /** Once done: their score, and the session whose report they can open. */
  score: number | null;
  session_id: string | null;
};
