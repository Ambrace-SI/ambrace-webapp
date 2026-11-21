import api from "@/lib/api/axios";
import type { HistoryResponse } from "@/types/viva";

/** How many vivas one request brings back. */
export const HISTORY_PAGE_SIZE = 20;

/**
 * One page of the student's vivas, newest first. The server knows whose they
 * are from the access token. The cursor is the server's own and is passed
 * back untouched.
 */
export async function getHistory(cursor?: string): Promise<HistoryResponse> {
  const response = await api.get<HistoryResponse>("/api/v1/viva/history", {
    params: { limit: HISTORY_PAGE_SIZE, cursor },
  });
  return response.data;
}

/** Changes the name a viva is listed under. Its chapter stays as it was. */
export async function renameViva(
  sessionId: string,
  title: string,
): Promise<void> {
  await api.patch(`/api/v1/viva/${sessionId}/rename`, { new_title: title });
}

/** Removes a viva and its report for good. */
export async function deleteViva(sessionId: string): Promise<void> {
  await api.delete(`/api/v1/viva/${sessionId}`);
}
