// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

/**
 * The files under app/ only decide which screen appears at which address and
 * what it is called. Each screen is tested on its own elsewhere, so here they
 * are replaced by a name and we check the wiring.
 */
vi.mock("@/components/auth/sign-in-form", () => ({
  SignInForm: () => <p>sign-in form</p>,
}));
vi.mock("@/components/auth/sign-up-form", () => ({
  SignUpForm: () => <p>sign-up form</p>,
}));
vi.mock("@/components/auth/reset-password-form", () => ({
  ResetPasswordForm: () => <p>reset form</p>,
}));
vi.mock("@/components/auth/auth-callback", () => ({
  AuthCallback: () => <p>callback</p>,
}));
vi.mock("@/components/auth/auth-shell", () => ({
  AuthShell: ({ children }: { children: ReactNode }) => (
    <div data-frame="signed-out">{children}</div>
  ),
}));
vi.mock("@/components/auth/signed-out-only", () => ({
  SignedOutOnly: () => <span data-gate="signed-out-only" />,
}));
vi.mock("@/components/onboarding/onboarding-flow", () => ({
  OnboardingFlow: () => <p>onboarding</p>,
}));
vi.mock("@/components/viva/viva-room", () => ({
  VivaRoom: () => <p>viva room</p>,
}));
vi.mock("@/components/report/viva-report", () => ({
  VivaReport: () => <p>report</p>,
  ReportOutline: () => <p>report outline</p>,
}));
vi.mock("@/components/app/app-shell", () => ({
  AppShell: ({
    children,
    sidebar,
    homePath,
  }: {
    children: ReactNode;
    sidebar?: ReactNode;
    homePath?: string;
  }) => (
    <div data-frame="app" data-home={homePath}>
      {sidebar}
      {children}
    </div>
  ),
}));
vi.mock("@/components/app/session-gate", () => ({
  SessionGate: ({
    needs,
    audience,
    children,
  }: {
    needs: string;
    audience?: string;
    children: ReactNode;
  }) => (
    <div data-needs={needs} data-audience={audience}>
      {children}
    </div>
  ),
}));
vi.mock("@/components/teach/teach-sidebar", () => ({
  TeachSidebar: () => <nav>teacher panel</nav>,
}));
vi.mock("@/components/teach/group-name-dialog", () => ({
  NewGroupDialog: () => null,
}));
vi.mock("@/components/teach/teach-home", () => ({
  TeachHome: () => <p>teacher home</p>,
}));
vi.mock("@/components/teach/assign-viva", () => ({
  AssignViva: () => <p>assign viva</p>,
}));
vi.mock("@/components/teach/viva-results", () => ({
  VivaResults: () => <p>viva results</p>,
  StudentResultReport: () => <p>student report</p>,
}));
vi.mock("@/components/teach/group-page", () => ({
  GroupPage: () => <p>group page</p>,
}));
vi.mock("@/components/groups/join-group", () => ({
  JoinGroup: () => <p>join group</p>,
}));
vi.mock("@/components/groups/student-groups", () => ({
  StudentGroups: () => <p>student groups</p>,
  StudentGroup: () => <p>student group</p>,
}));

const forwardedTo: string[] = [];
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: (path: string) => forwardedTo.push(path) }),
}));

afterEach(cleanup);

describe("signed-out addresses", () => {
  test.each([
    ["sign-in", "Sign in", "sign-in form"],
    ["sign-up", "Create your account", "sign-up form"],
    ["reset-password", "Reset your password", "reset form"],
    ["auth/callback", "Signing you in", "callback"],
  ])("/%s is titled %j and shows its screen", async (path, title, content) => {
    const page = await import(`@/app/(auth)/${path}/page.tsx`);

    render(<page.default />);

    expect(page.metadata.title).toBe(title);
    expect(screen.getByText(content)).toBeTruthy();
  });

  test("they all sit inside the signed-out frame", async () => {
    const { default: AuthLayout } = await import("@/app/(auth)/layout");

    const { container } = render(
      <AuthLayout>
        <p>a screen</p>
      </AuthLayout>,
    );

    const frame = container.querySelector('[data-frame="signed-out"]');
    expect(frame?.textContent).toBe("a screen");
    // No server turns signed-in people away any more; this does.
    expect(frame?.querySelector('[data-gate="signed-out-only"]')).toBeTruthy();
  });
});

describe("signed-in addresses", () => {
  test("the app needs a profile, and frames the page with the side panel", async () => {
    const { default: AppLayout } = await import("@/app/(app)/layout");

    const { container } = render(
      <AppLayout>
        <p>a page</p>
      </AppLayout>,
    );

    const gate = container.querySelector("[data-needs]");
    expect(gate?.getAttribute("data-needs")).toBe("profile");
    expect(gate?.getAttribute("data-audience")).toBe("student");
    expect(gate?.querySelector("[data-frame=app]")?.textContent).toBe("a page");
  });

  test.each([
    ["groups/page", "Your groups", "student groups"],
    ["groups/group/page", "Group", "student group"],
  ])("a student's %s sits inside the app", async (path, title, content) => {
    const page = await import(`@/app/(app)/${path}.tsx`);

    render(<page.default />);

    expect(page.metadata.title).toBe(title);
    expect(screen.getByText(content)).toBeTruthy();
  });

  test("an invite link opens inside the student's app", async () => {
    const page = await import("@/app/(app)/join/page");

    render(<page.default />);

    expect(page.metadata.title).toBe("Join a group");
    expect(screen.getByText("join group")).toBeTruthy();
  });

  test("home is the viva room: the welcome, the choices and the viva itself", async () => {
    const page = await import("@/app/(app)/page");

    render(<page.default />);

    expect(page.metadata.title).toBe("Home");
    expect(screen.getByText("viva room")).toBeTruthy();
  });

  test("a report sits inside the app", async () => {
    const page = await import("@/app/(app)/v/page");

    render(<page.default />);

    expect(page.metadata.title).toBe("Report");
    expect(screen.getByText("report")).toBeTruthy();
  });

  test("the old viva address still works: it forwards to home", async () => {
    const page = await import("@/app/(app)/viva/page");

    render(<page.default />);

    expect(page.metadata.title).toBe("Viva");
    expect(forwardedTo).toEqual(["/"]);
  });

  test("onboarding only needs a session, or it would redirect to itself", async () => {
    const page = await import("@/app/onboarding/page");

    const { container } = render(<page.default />);

    expect(page.metadata.title).toBe("Welcome");
    expect(
      container.querySelector("[data-needs]")?.getAttribute("data-needs"),
    ).toBe("session");
    expect(screen.getByText("onboarding")).toBeTruthy();
  });
});

describe("the teacher's and parent's side", () => {
  test("needs an educator's profile and has its own panel", async () => {
    const { default: TeachLayout } = await import("@/app/(teach)/layout");

    const { container } = render(
      <TeachLayout>
        <p>a page</p>
      </TeachLayout>,
    );

    const gate = container.querySelector("[data-needs]");
    expect(gate?.getAttribute("data-needs")).toBe("profile");
    expect(gate?.getAttribute("data-audience")).toBe("educator");
    const frame = gate?.querySelector("[data-frame=app]");
    expect(frame?.getAttribute("data-home")).toBe("/teach");
    expect(frame?.textContent).toBe("teacher panela page");
  });

  test.each([
    ["(teach)/teach/page", "Your groups", "teacher home"],
    ["(teach)/teach/group/page", "Group", "group page"],
    ["(teach)/teach/assign/page", "Set a viva", "assign viva"],
    ["(teach)/teach/viva/page", "Viva results", "viva results"],
    ["(teach)/teach/report/page", "Student report", "student report"],
  ])("%s is titled %j", async (path, title, content) => {
    const page = await import(`@/app/${path}.tsx`);

    render(<page.default />);

    expect(page.metadata.title).toBe(title);
    expect(screen.getByText(content)).toBeTruthy();
  });
});
