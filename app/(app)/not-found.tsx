import type { Metadata } from "next";
import Link from "next/link";

import { PageNotice } from "@/components/app/page-notice";
import { Button } from "@/components/ui/button";
import { HOME_PATH } from "@/lib/auth/routes";

export const metadata: Metadata = { title: "Page not found" };

/**
 * An address that leads nowhere, for someone signed in. It sits inside the
 * app frame, so the side panel is still there to go somewhere real.
 */
export default function NotFound() {
  return (
    <PageNotice
      label="404"
      title="This page doesn't exist"
      body="The address may be mistyped, or the page has moved."
    >
      <Button asChild size="touch">
        <Link href={HOME_PATH}>Go to Home</Link>
      </Button>
    </PageNotice>
  );
}
