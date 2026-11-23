// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { SignUpForm } from "@/components/auth/sign-up-form";
import { privateContentLeaks } from "./helpers/private-content";

let query = "";
// What the screen reports to analytics, recorded here instead of sent.
const analytics = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@/lib/analytics/events", () => ({ track: analytics.track }));

vi.mock("next/navigation", () => ({
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

const auth = {
  signUp: vi.fn(),
  confirmSignUp: vi.fn(),
  autoSignIn: vi.fn(),
  resendSignUpCode: vi.fn(),
  signInWithRedirect: vi.fn(),
};
vi.mock("aws-amplify/auth", () => ({
  signUp: (input: unknown) => auth.signUp(input),
  confirmSignUp: (input: unknown) => auth.confirmSignUp(input),
  autoSignIn: () => auth.autoSignIn(),
  resendSignUpCode: (input: unknown) => auth.resendSignUpCode(input),
  signInWithRedirect: (input: unknown) => auth.signInWithRedirect(input),
}));
vi.mock("@/lib/auth/client", () => ({ configureAuth: vi.fn() }));

const assign = vi.fn();

beforeEach(() => {
  query = "";
  Object.values(auth).forEach((mock) => mock.mockReset());
  auth.signUp.mockResolvedValue({ isSignUpComplete: false });
  auth.confirmSignUp.mockResolvedValue({ isSignUpComplete: true });
  auth.autoSignIn.mockResolvedValue({ isSignedIn: true });
  auth.resendSignUpCode.mockResolvedValue({});
  assign.mockReset();
  window.sessionStorage.clear();
  vi.stubGlobal("location", { ...window.location, assign });
  // The one-time-code input measures itself; jsdom has no layout to measure.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  document.elementFromPoint = () => null;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function createAccount(
  email = "asha@example.com",
  password = "Secret123",
) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText("Email"), email);
  if (password) await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Create account" }));
  return user;
}

describe("creating an account", () => {
  test("a weak password is refused before anything is sent, and the rules show why", async () => {
    render(<SignUpForm />);

    await createAccount("asha@example.com", "short");

    expect(screen.getByText(/doesn't meet all the rules/)).toBeTruthy();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  test("a mistyped email is caught before anything is sent", async () => {
    render(<SignUpForm />);

    await createAccount("asha@", "Secret123");

    expect(screen.getByText(/Enter your email address/)).toBeTruthy();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  test("each password rule is ticked off as it is met", async () => {
    render(<SignUpForm />);
    const rules = () =>
      screen.getAllByRole("listitem").map((item) => item.textContent ?? "");

    expect(rules().every((rule) => rule.includes("(not yet)"))).toBe(true);
    await userEvent
      .setup()
      .type(screen.getByLabelText("Password"), "Secret123");
    expect(rules().every((rule) => rule.includes("(done)"))).toBe(true);
  });

  test("a valid form creates the account and asks for the emailed code", async () => {
    render(<SignUpForm />);

    await createAccount(" asha@example.com ", "Secret123");

    await screen.findByRole("heading", { name: "Check your email" });
    expect(auth.signUp).toHaveBeenCalledWith({
      username: "asha@example.com",
      password: "Secret123",
      options: {
        userAttributes: { email: "asha@example.com" },
        autoSignIn: true,
      },
    });
    expect(screen.getByText("asha@example.com")).toBeTruthy();
  });

  test("an email that already has an account says so and stays on the form", async () => {
    auth.signUp.mockRejectedValue({ name: "UsernameExistsException" });
    render(<SignUpForm />);

    await createAccount();

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /already an account/,
    );
    expect(
      screen.queryByRole("heading", { name: "Check your email" }),
    ).toBeNull();
  });

  test("Google sign-up hands over to Google", async () => {
    auth.signInWithRedirect.mockResolvedValue(undefined);
    render(<SignUpForm />);

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(auth.signInWithRedirect).toHaveBeenCalledWith({
      provider: "Google",
    });
  });

  test("a Google failure is explained and the button works again", async () => {
    auth.signInWithRedirect.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<SignUpForm />);
    const google = () =>
      screen.getByRole("button", {
        name: "Continue with Google",
      }) as HTMLButtonElement;

    await userEvent.setup().click(google());

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /connection/,
    );
    expect(google().disabled).toBe(false);
  });
});

describe("confirming the email", () => {
  async function reachCodeStep() {
    render(<SignUpForm />);
    const user = await createAccount();
    await screen.findByRole("heading", { name: "Check your email" });
    return user;
  }

  test("typing the sixth digit confirms without pressing a button, then signs in", async () => {
    const user = await reachCodeStep();

    await user.type(screen.getByLabelText("Confirmation code"), "123456");

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/"));
    expect(auth.confirmSignUp).toHaveBeenCalledWith({
      username: "asha@example.com",
      confirmationCode: "123456",
    });
  });

  test("an incomplete code is not sent", async () => {
    const user = await reachCodeStep();

    await user.type(screen.getByLabelText("Confirmation code"), "123");
    await user.click(screen.getByRole("button", { name: "Confirm email" }));

    expect(screen.getByText("Enter all 6 digits of the code.")).toBeTruthy();
    expect(auth.confirmSignUp).not.toHaveBeenCalled();
  });

  test("a wrong code explains itself and clears the boxes for another try", async () => {
    auth.confirmSignUp.mockRejectedValue({ name: "CodeMismatchException" });
    const user = await reachCodeStep();
    const code = screen.getByLabelText("Confirmation code") as HTMLInputElement;

    await user.type(code, "000000");

    await screen.findByText(/That code isn't right/);
    expect(code.value).toBe("");
    expect(assign).not.toHaveBeenCalled();
  });

  test("when automatic sign-in is unavailable the student is sent to sign in", async () => {
    auth.autoSignIn.mockRejectedValue(new Error("not available"));
    const user = await reachCodeStep();

    await user.type(screen.getByLabelText("Confirmation code"), "123456");

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/sign-in"));
  });

  test("a new code cannot be requested again straight away", async () => {
    await reachCodeStep();

    const resend = screen.getByRole("button", {
      name: /Send again in \d+s/,
    }) as HTMLButtonElement;
    expect(resend.disabled).toBe(true);
    expect(auth.resendSignUpCode).not.toHaveBeenCalled();
  });

  test("changing the email goes back to the form", async () => {
    const user = await reachCodeStep();

    await user.click(
      screen.getByRole("button", { name: "Use a different email" }),
    );

    expect(
      screen.getByRole("heading", { name: "Create your account" }),
    ).toBeTruthy();
  });
});

describe("arriving from sign-in with an unconfirmed account", () => {
  test("starts at the code step with the email already known", () => {
    query = "step=confirm";
    window.sessionStorage.setItem("ambrace.auth.email", "asha@example.com");

    render(<SignUpForm />);

    expect(
      screen.getByRole("heading", { name: "Check your email" }),
    ).toBeTruthy();
    expect(screen.getByText("asha@example.com")).toBeTruthy();
  });

  test("a new code can be requested at once, then the wait begins", async () => {
    query = "step=confirm";
    window.sessionStorage.setItem("ambrace.auth.email", "asha@example.com");
    render(<SignUpForm />);

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Send a new code" }));

    await screen.findByText("We've sent a new code.");
    expect(auth.resendSignUpCode).toHaveBeenCalledWith({
      username: "asha@example.com",
    });
    expect(screen.getByRole("button", { name: /Send again in/ })).toBeTruthy();
  });

  test("a failed resend is explained", async () => {
    query = "step=confirm";
    window.sessionStorage.setItem("ambrace.auth.email", "asha@example.com");
    auth.resendSignUpCode.mockRejectedValue({ name: "LimitExceededException" });
    render(<SignUpForm />);

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Send a new code" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /Too many attempts/,
    );
  });

  test("without a remembered email it falls back to the normal form", () => {
    query = "step=confirm";

    render(<SignUpForm />);

    expect(
      screen.getByRole("heading", { name: "Create your account" }),
    ).toBeTruthy();
  });
});

describe("what analytics is told", () => {
  beforeEach(() => analytics.track.mockClear());

  test("an account created, then the email confirmed, then the sign-in that follows", async () => {
    render(<SignUpForm />);
    const user = await createAccount();
    await screen.findByRole("heading", { name: "Check your email" });

    expect(analytics.track.mock.calls).toEqual([
      ["account_created", { method: "password" }],
    ]);

    await user.type(screen.getByLabelText("Confirmation code"), "123456");
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/"));

    expect(analytics.track.mock.calls.slice(1)).toEqual([
      ["email_confirmed"],
      ["signed_in", { method: "password" }],
    ]);
  });

  test("an account that could not be created is not counted as one", async () => {
    auth.signUp.mockRejectedValue({ name: "UsernameExistsException" });
    render(<SignUpForm />);

    await createAccount();
    await screen.findByRole("alert");

    expect(analytics.track).not.toHaveBeenCalled();
  });

  test("a wrong code is not a confirmed email", async () => {
    auth.confirmSignUp.mockRejectedValue({ name: "CodeMismatchException" });
    render(<SignUpForm />);
    const user = await createAccount();
    await screen.findByRole("heading", { name: "Check your email" });
    analytics.track.mockClear();

    await user.type(screen.getByLabelText("Confirmation code"), "123456");
    await waitFor(() => expect(auth.confirmSignUp).toHaveBeenCalled());

    expect(analytics.track).not.toHaveBeenCalled();
  });

  test("leaving for Google from sign-up says where it began", async () => {
    auth.signInWithRedirect.mockReturnValue(new Promise(() => undefined));
    render(<SignUpForm />);

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /Continue with Google/ }));

    expect(analytics.track.mock.calls).toEqual([
      ["google_sign_in_started", { from: "sign_up" }],
    ]);
  });
});

test("a recording of the code step does not show whose email it is", async () => {
  render(<SignUpForm />);
  await createAccount("asha@example.com");
  await screen.findByRole("heading", { name: "Check your email" });

  expect(screen.getByText("asha@example.com")).toBeTruthy();
  expect(privateContentLeaks(document.body, ["asha@example.com"])).toEqual([]);
});
