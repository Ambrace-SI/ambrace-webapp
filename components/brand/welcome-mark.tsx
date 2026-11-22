import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

/** The arcs and the point turn about the centre of the mark, not their own. */
const AROUND_CENTRE: CSSProperties = {
  transformBox: "view-box",
  transformOrigin: "60px 60px",
};

/**
 * Home's greeting, drawn with the shapes of the logo.
 *
 * On arrival the two arcs open once, like arms, and the warm point (the
 * student) travels in to its place inside them: you are welcome here. After
 * that only the point breathes, the same "someone is here" it means on every
 * other screen. Two quiet rings hold it, so it reads as a place rather than a
 * picture.
 *
 * The inner orbit uses the muted tone, not the logo kit's faint tint, which
 * disappears on both Paper and Ink. People who ask for less motion see it
 * standing still.
 */
export function WelcomeMark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-rise flex aspect-square items-center justify-center rounded-full border border-border",
        className,
      )}
    >
      {/* Sized from the outer ring, not with padding: percentage padding is
          measured from the page's width, which would crush this circle. */}
      <div className="flex size-4/5 items-center justify-center rounded-full border border-border bg-surface">
        <svg viewBox="0 0 120 120" focusable="false" className="w-[72%]">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path
              className="animate-greet-left"
              style={AROUND_CENTRE}
              d="M53.05 20.61 A40 40 0 0 0 53.05 99.39"
            />
            <path
              className="animate-greet-right"
              style={AROUND_CENTRE}
              d="M66.95 20.61 A40 40 0 0 1 66.95 99.39"
            />
          </g>
          <circle
            cx="60"
            cy="60"
            r="20"
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth="1.25"
          />
          <g className="animate-arrive" style={AROUND_CENTRE}>
            <circle
              cx="72"
              cy="50"
              r="5.5"
              fill="var(--ember)"
              className="animate-breathe"
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                // Breathing waits until the point has arrived.
                animationDelay: "2s",
              }}
            />
          </g>
        </svg>
      </div>
    </div>
  );
}
