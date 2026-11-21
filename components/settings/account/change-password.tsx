"use client";

import { useState } from "react";
import { toast } from "sonner";

import { PasswordChecklist } from "@/components/auth/password-checklist";
import { PasswordField } from "@/components/forms/fields";
import { EditForm } from "@/components/settings/edit-form";
import { changePassword } from "@/lib/auth/account";
import { describeAuthError } from "@/lib/auth/errors";
import { isPasswordAcceptable } from "@/lib/auth/password";

/**
 * Changing the password while signed in.
 *
 * The current password is asked for even though the student is signed in: a
 * phone left unlocked on a desk should not be enough to take the account.
 */
export function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [currentError, setCurrentError] = useState<string>();
  const [nextError, setNextError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit() {
    const currentProblem = current ? undefined : "Enter your current password.";
    const nextProblem = !isPasswordAcceptable(next)
      ? "Your new password doesn't meet all the rules below yet."
      : next === current
        ? "Choose a password different from your current one."
        : undefined;
    setCurrentError(currentProblem);
    setNextError(nextProblem);
    setFormError(undefined);
    if (currentProblem || nextProblem) return;

    setPending(true);
    try {
      await changePassword(current, next);
      toast("Password changed.");
      onDone();
    } catch (error) {
      const name = (error as { name?: string }).name;
      // Here a refusal can only mean the current password was wrong. The
      // sign-in wording ("email and password don't match") would mislead.
      if (name === "NotAuthorizedException")
        setCurrentError("That isn't your current password.");
      else if (name === "InvalidPasswordException")
        setNextError(describeAuthError(error).message);
      else setFormError(describeAuthError(error).message);
      setPending(false);
    }
  }

  return (
    <EditForm
      onSubmit={() => void submit()}
      onCancel={onDone}
      pending={pending}
      error={formError}
      saveLabel="Change password"
    >
      <PasswordField
        label="Current password"
        name="current-password"
        autoComplete="current-password"
        value={current}
        onChange={(event) => setCurrent(event.target.value)}
        error={currentError}
      />
      <div className="flex flex-col gap-3">
        <PasswordField
          label="New password"
          name="new-password"
          autoComplete="new-password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
          error={nextError}
        />
        <PasswordChecklist password={next} />
      </div>
    </EditForm>
  );
}
