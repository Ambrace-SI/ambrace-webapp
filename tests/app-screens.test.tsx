// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { Home } from "@/components/app/home";
import { useMe, useSaveProfile } from "@/lib/hooks/use-me";
import { useVivaStore } from "@/lib/store/viva-store";
import type { Me, Profile } from "@/types/profile";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <span data-src={src}>{alt}</span>
  ),
}));

const api = { get: vi.fn(), put: vi.fn() };
vi.mock("@/lib/api/axios", () => ({
  default: {
    get: (...input: unknown[]) => api.get(...input),
    put: (...input: unknown[]) => api.put(...input),
  },
}));

const PROFILE: Profile = {
  name: "Asha Rao",
  class_level: 9,
  board: "STATE_BOARD",
  school_name: "Hill View School",
  school_address: null,
  created_at: "2026-11-21T10:00:00Z",
  updated_at: "2026-11-21T10:00:00Z",
};

function me(profile: Profile | null): Me {
  return { user_id: "user-1", onboarding_complete: !!profile, profile };
}

function withQueries(seed?: Me) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  if (seed) client.setQueryData(["me"], seed);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

beforeEach(() => {
  api.get.mockReset();
  api.put.mockReset();
  useVivaStore.getState().resetSession();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the home screen", () => {
  test("greets the student by first name and shows what we know", () => {
    render(<Home />, { wrapper: withQueries(me(PROFILE)).wrapper });

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Hello, Asha.",
    );
    expect(
      screen.getByText("Class 9 · State board · Hill View School"),
    ).toBeTruthy();
  });

  test("leaves out details the student skipped, with no stray separators", () => {
    render(<Home />, {
      wrapper: withQueries(me({ ...PROFILE, board: null, school_name: null }))
        .wrapper,
    });

    expect(screen.getByText("Class 9")).toBeTruthy();
  });

  test("offers one thing to do: start a viva", () => {
    render(<Home />, { wrapper: withQueries(me(PROFILE)).wrapper });

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toBe("Start a viva");
    expect(links[0].getAttribute("href")).toBe("/viva");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("a viva that broke explains itself here, until dismissed", async () => {
    // The voice engine sends the student home when a session cannot continue.
    useVivaStore.getState().setError("Microphone access was blocked.");
    render(<Home />, { wrapper: withQueries(me(PROFILE)).wrapper });

    expect(screen.getByRole("alert").textContent).toBe(
      "Your viva stopped. Microphone access was blocked.",
    );

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(useVivaStore.getState().error).toBeNull();
  });

  test("shows an outline, announced to screen readers, while the profile loads", () => {
    api.get.mockReturnValue(new Promise(() => undefined));

    render(<Home />, { wrapper: withQueries().wrapper });

    expect(screen.getByRole("status").textContent).toMatch(/Loading/);
    expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByRole("heading")).toBeNull();
  });
});

describe("the profile API client", () => {
  test("reading the profile calls GET /api/v1/me", async () => {
    api.get.mockResolvedValue({ data: me(PROFILE) });
    const { result } = renderHook(() => useMe(), {
      wrapper: withQueries().wrapper,
    });

    await waitFor(() => expect(result.current.data).toEqual(me(PROFILE)));
    expect(api.get).toHaveBeenCalledWith("/api/v1/me");
  });

  test("saving calls PUT /api/v1/me and updates every screen without a refetch", async () => {
    const updated = me({ ...PROFILE, class_level: 10 });
    api.put.mockResolvedValue({ data: updated });
    const { client, wrapper } = withQueries(me(PROFILE));
    const { result } = renderHook(() => useSaveProfile(), { wrapper });

    await result.current.mutateAsync({ name: "Asha Rao", class_level: 10 });

    expect(api.put).toHaveBeenCalledWith("/api/v1/me", {
      name: "Asha Rao",
      class_level: 10,
    });
    expect(client.getQueryData(["me"])).toEqual(updated);
    expect(api.get).not.toHaveBeenCalled();
  });

  test("a failed save leaves the profile on screen untouched", async () => {
    api.put.mockRejectedValue(new Error("offline"));
    const { client, wrapper } = withQueries(me(PROFILE));
    const { result } = renderHook(() => useSaveProfile(), { wrapper });

    await expect(
      result.current.mutateAsync({ name: "Asha Rao", class_level: 10 }),
    ).rejects.toThrow("offline");
    expect(client.getQueryData(["me"])).toEqual(me(PROFILE));
  });
});
