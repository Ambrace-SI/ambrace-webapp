import type { LiveMoment } from "@/lib/viva/live-state";
import { cn } from "@/lib/utils";

/**
 * Who has the floor, drawn with the shapes of the logo.
 *
 * The two arcs are the examiner: they swell while it speaks. The warm point is
 * the student: it breathes while they are being listened to and goes hollow
 * when their microphone is muted. The quiet ring between them turns while
 * something is being worked out. Only one of the three ever moves, so a glance
 * is enough to know whose turn it is.
 *
 * It shows state, not loudness. That keeps it calm, and keeps the picture
 * honest on a slow phone where a live waveform would stutter.
 */
export function VoiceOrb({
  moment,
  className,
}: {
  moment: LiveMoment;
  className?: string;
}) {
  const waiting = moment === "connecting" || moment === "reconnecting";
  const working = moment === "thinking" || moment === "concluding";
  const hollow = moment === "muted";

  return (
    <svg
      viewBox="8 8 104 104"
      aria-hidden="true"
      focusable="false"
      data-moment={moment}
      className={cn(
        "text-foreground transition-opacity duration-500",
        waiting && "opacity-40",
        className,
      )}
    >
      <g
        className={cn(moment === "speaking" && "animate-speak")}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <path d="M53.05 20.61 A40 40 0 0 0 53.05 99.39" />
        <path d="M66.95 20.61 A40 40 0 0 1 66.95 99.39" />
      </g>
      <circle
        cx="60"
        cy="60"
        r="20"
        fill="none"
        stroke="var(--muted-foreground)"
        strokeWidth="0.75"
        strokeDasharray={working ? "3 5" : undefined}
        className={cn(working && "animate-turn")}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
      <circle
        cx="72"
        cy="50"
        r="5"
        fill={hollow ? "none" : "var(--ember)"}
        stroke="var(--ember)"
        strokeWidth="1.5"
        className={cn(moment === "listening" && "animate-breathe")}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
    </svg>
  );
}
