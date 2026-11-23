"use client";

import { signIn, signInWithRedirect } from "aws-amplify/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { AuthHeading } from "@/components/auth/auth-shell";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import {
  FormMessage,
  PasswordField,
  SubmitButton,
  TextField,
} from "@/components/forms/fields";
import { track } from "@/lib/analytics/events";
import { configureAuth } from "@/lib/auth/client";
import { authErrorName, describeAuthError } from "@/lib/auth/errors";
import { rememberPendingEmail, rememberReturnPath } from "@/lib/auth/handoff";
import { looksLikeEmail } from "@/lib/auth/password";
import {
  RESET_PASSWORD_PATH,
  SIGN_UP_PATH,
  safeReturnPath,
} from "@/lib/auth/routes";

type Pending = "google" | "email" | null;

export function SignInForm() {
  const router = useRouter();
  const returnPath = safeReturnPath(useSearchParams().get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState<Pending>(null);

  /** A full page load, so nothing remembered from the sign-in screen survives. */
  function enterApp() {
    window.location.assign(returnPath);
  }

  async function continueWithGoogle() {
    setFormError(undefined);
    setPending("google");
    try {
      configureAuth();
      rememberReturnPath(returnPath);
      track("google_sign_in_started", { from: "sign_in" });
      await signInWithRedirect({ provider: "Google" });
      // The browser is now leaving for Google; keep the button busy.
    } catch (error) {
      const problem = describeAuthError(error);
      if (problem.action === "already-signed-in") return enterApp();
      track("sign_in_failed", {
        method: "google",
        reason: authErrorName(error),
      });
      setFormError(problem.message);
      setPending(null);
    }
  }

  async function signInWithEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);

    const emailProblem = looksLikeEmail(email)
      ? undefined
      : "Enter your email address, like name@example.com.";
    const passwordProblem = password ? undefined : "Enter your password.";
    setEmailError(emailProblem);
    setPasswordError(passwordProblem);
    if (emailProblem || passwordProblem) return;

    setPending("email");
    try {
      configureAuth();
      const result = await signIn({ username: email.trim(), password });
      if (result.isSignedIn) {
        track("signed_in", { method: "password" });
        return enterApp();
      }
      if (result.nextStep.signInStep === "CONFIRM_SIGN_UP") {
        rememberPendingEmail(email);
        return router.push(`${SIGN_UP_PATH}?step=confirm`);
      }
      setFormError("We couldn't finish signing you in. Please try again.");
    } catch (error) {
      const problem = describeAuthError(error);
      if (problem.action === "already-signed-in") return enterApp();
      if (problem.action === "confirm-email") {
        rememberPendingEmail(email);
        return router.push(`${SIGN_UP_PATH}?step=confirm`);
      }
      track("sign_in_failed", {
        method: "password",
        reason: authErrorName(error),
      });
      setFormError(problem.message);
    }
    setPending(null);
  }

  return (
    <>
      <AuthHeading
        title="Welcome back"
        description="Sign in to carry on practising."
      />

      <GoogleButton
        onClick={continueWithGoogle}
        pending={pending === "google"}
        disabled={pending !== null}
      />

      <OrDivider label="or use email" />

      <form
        onSubmit={signInWithEmail}
        noValidate
        className="flex flex-col gap-5"
      >
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

        <div className="flex flex-col gap-2">
          <PasswordField
            label="Password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={passwordError}
          />
          <Link
            href={RESET_PASSWORD_PATH}
            className="self-end text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Forgot your password?
          </Link>
        </div>

        <SubmitButton
          variant="outline"
          pending={pending === "email"}
          pendingLabel="Signing in…"
          disabled={pending !== null}
        >
          Sign in
        </SubmitButton>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        New to Ambrace?{" "}
        <Link
          href={SIGN_UP_PATH}
          className="text-foreground underline underline-offset-4"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}
