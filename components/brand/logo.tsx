import Image from "next/image";

import { cn } from "@/lib/utils";

const FILES = {
  ink: "/brand/ambrace-lowercase-horizontal-reversed.svg",
  paper: "/brand/ambrace-lowercase-horizontal.svg",
} as const;

/**
 * The Ambrace logo, always from the supplied files and never redrawn.
 *
 * The product uses the lowercase wordmark: the logo kit describes it as the
 * softer, app-like version, and saves the capital one for formal surfaces.
 * `surface` says what the logo sits on, so the right colourway is chosen:
 * "ink" and "paper" for surfaces that never change, and "theme" for those
 * that follow light and dark, like the side panel.
 */
export function Logo({
  surface,
  className,
  priority = false,
}: {
  surface: "ink" | "paper" | "theme";
  className?: string;
  priority?: boolean;
}) {
  // The kit's minimum width for the horizontal logo is 120px.
  const sized = cn("h-auto w-[148px]", className);

  if (surface !== "theme") {
    return (
      <Image
        src={FILES[surface]}
        alt="Ambrace"
        width={148}
        height={38}
        priority={priority}
        className={sized}
      />
    );
  }

  // Both colourways are sent and the stylesheet shows one, so the right logo
  // is there from the first paint, with no flash when the theme is read. They
  // are named once, as a single image, so a link around them reads "Ambrace".
  return (
    <span role="img" aria-label="Ambrace" className="inline-flex">
      <Image
        src={FILES.paper}
        alt=""
        width={148}
        height={38}
        priority={priority}
        className={cn(sized, "dark:hidden")}
      />
      <Image
        src={FILES.ink}
        alt=""
        width={148}
        height={38}
        priority={priority}
        className={cn(sized, "hidden dark:block")}
      />
    </span>
  );
}
