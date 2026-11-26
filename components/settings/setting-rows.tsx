import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The building blocks every part of Settings is made of: a titled group, and
 * the rows inside it. A row says what a setting is, what it is now, and offers
 * at most one thing to do about it.
 */

/** Settings that belong together, under one small label. */
export function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h4 className="label-mono text-muted-foreground">{title}</h4>
      <ul className="flex flex-col divide-y divide-border glass-card rounded-2xl px-5">
        {children}
      </ul>
    </section>
  );
}

/**
 * One setting.
 *
 * Normally it shows its value and a button. While it is being changed, the
 * `editor` takes their place, right there in the row: the student never loses
 * sight of which setting they are changing, and no second window is stacked
 * on top of Settings.
 *
 * On a phone the value and the button drop under the words, so a long value
 * is never squeezed and the button stays a full thumb's size.
 */
export function SettingRow({
  label,
  description,
  value,
  action,
  editor,
}: {
  label: string;
  description: ReactNode;
  /** What it is set to now. Leave out for a row that is only an action. */
  value?: ReactNode;
  action?: ReactNode;
  /** The form that changes it, shown in place of the value and the button. */
  editor?: ReactNode;
}) {
  const words = (
    <div className="flex min-w-0 flex-col gap-0.5">
      <p className="font-medium">{label}</p>
      <p className="text-sm text-pretty text-muted-foreground">{description}</p>
    </div>
  );

  if (editor) {
    return (
      <li className="flex flex-col gap-4 py-4">
        {words}
        <div className="animate-rise">{editor}</div>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      {words}
      {value || action ? (
        <div className="flex min-w-0 shrink-0 items-center justify-between gap-4 sm:max-w-[55%] sm:justify-end">
          {value ? <div className="min-w-0 text-sm">{value}</div> : null}
          {action}
        </div>
      ) : null}
    </li>
  );
}

/** A value as the row shows it: one line, or a muted note when there is none. */
export function SettingValue({
  children,
  empty = "Not added",
  className,
}: {
  children: string | null | undefined;
  /** What to say when nothing is set. */
  empty?: string;
  className?: string;
}) {
  const text = children?.trim();
  return (
    <span
      className={cn(
        "block truncate",
        !text && "text-muted-foreground",
        className,
      )}
    >
      {text || empty}
    </span>
  );
}

/** The button at the end of a row. Sized for a thumb, quiet to look at. */
export function RowButton({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      variant="outline"
      size="touch"
      className={cn("shrink-0 px-4 text-sm", className)}
      {...props}
    />
  );
}
