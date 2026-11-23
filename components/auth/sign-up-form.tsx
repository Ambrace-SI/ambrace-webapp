"use client";

import {
  autoSignIn,
  confirmSignUp,
  resendSignUpCode,
  signInWithRedirect,
  signUp,
} from "aws-amplify/auth";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { AuthHeading } from "@/components/auth/auth-shell";
import { CODE_LENGTH, CodeField } from "@/components/auth/code-field";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { PasswordChecklist } from "@/components/auth/password-checklist";
import {
  FormMessage,
  PasswordField,
  SubmitButton,
  TextField,
} from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/events";
import { PRIVATE_CLASS } from "@/lib/analytics/privacy";
import { configureAuth } from "@/lib/auth/client";
import { describeAuthError } from "@/lib/auth/errors";
import {
  clearPendingEmail,
  readPendingEmail,
  rememberReturnPath,
} from "@/lib/auth/handoff";
import { isPasswordAcceptable, looksLikeEmail } from "@/lib/auth/password";
import { HOME_PATH, SIGN_IN_PATH } from "@/lib/auth/routes";
import { useCooldown } from "@/lib/hooks/use-cooldown";

type Step = "details" | "confirm";
type Notice = { tone: "error" | "info"; text: string };

const RESEND_WAIT_SECONDS = 30;

export function SignUpForm() {
  const startAtConfirm = useSearchParams().get("step") === "confirm";

  // Arriving from sign-in with an unconfirmed account: start at the code step
  // with the email already known. Decided once, as the form first appears.
  const [emailAwaitingCode] = useState(() =>
    startAtConfirm ? readPendingEmail() : "",
  );
  const [step, setStep] = useState<Step>(
    emailAwaitingCode ? "confirm" : "details",
  );
  const [email, setEmail] = useState(emailAwaitingCode);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();
  const [codeError, setCodeError] = useState<string>();
  const [notice, setNotice] = useState<Notice>();
  const [pending, setPending] = useState<"google" | "form" | "resend" | null>(
    null,
  );
  const resend = useCooldown(RESEND_WAIT_SECONDS);

  function enterApp() {
    window.location.assign(HOME_PATH);
  }

  async function continueWithGoogle() {
    setNotice(undefined);
    setPending("google");
    try {
      configureAuth();
      rememberReturnPath(HOME_PATH);
      track("google_sign_in_started", { from: "sign_up" });
      await signInWithRedirect({ provider: "Google" });
    } catch (error) {
      const problem = describeAuthError(error);
      if (problem.action === "already-signed-in") return enterApp();
      setNotice({ tone: "error", text: problem.message });
      setPending(null);
    }
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(undefined);

    const emailProblem = looksLikeEmail(email)
      ? undefined
      : "Enter your email address, like name@example.com.";
    const passwordProblem = isPasswordAcceptable(password)
      ? undefined
      : "Your password doesn't meet all the rules below yet.";
    setEmailError(emailProblem);
    setPasswordError(passwordProblem);
    if (emailProblem || passwordProblem) return;

    setPending("form");
    try {
      configureAuth();
      const address = email.trim();
      await signUp({
        username: address,
        password,
        options: { userAttributes: { email: address }, autoSignIn: true },
      });
      track("account_created", { method: "password" });
      resend.start();
      setStep("confirm");
    } catch (error) {
      const problem = describeAuthError(error);
      setNotice({ tone: "error", text: problem.message });
    }
    setPending(null);
  }

  async function confirmEmail(submitted = code) {
    setNotice(undefined);
    if (submitted.length !== CODE_LENGTH) {
      setCodeError(`Enter all ${CODE_LENGTH} digits of the code.`);
      return;
    }
    setCodeError(undefined);
    setPending("form");
    try {
      configureAuth();
      await confirmSignUp({
        username: email.trim(),
        confirmationCode: submitted,
      });
      clearPendingEmail();
      track("email_confirmed");
      try {
        const result = await autoSignIn();
        if (result.isSignedIn) {
          track("signed_in", { method: "password" });
          return enterApp();
        }
      } catch {
        // Confirmed, but the automatic sign-in was not available (for example
        // when the account was created in an earlier visit).
      }
      window.location.assign(SIGN_IN_PATH);
      return;
    } catch (error) {
      setCodeError(describeAuthError(error).message);
      setCode("");
    }
    setPending(null);
  }

  async function sendAnotherCode() {
    setNotice(undefined);
    setPending("resend");
    try {
      configureAuth();
      await resendSignUpCode({ username: email.trim() });
      resend.start();
      setNotice({ tone: "info", text: "We've sent a new code." });
    } catch (error) {
      setNotice({ tone: "error", text: describeAuthError(error).message });
    }
    setPending(null);
  }

  if (step === "confirm") {
    return (
      <>
        <AuthHeading
          title="Check your email"
          description={
            <>
              We sent a {CODE_LENGTH}-digit code to{" "}
              <span className={`text-foreground ${PRIVATE_CLASS}`}>
                {email}
              </span>
              . It can take a minute to arrive.
            </>
          }
        />
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void confirmEmail();
          }}
          noValidate
          className="flex flex-col gap-5"
        >
          {notice ? (
            <FormMessage tone={notice.tone}>{notice.text}</FormMessage>
          ) : null}
          <CodeField
            value={code}
            onChange={setCode}
            onComplete={(value) => void confirmEmail(value)}
            error={codeError}
            disabled={pending === "form"}
          />
          <SubmitButton
            pending={pending === "form"}
            pendingLabel="Checking…"
            disabled={pending !== null}
          >
            Confirm email
          </SubmitButton>
        </form>
        <div className="mt-6 flex items-center justify-between text-sm">
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-muted-foreground"
            onClick={() => {
              clearPendingEmail();
              setStep("details");
              setCode("");
              setCodeError(undefined);
              setNotice(undefined);
            }}
          >
            Use a different email
          </Button>
          <Button
            type="button"
            variant="link"
            className="h-auto p-0"
            onClick={sendAnotherCode}
            disabled={resend.active || pending !== null}
          >
            {resend.active
              ? `Send again in ${resend.secondsLeft}s`
              : "Send a new code"}
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <AuthHeading
        title="Create your account"
        description="It takes about a minute."
      />

      <GoogleButton
        onClick={continueWithGoogle}
        pending={pending === "google"}
        disabled={pending !== null}
      />

      <OrDivider label="or use email" />

      <form onSubmit={createAccount} noValidate className="flex flex-col gap-5">
        {notice ? (
          <FormMessage tone={notice.tone}>{notice.text}</FormMessage>
        ) : null}

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

        <div className="flex flex-col gap-3">
          <PasswordField
            label="Password"
            name="new-password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={passwordError}
          />
          <PasswordChecklist password={password} />
        </div>

        <SubmitButton
          variant="outline"
          pending={pending === "form"}
          pendingLabel="Creating your account…"
          disabled={pending !== null}
        >
          Create account
        </SubmitButton>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={SIGN_IN_PATH}
          className="text-foreground underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
