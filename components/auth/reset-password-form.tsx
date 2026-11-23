"use client";

import { confirmResetPassword, resetPassword, signIn } from "aws-amplify/auth";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { AuthHeading } from "@/components/auth/auth-shell";
import { CODE_LENGTH, CodeField } from "@/components/auth/code-field";
import { PasswordChecklist } from "@/components/auth/password-checklist";
import {
  FormMessage,
  PasswordField,
  SubmitButton,
  TextField,
} from "@/components/forms/fields";
import { PRIVATE_CLASS } from "@/lib/analytics/privacy";
import { configureAuth } from "@/lib/auth/client";
import { describeAuthError } from "@/lib/auth/errors";
import { isPasswordAcceptable, looksLikeEmail } from "@/lib/auth/password";
import { HOME_PATH, SIGN_IN_PATH } from "@/lib/auth/routes";

type Step = "request" | "confirm";

export function ResetPasswordForm() {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [codeError, setCodeError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    if (!looksLikeEmail(email)) {
      setEmailError("Enter your email address, like name@example.com.");
      return;
    }
    setEmailError(undefined);
    setPending(true);
    try {
      configureAuth();
      await resetPassword({ username: email.trim() });
      setStep("confirm");
    } catch (error) {
      const name = (error as { name?: string }).name;
      // An unknown email moves on like a known one, so this screen cannot be
      // used to find out who has an account.
      if (name === "UserNotFoundException") setStep("confirm");
      else setFormError(describeAuthError(error).message);
    }
    setPending(false);
  }

  async function chooseNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);

    const codeProblem =
      code.length === CODE_LENGTH
        ? undefined
        : `Enter all ${CODE_LENGTH} digits of the code.`;
    const passwordProblem = isPasswordAcceptable(password)
      ? undefined
      : "Your password doesn't meet all the rules below yet.";
    setCodeError(codeProblem);
    setPasswordError(passwordProblem);
    if (codeProblem || passwordProblem) return;

    setPending(true);
    try {
      configureAuth();
      const address = email.trim();
      await confirmResetPassword({
        username: address,
        confirmationCode: code,
        newPassword: password,
      });
      // They have just proved who they are and typed the new password, so
      // sign them in rather than asking for it again.
      try {
        const result = await signIn({ username: address, password });
        if (result.isSignedIn) return window.location.assign(HOME_PATH);
      } catch {
        // Fall through to the sign-in screen.
      }
      return window.location.assign(SIGN_IN_PATH);
    } catch (error) {
      const problem = describeAuthError(error);
      const name = (error as { name?: string }).name;
      if (name === "CodeMismatchException" || name === "ExpiredCodeException") {
        setCodeError(problem.message);
        setCode("");
      } else {
        setFormError(problem.message);
      }
    }
    setPending(false);
  }

  if (step === "confirm") {
    return (
      <>
        <AuthHeading
          title="Choose a new password"
          description={
            <>
              If there&apos;s an account for{" "}
              <span className={`text-foreground ${PRIVATE_CLASS}`}>
                {email}
              </span>
              , we&apos;ve sent it a {CODE_LENGTH}-digit code.
            </>
          }
        />
        <form
          onSubmit={chooseNewPassword}
          noValidate
          className="flex flex-col gap-5"
        >
          {formError ? (
            <FormMessage tone="error">{formError}</FormMessage>
          ) : null}
          <CodeField
            value={code}
            onChange={setCode}
            error={codeError}
            disabled={pending}
          />
          <div className="flex flex-col gap-3">
            <PasswordField
              label="New password"
              name="new-password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={passwordError}
            />
            <PasswordChecklist password={password} />
          </div>
          <SubmitButton pending={pending} pendingLabel="Saving…">
            Save and sign in
          </SubmitButton>
        </form>
        <BackToSignIn />
      </>
    );
  }

  return (
    <>
      <AuthHeading
        title="Forgot your password?"
        description="Tell us your email and we'll send a code to reset it."
      />
      <form onSubmit={requestCode} noValidate className="flex flex-col gap-5">
        {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={emailError}
        />
        <SubmitButton pending={pending} pendingLabel="Sending…">
          Send the code
        </SubmitButton>
      </form>
      <BackToSignIn />
    </>
  );
}

function BackToSignIn() {
  return (
    <p className="mt-8 text-center text-sm text-muted-foreground">
      Remembered it?{" "}
      <Link
        href={SIGN_IN_PATH}
        className="text-foreground underline underline-offset-4"
      >
        Back to sign in
      </Link>
    </p>
  );
}
