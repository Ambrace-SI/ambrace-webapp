"use client";

import {
  CircleAlertIcon,
  CircleCheckIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  Loader2Icon,
} from "lucide-react";
import { useId, useState, type ComponentProps, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * A labelled text field.
 *
 * The label is always visible (a placeholder disappears the moment you type),
 * the error sits directly under the field it belongs to, and screen readers
 * are told about both. Fields are 44px tall for thumbs.
 */
export function TextField({
  label,
  error,
  hint,
  optional = false,
  className,
  ...props
}: ComponentProps<"input"> & {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
}) {
  const id = useId();
  const describedBy =
    [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={id} optional={optional}>
        {label}
      </FieldLabel>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn("h-11 px-3.5 md:text-base", className)}
        {...props}
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/** A labelled box for a few lines of text, such as an address. */
export function TextAreaField({
  label,
  error,
  optional = false,
  className,
  ...props
}: ComponentProps<"textarea"> & {
  label: string;
  error?: string;
  optional?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={id} optional={optional}>
        {label}
      </FieldLabel>
      <textarea
        id={id}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          "w-full resize-none rounded-lg border border-input bg-transparent px-3.5 py-2.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
          className,
        )}
        {...props}
      />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/** A password field with a show/hide switch, so a typo is easy to spot. */
export function PasswordField({
  label,
  error,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label: string; error?: string }) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn("h-11 px-3.5 pr-12 md:text-base", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {visible ? (
            <EyeOffIcon className="size-4" aria-hidden="true" />
          ) : (
            <EyeIcon className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

export function FieldLabel({
  optional = false,
  children,
  ...props
}: ComponentProps<typeof Label> & { optional?: boolean }) {
  return (
    <Label {...props} className="flex items-baseline justify-between text-sm">
      <span>{children}</span>
      {optional ? (
        <span className="label-mono text-muted-foreground">Optional</span>
      ) : null}
    </Label>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="flex items-start gap-1.5 text-sm text-destructive"
    >
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

const MESSAGE_STYLES = {
  error: {
    icon: CircleAlertIcon,
    className: "border-destructive/40 text-destructive",
    role: "alert",
  },
  success: {
    icon: CircleCheckIcon,
    className: "border-success/40 text-success",
    role: "status",
  },
  info: {
    icon: InfoIcon,
    className: "border-border text-muted-foreground",
    role: "status",
  },
} as const;

/**
 * A message about the whole form. The icon carries the meaning as well as the
 * colour, for anyone who cannot tell the colours apart.
 */
export function FormMessage({
  tone,
  children,
}: {
  tone: keyof typeof MESSAGE_STYLES;
  children: ReactNode;
}) {
  const { icon: Icon, className, role } = MESSAGE_STYLES[tone];
  return (
    <div
      role={role}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm",
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

/**
 * The button that sends a form. While it is working it says so and cannot be
 * pressed again, so an impatient double tap never sends two requests.
 */
export function SubmitButton({
  pending,
  children,
  pendingLabel,
  ...props
}: ComponentProps<typeof Button> & {
  pending: boolean;
  pendingLabel: string;
}) {
  return (
    <Button
      type="submit"
      size="touch"
      disabled={pending || props.disabled}
      aria-busy={pending}
      {...props}
      className={cn("w-full", props.className)}
    >
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
