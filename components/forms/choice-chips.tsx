"use client";

import { useId, type KeyboardEvent } from "react";

import { FieldError } from "@/components/forms/fields";
import { cn } from "@/lib/utils";

/**
 * Pick one from a short list, with every option visible.
 *
 * A dropdown hides the choices behind a tap and is fiddly on a phone. With
 * eight classes or four boards there is room to show them all, so choosing is
 * one tap on a target that is easy to hit. It behaves as a radio group: arrow
 * keys move the choice, and a screen reader announces "3 of 8".
 */
export function ChoiceChips<Value extends string | number>({
  legend,
  options,
  value,
  onChange,
  error,
  columns,
  optional = false,
}: {
  legend: string;
  options: Array<{ value: Value; label: string }>;
  value: Value | null;
  onChange: (value: Value | null) => void;
  error?: string;
  columns: string;
  /** Optional groups let a second tap clear the choice. */
  optional?: boolean;
}) {
  const id = useId();
  const selectedIndex = options.findIndex((option) => option.value === value);

  function moveBy(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    const group = event.currentTarget.parentElement;
    (group?.children[next] as HTMLElement | undefined)?.focus();
  }

  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-describedby={error ? `${id}-error` : undefined}
    >
      <legend className="mb-2 flex w-full items-baseline justify-between text-sm font-medium">
        <span>{legend}</span>
        {optional ? (
          <span className="label-mono text-muted-foreground">Optional</span>
        ) : null}
      </legend>
      <div
        role="radiogroup"
        aria-label={legend}
        className={cn("grid gap-2", columns)}
      >
        {options.map((option, index) => {
          const selected = option.value === value;
          // One tab stop for the group: the chosen chip, or the first.
          const tabbable = selected || (selectedIndex === -1 && index === 0);
          return (
            <button
              key={String(option.value)}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={tabbable ? 0 : -1}
              onClick={() =>
                onChange(selected && optional ? null : option.value)
              }
              onKeyDown={(event) => moveBy(event, index)}
              className={cn(
                "flex h-11 items-center justify-center rounded-full border px-3 text-base transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] motion-reduce:active:scale-100",
                selected
                  ? "border-primary bg-primary font-semibold text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]"
                  : "glass-card glass-card-link",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </fieldset>
  );
}
