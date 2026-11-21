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
vi.mock("@/components/app/home", () => ({ Home: () => <p>home</p> }));
vi.mock("@/components/viva/viva-room", () => ({
  VivaRoom: () => <p>viva room</p>,
}));
vi.mock("@/components/report/viva-report", () => ({
  VivaReport: () => <p>report</p>,
  ReportOutline: () => <p>report outline</p>,
}));
vi.mock("@/components/app/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => (
    <div data-frame="app">{children}</div>
  ),
}));
vi.mock("@/components/app/session-gate", () => ({
  SessionGate: ({
    needs,
    children,
  }: {
    needs: string;
    children: ReactNode;
  }) => <div data-needs={needs}>{children}</div>,
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
    expect(gate?.querySelector("[data-frame=app]")?.textContent).toBe("a page");
  });

  test("home is at the root", async () => {
    const page = await import("@/app/(app)/page");

    render(<page.default />);

    expect(page.metadata.title).toBe("Home");
    expect(screen.getByText("home")).toBeTruthy();
  });

  test("a report sits inside the app", async () => {
    const page = await import("@/app/(app)/v/page");

    render(<page.default />);

    expect(page.metadata.title).toBe("Report");
    expect(screen.getByText("report")).toBeTruthy();
  });

  test("the viva sits inside the app too, so the side panel stays", async () => {
    const page = await import("@/app/(app)/viva/page");

    render(<page.default />);

    expect(page.metadata.title).toBe("Viva");
    expect(screen.getByText("viva room")).toBeTruthy();
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
