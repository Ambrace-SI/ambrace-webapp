"use client";

import {
  useEffect,
  useRef,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { FormMessage, SubmitButton } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { EDIT_FORM_ATTRIBUTE } from "@/lib/settings/editing";

/**
 * The form a setting is changed in, shown inside its row.
 *
 * It exists only while the setting is being changed, so whatever was typed
 * and then cancelled is forgotten: starting again always begins from what is
 * saved. The first thing to fill in takes the cursor, and Escape cancels this
 * form without closing Settings around it.
 */
export function EditForm({
  onSubmit,
  onCancel,
  pending,
  error,
  saveLabel = "Save",
  children,
}: {
  onSubmit: () => void;
  onCancel: () => void;
  pending: boolean;
  error?: string;
  saveLabel?: string;
  children: ReactNode;
}) {
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    form.current
      ?.querySelector<HTMLElement>(
        // A group of choices is entered at the chosen one.
        'input, textarea, [role="radio"][tabindex="0"]',
      )
      ?.focus();
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending) onSubmit();
  }

  function cancelOnEscape(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape" && !pending) onCancel();
  }

  return (
    <form
      ref={form}
      onSubmit={submit}
      onKeyDown={cancelOnEscape}
      noValidate
      className="flex flex-col gap-4"
      {...{ [EDIT_FORM_ATTRIBUTE]: "" }}
    >
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      {children}
      {/* Save is on the right, where a right thumb rests; on a phone, on top. */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          size="touch"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <SubmitButton
          pending={pending}
          pendingLabel="Saving…"
          className="sm:w-auto sm:min-w-28"
        >
          {saveLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
