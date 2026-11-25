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
  /** The mean score of those who finished it, or null before anyone has. */
  average_score: number | null;
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

// ------------------------------------------------------ what the owner reads

/** The report a student's viva produced. Never the transcript. */
export type ResultFeedback = {
  score: number;
  summary: string;
  strong_points: string[];
  areas_of_improvement: string[];
  next_steps: string[];
  coverage_note: string | null;
};

/** One student against one set viva. Someone who left after finishing stays. */
export type StudentResultRow = {
  student_id: string;
  name: string;
  status: "done" | "not_started";
  in_group: boolean;
  score: number | null;
  completed_at: string | null;
};

export type AssignmentResults = {
  assignment: Assignment;
  average_score: number | null;
  students: StudentResultRow[];
};

export type StudentReport = {
  student_id: string;
  student_name: string;
  in_group: boolean;
  assignment_id: string;
  title: string;
  curriculum_selection: CurriculumSelection;
  feedback: ResultFeedback;
  completed_at: string;
};
