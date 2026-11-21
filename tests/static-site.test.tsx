// @vitest-environment jsdom
import { cleanup, render, renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { SignedOutOnly } from "@/components/auth/signed-out-only";
import { useOpenReportId } from "@/lib/hooks/use-open-report";

/**
 * Ambrace is served as plain files, with no server in front to look at who is
 * asking or what for. These are the pieces that do that work in the browser.
 */
const address = vi.hoisted(() => ({
  pathname: "/",
  search: "",
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => address.pathname,
  useSearchParams: () => new URLSearchParams(address.search),
  useRouter: () => ({ replace: address.replace }),
}));

const getAccessToken = vi.fn();
vi.mock("@/lib/auth/client", () => ({
  getAccessToken: () => getAccessToken(),
}));

const replaceLocation = vi.fn();

function visit(pathname: string, search = "") {
  address.pathname = pathname;
  address.search = search;
  vi.stubGlobal("location", { pathname, search, replace: replaceLocation });
}

/** Lets the token check, which is a promise, finish. */
const settle = () => act(async () => {});

beforeEach(() => {
  address.replace.mockReset();
  getAccessToken.mockReset();
  replaceLocation.mockReset();
  visit("/");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("a sign-in screen, for someone already signed in", () => {
  test("sends them home", async () => {
    getAccessToken.mockResolvedValue("token");
    visit("/sign-in");

    render(<SignedOutOnly />);
    await settle();

    expect(replaceLocation).toHaveBeenCalledWith("/");
  });

  test("sends them to where they were heading", async () => {
    getAccessToken.mockResolvedValue("token");
    visit("/sign-in", "?next=%2Fv%3Fid%3Dabc");

    render(<SignedOutOnly />);
    await settle();

    expect(replaceLocation).toHaveBeenCalledWith("/v?id=abc");
  });

  test("never sends them off the site, whatever the address asks", async () => {
    getAccessToken.mockResolvedValue("token");
    visit("/sign-up", "?next=https%3A%2F%2Fevil.example");

    render(<SignedOutOnly />);
    await settle();

    expect(replaceLocation).toHaveBeenCalledWith("/");
  });

  test("someone signed out stays where they are", async () => {
    getAccessToken.mockResolvedValue(null);
    visit("/sign-in");

    render(<SignedOutOnly />);
    await settle();

    expect(replaceLocation).not.toHaveBeenCalled();
  });

  test("the page finishing a Google sign-in is left alone", async () => {
    getAccessToken.mockResolvedValue("token");
    visit("/auth/callback");

    render(<SignedOutOnly />);
    await settle();

    expect(getAccessToken).not.toHaveBeenCalled();
    expect(replaceLocation).not.toHaveBeenCalled();
  });

  test("a check that finishes after they left the screen does nothing", async () => {
    let answer: (token: string) => void = () => {};
    getAccessToken.mockReturnValue(
      new Promise<string>((resolve) => {
        answer = resolve;
      }),
    );
    visit("/sign-in");

    const { unmount } = render(<SignedOutOnly />);
    unmount();
    answer("token");
    await settle();

    expect(replaceLocation).not.toHaveBeenCalled();
  });

  test("it draws nothing of its own", () => {
    getAccessToken.mockResolvedValue(null);
    visit("/sign-in");

    const { container } = render(<SignedOutOnly />);

    expect(container.innerHTML).toBe("");
  });
});

describe("which report is on screen", () => {
  test("is read from the address of the report page", () => {
    visit("/v", "?id=abc-123");

    expect(renderHook(() => useOpenReportId()).result.current).toBe("abc-123");
  });

  test("is nothing on the report page with no viva named", () => {
    visit("/v");

    expect(renderHook(() => useOpenReportId()).result.current).toBeNull();
  });

  test("is nothing on any other page, even one with the same word in its address", () => {
    visit("/viva", "?id=abc-123");

    expect(renderHook(() => useOpenReportId()).result.current).toBeNull();
  });
});
