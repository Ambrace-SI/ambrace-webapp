// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  useDeleteViva,
  useHistory,
  useRenameViva,
} from "@/lib/hooks/use-history";
import type { HistoryResponse, VivaSessionSummary } from "@/types/viva";

const api = vi.hoisted(() => ({
  getHistory: vi.fn(),
  renameViva: vi.fn(),
  deleteViva: vi.fn(),
}));
vi.mock("@/lib/api/history", () => api);

function viva(id: string, title = id): VivaSessionSummary {
  return {
    viva_session_id: id,
    title,
    topic: title,
    class_level: "10",
    started_at: "2026-11-21T10:00:00Z",
    session_type: "viva",
    status: "completed",
  };
}

const FIRST: HistoryResponse = {
  sessions: [viva("a", "Electricity"), viva("b", "Light")],
  next_cursor: "b",
};
const SECOND: HistoryResponse = {
  sessions: [viva("c", "Sound")],
  next_cursor: null,
};

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hooks = renderHook(
    () => ({
      history: useHistory(),
      rename: useRenameViva(),
      remove: useDeleteViva(),
    }),
    { wrapper },
  );
  const titles = () => hooks.result.current.history.data?.map((v) => v.title);
  return { client, hooks, titles };
}

/** Both pages on screen, as after pressing "Show older vivas". */
async function withBothPages() {
  const view = setup();
  await waitFor(() => expect(view.titles()).toHaveLength(2));
  await act(() => view.hooks.result.current.history.fetchNextPage());
  await waitFor(() => expect(view.titles()).toHaveLength(3));
  return view;
}

/** A request that stays open until the test settles it. */
function pending() {
  let resolve: () => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  for (const mock of Object.values(api)) mock.mockReset();
  api.getHistory.mockImplementation((cursor?: string) =>
    Promise.resolve(cursor === "b" ? SECOND : FIRST),
  );
});

describe("reading the list", () => {
  test("starts from the newest, with no cursor", async () => {
    const { titles } = setup();

    await waitFor(() => expect(titles()).toEqual(["Electricity", "Light"]));
    expect(api.getHistory).toHaveBeenCalledWith(undefined);
  });

  test("older vivas are fetched with the server's cursor and joined on", async () => {
    const { hooks, titles } = await withBothPages();

    expect(titles()).toEqual(["Electricity", "Light", "Sound"]);
    expect(api.getHistory).toHaveBeenLastCalledWith("b");
    expect(hooks.result.current.history.hasNextPage).toBe(false);
  });
});

describe("renaming", () => {
  test("the new name shows at once, before the server answers", async () => {
    const request = pending();
    api.renameViva.mockReturnValue(request.promise);
    const { hooks, titles } = await withBothPages();

    act(() => hooks.result.current.rename.mutate({ id: "c", title: "Echo" }));

    // "c" is on the second page: every loaded page is updated, not the first.
    await waitFor(() =>
      expect(titles()).toEqual(["Electricity", "Light", "Echo"]),
    );
    expect(api.renameViva).toHaveBeenCalledWith("c", "Echo");
    await act(async () => request.resolve());
  });

  test("a refused rename puts the old name back", async () => {
    const request = pending();
    api.renameViva.mockReturnValue(request.promise);
    const { hooks, titles } = await withBothPages();
    act(() => hooks.result.current.rename.mutate({ id: "a", title: "Volts" }));
    await waitFor(() => expect(titles()?.[0]).toBe("Volts"));

    await act(async () => request.reject(new Error("offline")));

    await waitFor(() => expect(titles()?.[0]).toBe("Electricity"));
    expect(titles()).toHaveLength(3);
  });

  test("afterwards the list is checked against the server", async () => {
    api.renameViva.mockResolvedValue(undefined);
    const { hooks } = await withBothPages();
    const before = api.getHistory.mock.calls.length;

    await act(() =>
      hooks.result.current.rename.mutateAsync({ id: "a", title: "Volts" }),
    );

    await waitFor(() =>
      expect(api.getHistory.mock.calls.length).toBeGreaterThan(before),
    );
  });
});

describe("deleting", () => {
  test("the viva leaves the list at once and its report is forgotten", async () => {
    const request = pending();
    api.deleteViva.mockReturnValue(request.promise);
    const { client, hooks, titles } = await withBothPages();
    client.setQueryData(["viva-session", "b"], { viva_session_id: "b" });

    act(() => hooks.result.current.remove.mutate("b"));

    await waitFor(() => expect(titles()).toEqual(["Electricity", "Sound"]));
    await act(async () => request.resolve());
    await waitFor(() =>
      expect(client.getQueryData(["viva-session", "b"])).toBeUndefined(),
    );
    expect(api.deleteViva).toHaveBeenCalledWith("b");
  });

  test("a refused delete puts the viva back where it was", async () => {
    const request = pending();
    api.deleteViva.mockReturnValue(request.promise);
    const { client, hooks, titles } = await withBothPages();
    client.setQueryData(["viva-session", "b"], { viva_session_id: "b" });
    act(() => hooks.result.current.remove.mutate("b"));
    await waitFor(() => expect(titles()).toHaveLength(2));

    await act(async () => request.reject(new Error("offline")));

    await waitFor(() =>
      expect(titles()).toEqual(["Electricity", "Light", "Sound"]),
    );
    expect(client.getQueryData(["viva-session", "b"])).toBeDefined();
  });

  test("with nothing loaded yet there is nothing to change or undo", async () => {
    api.getHistory.mockReturnValue(new Promise(() => undefined));
    api.deleteViva.mockRejectedValue(new Error("offline"));
    const { hooks, titles } = setup();

    await act(async () => {
      await hooks.result.current.remove.mutateAsync("a").catch(() => undefined);
    });

    expect(titles()).toBeUndefined();
  });
});
