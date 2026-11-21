"use client";

import Link from "next/link";
import { useEffect } from "react";

import { PageNotice } from "@/components/app/page-notice";
import { Button } from "@/components/ui/button";
import { HOME_PATH } from "@/lib/auth/routes";

/**
 * What a student sees when a page breaks while it is being shown.
 *
 * It says plainly that the fault is ours, offers the same page again, and
 * always leaves a way home. The technical detail goes to the console for
 * whoever investigates; it is never put in front of a student.
 */
export function RouteError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[Ambrace] a page failed to render", error);
  }, [error]);

  return (
    <PageNotice
      label="Something went wrong"
      title="That didn't work"
      body="It's a problem on our side, not something you did. Your reports are safe."
    >
      <Button size="touch" onClick={() => retry()}>
        Try again
      </Button>
      <Button asChild variant="ghost" size="touch">
        <Link href={HOME_PATH}>Go to Home</Link>
      </Button>
    </PageNotice>
  );
}
