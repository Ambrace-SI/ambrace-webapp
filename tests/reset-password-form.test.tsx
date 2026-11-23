// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { privateContentLeaks } from "./helpers/private-content";

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
  resetPassword: vi.fn(),
  confirmResetPassword: vi.fn(),
  signIn: vi.fn(),
};
vi.mock("aws-amplify/auth", () => ({
  resetPassword: (input: unknown) => auth.resetPassword(input),
  confirmResetPassword: (input: unknown) => auth.confirmResetPassword(input),
  signIn: (input: unknown) => auth.signIn(input),
}));
vi.mock("@/lib/auth/client", () => ({ configureAuth: vi.fn() }));

const assign = vi.fn();

beforeEach(() => {
  Object.values(auth).forEach((mock) => mock.mockReset());
  auth.resetPassword.mockResolvedValue({});
  auth.confirmResetPassword.mockResolvedValue(undefined);
  auth.signIn.mockResolvedValue({ isSignedIn: true });
  assign.mockReset();
  vi.stubGlobal("location", { ...window.location, assign });
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

async function requestCode(email = "asha@example.com") {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText("Email"), email);
  await user.click(screen.getByRole("button", { name: "Send the code" }));
  return user;
}

describe("asking for a reset code", () => {
  test("a mistyped email is caught before anything is sent", async () => {
    render(<ResetPasswordForm />);

    await requestCode("asha");

    expect(screen.getByText(/Enter your email address/)).toBeTruthy();
    expect(auth.resetPassword).not.toHaveBeenCalled();
  });

  test("a valid email moves on to choosing a new password", async () => {
    render(<ResetPasswordForm />);

    await requestCode(" asha@example.com ");

    await screen.findByRole("heading", { name: "Choose a new password" });
    expect(auth.resetPassword).toHaveBeenCalledWith({
      username: "asha@example.com",
    });
  });

  test("an unknown email looks exactly like a known one", async () => {
    auth.resetPassword.mockRejectedValue({ name: "UserNotFoundException" });
    render(<ResetPasswordForm />);

    await requestCode();

    await screen.findByRole("heading", { name: "Choose a new password" });
    expect(screen.getByText(/If there's an account for/)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("too many requests are explained on the same screen", async () => {
    auth.resetPassword.mockRejectedValue({ name: "LimitExceededException" });
    render(<ResetPasswordForm />);

    await requestCode();

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /Too many attempts/,
    );
    expect(
      screen.getByRole("heading", { name: "Forgot your password?" }),
    ).toBeTruthy();
  });
});

describe("choosing the new password", () => {
  async function reachSecondStep() {
    render(<ResetPasswordForm />);
    const user = await requestCode();
    await screen.findByRole("heading", { name: "Choose a new password" });
    return user;
  }

  async function submit(
    user: ReturnType<typeof userEvent.setup>,
    code: string,
    password: string,
  ) {
    if (code) await user.type(screen.getByLabelText("Confirmation code"), code);
    if (password) {
      await user.type(screen.getByLabelText("New password"), password);
    }
    await user.click(screen.getByRole("button", { name: "Save and sign in" }));
  }

  test("both the code and a strong password are required", async () => {
    const user = await reachSecondStep();

    await submit(user, "123", "weak");

    expect(screen.getByText("Enter all 6 digits of the code.")).toBeTruthy();
    expect(screen.getByText(/doesn't meet all the rules/)).toBeTruthy();
    expect(auth.confirmResetPassword).not.toHaveBeenCalled();
  });

  test("saving signs the student straight in, without asking again", async () => {
    const user = await reachSecondStep();

    await submit(user, "123456", "NewSecret1");

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/"));
    expect(auth.confirmResetPassword).toHaveBeenCalledWith({
      username: "asha@example.com",
      confirmationCode: "123456",
      newPassword: "NewSecret1",
    });
    expect(auth.signIn).toHaveBeenCalledWith({
      username: "asha@example.com",
      password: "NewSecret1",
    });
  });

  test("if signing in afterwards fails, the password is still saved and sign-in is offered", async () => {
    auth.signIn.mockRejectedValue(new Error("unavailable"));
    const user = await reachSecondStep();

    await submit(user, "123456", "NewSecret1");

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/sign-in"));
  });

  test("a wrong code is reported under the code and the boxes are cleared", async () => {
    auth.confirmResetPassword.mockRejectedValue({
      name: "CodeMismatchException",
    });
    const user = await reachSecondStep();

    await submit(user, "000000", "NewSecret1");

    await screen.findByText(/That code isn't right/);
    expect(
      (screen.getByLabelText("Confirmation code") as HTMLInputElement).value,
    ).toBe("");
    expect(assign).not.toHaveBeenCalled();
  });

  test("any other failure is reported for the whole form", async () => {
    auth.confirmResetPassword.mockRejectedValue({
      name: "LimitExceededException",
    });
    const user = await reachSecondStep();

    await submit(user, "123456", "NewSecret1");

    expect(
      (await screen.findByText(/Too many attempts/)).closest("[role]"),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Save and sign in",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
});

test("a recording of the new-password step does not show whose email it is", async () => {
  render(<ResetPasswordForm />);
  await requestCode("asha@example.com");
  await screen.findByRole("heading", { name: "Choose a new password" });

  expect(screen.getByText("asha@example.com")).toBeTruthy();
  expect(privateContentLeaks(document.body, ["asha@example.com"])).toEqual([]);
});
