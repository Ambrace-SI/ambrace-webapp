import { describe, expect, test } from "vitest";

import {
  homePathFor,
  isOpenPath,
  isSignedOutOnlyPath,
  joinPath,
  onboardingUrlFor,
  safeReturnPath,
  signInUrlFor,
  startAssignedPath,
  studentGroupPath,
  teachAssignPath,
  teachGroupPath,
} from "@/lib/auth/routes";

describe("which pages can be seen without signing in", () => {
  test.each(["/sign-in", "/sign-up", "/reset-password", "/auth/callback"])(
    "%s is open",
    (path) => {
      expect(isOpenPath(path)).toBe(true);
    },
  );

  test.each(["/", "/onboarding", "/viva", "/v/abc", "/sign-in-help", "/auth"])(
    "%s is behind the gate",
    (path) => {
      expect(isOpenPath(path)).toBe(false);
    },
  );

  test("the Google callback is open but is not a screen to bounce signed-in people from", () => {
    expect(isSignedOutOnlyPath("/auth/callback")).toBe(false);
    expect(isSignedOutOnlyPath("/sign-in")).toBe(true);
  });
});

describe("where to go after signing in", () => {
  test("a page inside the app is kept, with its query", () => {
    expect(safeReturnPath("/v/123")).toBe("/v/123");
    expect(safeReturnPath("/viva?class=9")).toBe("/viva?class=9");
  });

  test("nothing to return to means home", () => {
    expect(safeReturnPath(null)).toBe("/");
    expect(safeReturnPath(undefined)).toBe("/");
    expect(safeReturnPath("")).toBe("/");
  });

  test.each([
    "https://evil.example/steal",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "///evil.example",
  ])("%j cannot send a student to another site", (candidate) => {
    expect(safeReturnPath(candidate)).toBe("/");
  });

  test("returning to a sign-in screen would loop, so it becomes home", () => {
    expect(safeReturnPath("/sign-in")).toBe("/");
    expect(safeReturnPath("/sign-in?next=/sign-in")).toBe("/");
    expect(safeReturnPath("/auth/callback?code=abc")).toBe("/");
  });
});

describe("the sign-in address the gate redirects to", () => {
  test("remembers the page that was asked for", () => {
    expect(signInUrlFor("/v/123")).toBe("/sign-in?next=%2Fv%2F123");
    expect(signInUrlFor("/viva", "?class=9")).toBe(
      "/sign-in?next=%2Fviva%3Fclass%3D9",
    );
  });

  test("stays clean when the destination is just home", () => {
    expect(signInUrlFor("/")).toBe("/sign-in");
  });
});

describe("addresses for groups", () => {
  test("a group and an invite carry their id in the query string", () => {
    expect(teachGroupPath("a b")).toBe("/teach/group?id=a%20b");
    expect(joinPath("K7QX2M")).toBe("/join?code=K7QX2M");
    expect(studentGroupPath("g1")).toBe("/groups/group?id=g1");
    expect(teachAssignPath("g1")).toBe("/teach/assign?id=g1");
    expect(startAssignedPath("a1")).toBe("/?assignment=a1");
  });

  test("each kind of account has its own start page", () => {
    expect(homePathFor("student")).toBe("/");
    expect(homePathFor("educator")).toBe("/teach");
  });

  test("onboarding remembers where someone was going, but not home", () => {
    expect(onboardingUrlFor("/join", "?code=K7QX2M")).toBe(
      "/onboarding?next=%2Fjoin%3Fcode%3DK7QX2M",
    );
    expect(onboardingUrlFor("/")).toBe("/onboarding");
    expect(onboardingUrlFor("//evil.example")).toBe("/onboarding");
  });
});
