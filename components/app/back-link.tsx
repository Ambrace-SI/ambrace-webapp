import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

/**
 * The way back to the page above, at the top of a page.
 *
 * A frosted pill with an arrow, not a line of text: many teachers and parents
 * are new to apps, and it has to look like something you press. The arrow
 * side is padded less than the label side, because a glyph reads as further
 * in than words do.
 */
export function BackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Button
      asChild
      variant="glass"
      size="touch"
      className="group/back max-w-full self-start pr-5 pl-3.5"
    >
      <Link href={href}>
        {/* On hover the arrow leans the way it goes. */}
        <ArrowLeftIcon
          aria-hidden="true"
          strokeWidth={2.5}
          className="transition-transform duration-200 group-hover/back:-translate-x-0.5 motion-reduce:transition-none"
        />
        <span className="truncate">{children}</span>
      </Link>
    </Button>
  );
}
