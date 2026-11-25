import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

/**
 * The way back to the page above, at the top of a page.
 *
 * Bold and in full-strength text: it is how people find their way around on a
 * phone, so it must not read as a faint caption.
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
      variant="ghost"
      size="touch"
      className="-ml-3 max-w-full self-start px-3 font-semibold text-foreground"
    >
      <Link href={href}>
        <ArrowLeftIcon aria-hidden="true" strokeWidth={2.5} />
        <span className="truncate">{children}</span>
      </Link>
    </Button>
  );
}
