import type { Metadata } from "next";
import Link from "next/link";

import { PageNotice } from "@/components/app/page-notice";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { HOME_PATH } from "@/lib/auth/routes";

export const metadata: Metadata = { title: "Page not found" };

/** An address that leads nowhere. */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-6 py-5 sm:px-10">
        <Link
          href={HOME_PATH}
          className="inline-block rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo surface="paper" priority />
        </Link>
      </header>
      <PageNotice
        label="404"
        title="This page doesn't exist"
        body="The address may be mistyped, or the page has moved."
      >
        <Button asChild size="touch">
          <Link href={HOME_PATH}>Go to Home</Link>
        </Button>
      </PageNotice>
    </div>
  );
}
