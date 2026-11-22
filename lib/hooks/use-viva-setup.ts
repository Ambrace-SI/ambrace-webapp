"use client";

import { useEffect, useReducer, useState } from "react";

import {
  getCurriculumSelection,
  getSelectionView,
  initialSelection,
  selectionReducer,
} from "@/lib/curriculum/selection";
import { curriculum, isSubjectAvailable } from "@/lib/curriculum/selectors";

type CatalogLoad = { attempt: number; failed: boolean };

/**
 * Everything the setup screen needs to choose what a viva is about.
 *
 * The class is not a choice here: it comes from the student's profile, and it
 * decides which subjects exist. Subject, chapter and topics follow the shared
 * selection rules, so a stale choice can never start a session.
 */
export function useVivaSetup(classLevel: number) {
  const [selection, select] = useReducer(
    selectionReducer,
    classLevel,
    (level) => ({ ...initialSelection, classLevel: level }),
  );
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<CatalogLoad | null>(null);

  // Each class is a separate download, fetched the first time it is needed.
  useEffect(() => {
    let cancelled = false;
    curriculum
      .loadClass(classLevel)
      .then(() => {
        if (!cancelled) setLoad({ attempt, failed: false });
      })
      .catch(() => {
        if (!cancelled) setLoad({ attempt, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [classLevel, attempt]);

  // An answer from an earlier attempt says nothing about the current one.
  const settled = load?.attempt === attempt ? load : null;
  const catalog: "loading" | "ready" | "failed" = !settled
    ? "loading"
    : settled.failed
      ? "failed"
      : "ready";

  const view = getSelectionView(selection);

  return {
    catalog,
    retryCatalog: () => setAttempt((current) => current + 1),
    selection,
    select,
    // A subject with no chapters cannot be examined, so it is not offered.
    subjects: view.subjects.filter(isSubjectAvailable),
    subject: view.subject,
    chapters: view.chapters,
    chapter: view.selectedChapters[0],
    chosen: selection.chapters[0],
    /** The finished choice, or null until a subject and a chapter are picked. */
    resolved: catalog === "ready" ? getCurriculumSelection(selection) : null,
  };
}

export type VivaSetup = ReturnType<typeof useVivaSetup>;
