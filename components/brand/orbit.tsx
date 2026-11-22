import { cn } from "@/lib/utils";

/**
 * The idea behind the logo, drawn large: two arcs opening like arms around a
 * quiet orbit, with one warm point inside. The warm point is the student.
 *
 * It is an illustration that echoes the mark, not the logo itself, which is
 * why the point may breathe here. The slow pulse says "someone is here and
 * being listened to". It stops for anyone who asks for less motion.
 */
export function Orbit({
  className,
  breathing = true,
}: {
  className?: string;
  breathing?: boolean;
}) {
  return (
    <svg
      viewBox="14 14 92 92"
      aria-hidden="true"
      focusable="false"
      className={cn("text-foreground", className)}
    >
      <path
        d="M53.05 20.61 A40 40 0 0 0 53.05 99.39"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M66.95 20.61 A40 40 0 0 1 66.95 99.39"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle
        cx="60"
        cy="60"
        r="20"
        fill="none"
        stroke="var(--muted-foreground)"
        strokeWidth="0.75"
      />
      <circle
        cx="72"
        cy="50"
        r="5"
        fill="var(--ember)"
        className={cn(breathing && "animate-breathe")}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
    </svg>
  );
}
