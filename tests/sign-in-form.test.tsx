// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { SignInForm } from "@/components/auth/sign-in-form";

const router = { push: vi.fn(), replace: vi.fn() };
let query = "";
// What the screen reports to analytics, recorded here instead of sent.
const analytics = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@/lib/analytics/events", () => ({ track: analytics.track }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(query),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

const signIn = vi.fn();
const signInWithRedirect = vi.fn();
vi.mock("aws-amplify/auth", () => ({
  signIn: (input: unknown) => signIn(input),
  signInWithRedirect: (input: unknown) => signInWithRedirect(input),
}));
vi.mock("@/lib/auth/client", () => ({ configureAuth: vi.fn() }));

const assign = vi.fn();

beforeEach(() => {
  query = "";
  router.push.mockReset();
  signIn.mockReset();
  signInWithRedirect.mockReset();
  assign.mockReset();
  window.sessionStorage.clear();
  vi.stubGlobal("location", { ...window.location, assign });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText("Email"), email);
  if (password) await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  return user;
}

test("obvious slips are caught before anything is sent", async () => {
  render(<SignInForm />);

  await fillAndSubmit("asha", "");

  expect(screen.getByText(/Enter your email address/)).toBeTruthy();
  expect(screen.getByText("Enter your password.")).toBeTruthy();
  expect(signIn).not.toHaveBeenCalled();
});

test("signing in loads the page the student was heading to", async () => {
  query = "next=%2Fv%2F123";
  signIn.mockResolvedValue({
    isSignedIn: true,
    nextStep: { signInStep: "DONE" },
  });
  render(<SignInForm />);

  await fillAndSubmit(" asha@example.com ", "Secret123");

  expect(signIn).toHaveBeenCalledWith({
    username: "asha@example.com",
    password: "Secret123",
  });
  expect(assign).toHaveBeenCalledWith("/v/123");
});

test("a crafted return address cannot send the student to another site", async () => {
  query = "next=https%3A%2F%2Fevil.example";
  signIn.mockResolvedValue({
    isSignedIn: true,
    nextStep: { signInStep: "DONE" },
  });
  render(<SignInForm />);

  await fillAndSubmit("asha@example.com", "Secret123");

  expect(assign).toHaveBeenCalledWith("/");
});

test("a wrong password gets a clear message and the form stays usable", async () => {
  signIn.mockRejectedValue({ name: "NotAuthorizedException" });
  render(<SignInForm />);

  await fillAndSubmit("asha@example.com", "wrong");

  expect((await screen.findByRole("alert")).textContent).toMatch(
    /email and password don't match/,
  );
  expect(
    (screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  expect(assign).not.toHaveBeenCalled();
});

test("an unconfirmed account goes to the code step, with the email kept out of the address bar", async () => {
  signIn.mockResolvedValue({
    isSignedIn: false,
    nextStep: { signInStep: "CONFIRM_SIGN_UP" },
  });
  render(<SignInForm />);

  await fillAndSubmit("asha@example.com", "Secret123");

  expect(router.push).toHaveBeenCalledWith("/sign-up?step=confirm");
  expect(window.sessionStorage.getItem("ambrace.auth.email")).toBe(
    "asha@example.com",
  );
});

test("Google sign-in remembers where to return and hands over to Google", async () => {
  query = "next=%2Fviva";
  signInWithRedirect.mockResolvedValue(undefined);
  render(<SignInForm />);

  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Continue with Google" }));

  expect(signInWithRedirect).toHaveBeenCalledWith({ provider: "Google" });
  expect(window.sessionStorage.getItem("ambrace.auth.return")).toBe("/viva");
});

test("the password can be shown to check for a typo", async () => {
  render(<SignInForm />);
  const password = screen.getByLabelText("Password") as HTMLInputElement;

  expect(password.type).toBe("password");
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Show password" }));
  expect(password.type).toBe("text");
});

test("a Google failure is explained and both ways in work again", async () => {
  signInWithRedirect.mockRejectedValue(new TypeError("Failed to fetch"));
  render(<SignInForm />);
  const google = () =>
    screen.getByRole("button", {
      name: "Continue with Google",
    }) as HTMLButtonElement;

  await userEvent.setup().click(google());

  expect((await screen.findByRole("alert")).textContent).toMatch(/connection/);
  expect(google().disabled).toBe(false);
});

test("someone already signed in is let straight through from Google sign-in", async () => {
  signInWithRedirect.mockRejectedValue({
    name: "UserAlreadyAuthenticatedException",
  });
  render(<SignInForm />);

  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Continue with Google" }));

  expect(assign).toHaveBeenCalledWith("/");
});

test("someone already signed in is let straight through from email sign-in", async () => {
  signIn.mockRejectedValue({ name: "UserAlreadyAuthenticatedException" });
  render(<SignInForm />);

  await fillAndSubmit("asha@example.com", "Secret123");

  expect(assign).toHaveBeenCalledWith("/");
});

test("an unconfirmed account reported as an error also goes to the code step", async () => {
  signIn.mockRejectedValue({ name: "UserNotConfirmedException" });
  render(<SignInForm />);

  await fillAndSubmit("asha@example.com", "Secret123");

  expect(router.push).toHaveBeenCalledWith("/sign-up?step=confirm");
});

test("a sign-in step this app does not offer is reported, not left hanging", async () => {
  signIn.mockResolvedValue({
    isSignedIn: false,
    nextStep: { signInStep: "CONFIRM_SIGN_IN_WITH_TOTP_CODE" },
  });
  render(<SignInForm />);

  await fillAndSubmit("asha@example.com", "Secret123");

  expect((await screen.findByRole("alert")).textContent).toMatch(
    /couldn't finish signing you in/,
  );
  expect(assign).not.toHaveBeenCalled();
});

test("while one way in is working, the other cannot be started", async () => {
  signIn.mockReturnValue(new Promise(() => undefined));
  render(<SignInForm />);

  await fillAndSubmit("asha@example.com", "Secret123");

  expect(
    (
      screen.getByRole("button", {
        name: "Continue with Google",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(screen.getByRole("button", { name: "Signing in…" })).toBeTruthy();
});

test("the links lead to sign-up and password reset", () => {
  render(<SignInForm />);

  expect(
    screen
      .getByRole("link", { name: "Create an account" })
      .getAttribute("href"),
  ).toBe("/sign-up");
  expect(
    screen
      .getByRole("link", { name: "Forgot your password?" })
      .getAttribute("href"),
  ).toBe("/reset-password");
});

describe("what analytics is told", () => {
  beforeEach(() => analytics.track.mockClear());

  test("a password sign-in is counted", async () => {
    signIn.mockResolvedValue({
      isSignedIn: true,
      nextStep: { signInStep: "DONE" },
    });
    render(<SignInForm />);

    await fillAndSubmit("asha@example.com", "Secret123");

    expect(analytics.track.mock.calls).toEqual([
      ["signed_in", { method: "password" }],
    ]);
  });

  test("a refused sign-in is counted by its name, never by the email or message", async () => {
    signIn.mockRejectedValue({
      name: "NotAuthorizedException",
      message: "Incorrect username or password for asha@example.com",
    });
    render(<SignInForm />);

    await fillAndSubmit("asha@example.com", "wrong");
    await screen.findByRole("alert");

    expect(analytics.track.mock.calls).toEqual([
      [
        "sign_in_failed",
        { method: "password", reason: "NotAuthorizedException" },
      ],
    ]);
  });

  test("leaving for Google is counted before the browser goes", async () => {
    signInWithRedirect.mockReturnValue(new Promise(() => undefined));
    render(<SignInForm />);

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /Continue with Google/ }));

    expect(analytics.track.mock.calls).toEqual([
      ["google_sign_in_started", { from: "sign_in" }],
    ]);
  });

  test("a slip caught on the form is not a failed sign-in", async () => {
    render(<SignInForm />);

    await fillAndSubmit("asha", "");

    expect(analytics.track).not.toHaveBeenCalled();
  });
});
