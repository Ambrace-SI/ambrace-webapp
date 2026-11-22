"use client";

// Finishes a Google sign-in: this import makes the library read the one-time
// code in the address bar and exchange it for a session.
import "aws-amplify/auth/enable-oauth-listener";

import { getCurrentUser } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AuthHeading } from "@/components/auth/auth-shell";
import { FormMessage } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { configureAuth } from "@/lib/auth/client";
import { takeReturnPath } from "@/lib/auth/handoff";
import { SIGN_IN_PATH } from "@/lib/auth/routes";

/** Long enough for a slow connection, short enough not to feel stuck. */
const GIVE_UP_AFTER_MS = 20_000;

export function AuthCallback() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    configureAuth();
    let finished = false;

    const enterApp = () => {
      if (finished) return;
      finished = true;
      window.location.replace(takeReturnPath());
    };
    const fail = () => {
      if (finished) return;
      finished = true;
      setFailed(true);
    };

    // Google or Cognito refused, or the student pressed "Cancel".
    if (new URLSearchParams(window.location.search).has("error")) fail();

    const stopListening = Hub.listen("auth", ({ payload }) => {
      if (payload.event === "signInWithRedirect") enterApp();
      if (payload.event === "signInWithRedirect_failure") fail();
    });

    // The exchange may already have finished before we started listening.
    getCurrentUser().then(enterApp, () => undefined);

    const timer = window.setTimeout(fail, GIVE_UP_AFTER_MS);
    return () => {
      stopListening();
      window.clearTimeout(timer);
    };
  }, []);

  if (failed) {
    return (
      <>
        <AuthHeading title="That didn't work" />
        <div className="flex flex-col gap-5">
          <FormMessage tone="error">
            We couldn&apos;t finish signing you in with Google. Nothing was
            saved, so it&apos;s safe to try again.
          </FormMessage>
          <Button asChild size="touch" className="w-full">
            <Link href={SIGN_IN_PATH}>Back to sign in</Link>
          </Button>
        </div>
      </>
    );
  }

  return (
    <div
      className="flex flex-col items-center gap-6 py-16 text-center"
      role="status"
    >
      {/* No mark of its own: the signed-out frame already greets with one,
          right above this card. */}
      <p className="label-mono text-muted-foreground">Signing you in</p>
    </div>
  );
}
