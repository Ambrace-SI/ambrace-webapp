"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";

import { deleteViva, getHistory, renameViva } from "@/lib/api/history";
import type { HistoryResponse, VivaSessionSummary } from "@/types/viva";

/** The live session refreshes this key the moment a viva finishes. */
export const HISTORY_KEY = ["history"] as const;

type Pages = InfiniteData<HistoryResponse, string | undefined>;

/** The student's vivas, newest first, a page at a time. */
export function useHistory() {
  return useInfiniteQuery({
    queryKey: HISTORY_KEY,
    queryFn: ({ pageParam }) => getHistory(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    // Screens want one list; the pages and their cursors stay underneath.
    select: (data) => data.pages.flatMap((page) => page.sessions),
  });
}

/**
 * Shows a change in the list at once, and hands back a way to undo it if the
 * server then refuses. Every loaded page is rewritten, not only the first:
 * the viva being changed may be one the student scrolled down to.
 */
async function changeListNow(
  queryClient: QueryClient,
  change: (vivas: VivaSessionSummary[]) => VivaSessionSummary[],
) {
  await queryClient.cancelQueries({ queryKey: HISTORY_KEY });
  const before = queryClient.getQueryData<Pages>(HISTORY_KEY);
  queryClient.setQueryData<Pages>(HISTORY_KEY, (pages) =>
    pages
      ? {
          ...pages,
          pages: pages.pages.map((page) => ({
            ...page,
            sessions: change(page.sessions),
          })),
        }
      : pages,
  );
  return () => queryClient.setQueryData(HISTORY_KEY, before);
}

export function useRenameViva() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      renameViva(id, title),
    onMutate: ({ id, title }) =>
      changeListNow(queryClient, (vivas) =>
        vivas.map((viva) =>
          viva.viva_session_id === id ? { ...viva, title } : viva,
        ),
      ),
    onError: (_error, _input, undo) => undo?.(),
    // Checked against the server afterwards, without holding the change open.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: HISTORY_KEY });
    },
  });
}

export function useDeleteViva() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteViva(id),
    onMutate: (id) =>
      changeListNow(queryClient, (vivas) =>
        vivas.filter((viva) => viva.viva_session_id !== id),
      ),
    onError: (_error, _id, undo) => undo?.(),
    onSuccess: (_data, id) =>
      // Its report is gone too; nothing may show it from memory.
      queryClient.removeQueries({ queryKey: ["viva-session", id] }),
    // Checked against the server afterwards, without holding the change open.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: HISTORY_KEY });
    },
  });
}
