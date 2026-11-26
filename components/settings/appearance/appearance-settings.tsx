"use client";

import { useId } from "react";

import { THEME_OPTIONS } from "@/components/theme/theme-options";
import { useTheme } from "@/lib/hooks/use-theme";
import type { ThemePreference } from "@/lib/theme/theme";
import { cn } from "@/lib/utils";

/**
 * The Appearance part of Settings: how Ambrace looks on this device.
 *
 * The choice is remembered in this browser only, so a student can keep their
 * phone dark and the school laptop light. This is the one place to change it.
 */
export function AppearanceSettings() {
  const { preference, choose } = useTheme();
  const name = useId();
  const headingId = useId();

  return (
    <section className="flex flex-col gap-3">
      <h4 id={headingId} className="label-mono text-muted-foreground">
        Theme
      </h4>
      {/* Real radio buttons: arrow keys move between them, and a screen
          reader announces "Dark, radio button, 2 of 3". */}
      <div
        role="radiogroup"
        aria-labelledby={headingId}
        className="grid gap-3 sm:grid-cols-3"
      >
        {THEME_OPTIONS.map(({ value, label, description, icon: Icon }) => (
          <label
            key={value}
            className="group flex cursor-pointer flex-col gap-3 glass-card glass-card-link rounded-2xl p-3 has-checked:border-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          >
            <input
              type="radio"
              name={name}
              value={value}
              checked={preference === value}
              onChange={() => choose(value)}
              className="sr-only"
            />
            <ThemePreview theme={value} />
            <span className="flex items-start gap-2.5 px-1 pb-1">
              <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{label}</span>
                <span className="text-sm text-muted-foreground">
                  {description}
                </span>
              </span>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}

/**
 * A small picture of a theme: a page with a side panel and a warm button.
 *
 * It must show Paper and Ink whichever theme is on now, so it uses the brand
 * colours themselves rather than the theme tokens, which follow the page.
 * Device shows both, split down the middle.
 */
function ThemePreview({ theme }: { theme: ThemePreference }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-20 overflow-hidden rounded-lg border border-border"
    >
      {theme !== "dark" ? <MiniPage tone="paper" /> : null}
      {theme !== "light" ? <MiniPage tone="ink" /> : null}
    </span>
  );
}

const TONES = {
  // Paper, Orbit light and Ink: the light theme.
  paper: { page: "bg-[#f4f3ef]", panel: "bg-[#cfcdd8]", line: "bg-[#0b0b10]" },
  // Ink, Graphite and Mist: the dark theme.
  ink: { page: "bg-[#0b0b10]", panel: "bg-[#1c1b25]", line: "bg-[#ecebf2]" },
} as const;

function MiniPage({ tone }: { tone: keyof typeof TONES }) {
  const colours = TONES[tone];
  return (
    <span className={cn("flex flex-1 gap-1.5 p-2", colours.page)}>
      <span className={cn("w-1/4 rounded-sm", colours.panel)} />
      <span className="flex flex-1 flex-col justify-between">
        <span
          className={cn("h-1.5 w-3/5 rounded-full opacity-80", colours.line)}
        />
        <span className="flex items-center gap-1">
          <span className={cn("h-3 flex-1 rounded-sm", colours.panel)} />
          {/* The one warm thing, as on every screen. */}
          <span className="h-3 w-4 rounded-sm bg-ember" />
        </span>
      </span>
    </span>
  );
}
