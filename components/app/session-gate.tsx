"use client";

import { signOut } from "aws-amplify/auth";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { Orbit } from "@/components/brand/orbit";
import { Button } from "@/components/ui/button";
import { isSignedOutError } from "@/lib/api/errors";
import { configureAuth } from "@/lib/auth/client";
import { ONBOARDING_PATH, signInUrlFor } from "@/lib/auth/routes";
import { useMe } from "@/lib/hooks/use-me";

/**
 * Decides which signed-in screen a student belongs on.
 *
 * `needs="profile"` guards the app: a student without a profile is sent to
 * onboarding first. `needs="session"` only handles a lost session or a failed
 * request; the onboarding screen uses it and decides the rest itself.
 *
 * While the profile is still loading the page underneath is rendered, not
 * replaced: each page shows its own outline of what is coming. That keeps the
 * page's frame on screen from the first moment instead of a blank wait, and it
 * is what lets Next.js prepare the page ahead of a navigation.
 */
export function SessionGate({
  needs,
  children,
}: {
  needs: "profile" | "session";
  children: ReactNode;
}) {
  const router = useRouter();
  const { data: me, error, refetch, isRefetching } = useMe();

  const signedOut = error ? isSignedOutError(error) : false;
  const misplaced =
    needs === "profile" && me !== undefined && !me.onboarding_complete;

  useEffect(() => {
    if (!signedOut) return;
    // Nobody is signed in, or the backend no longer accepts this session.
    // Clear what is left and start again, remembering where they were going.
    const { pathname, search } = window.location;
    configureAuth();
    void signOut()
      .catch(() => undefined)
      .finally(() => window.location.replace(signInUrlFor(pathname, search)));
  }, [signedOut]);

  useEffect(() => {
    if (misplaced) router.replace(ONBOARDING_PATH);
  }, [misplaced, router]);

  if (error && !signedOut) {
    return (
      <StatusScreen>
        <h1 className="text-2xl font-light">We can&apos;t reach Ambrace</h1>
        <p className="max-w-sm text-muted-foreground">
          Your account is fine. Check your connection and try again.
        </p>
        <Button
          size="touch"
          onClick={() => void refetch()}
          disabled={isRefetching}
        >
          {isRefetching ? "Trying…" : "Try again"}
        </Button>
      </StatusScreen>
    );
  }

  if (signedOut || misplaced) {
    return (
      <StatusScreen>
        <Orbit className="w-16" />
        <p className="label-mono text-muted-foreground" role="status">
          One moment
        </p>
      </StatusScreen>
    );
  }

  return children;
}

function StatusScreen({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      {children}
    </div>
  );
}
