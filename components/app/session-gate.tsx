"use client";

import { signOut } from "aws-amplify/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { Orbit } from "@/components/brand/orbit";
import { Button } from "@/components/ui/button";
import { forgetStudent, identifyStudent } from "@/lib/analytics/identity";
import { isSignedOutError } from "@/lib/api/errors";
import { configureAuth, getAccessToken } from "@/lib/auth/client";
import { homePathFor, onboardingUrlFor, signInUrlFor } from "@/lib/auth/routes";
import { useMe } from "@/lib/hooks/use-me";
import { useSignInAccount } from "@/lib/hooks/use-sign-in-account";
import { sideOf, type Side } from "@/types/profile";

/**
 * Decides which signed-in screen a person belongs on.
 *
 * `needs="profile"` guards the app: someone without a profile is sent to
 * onboarding first, which brings them back here afterwards. `needs="session"`
 * only handles a lost session or a failed request; the onboarding screen uses
 * it and decides the rest itself.
 *
 * `audience` says whose side of the app this is. A student who opens a
 * teacher's page, or a teacher who opens a student's, is sent to their own
 * start page. That is only for their convenience: the backend refuses the
 * data anyway.
 *
 * While the profile is still loading the page underneath is rendered, not
 * replaced: each page shows its own outline of what is coming. That keeps the
 * page's frame on screen from the first moment instead of a blank wait, and it
 * is what lets Next.js prepare the page ahead of a navigation.
 *
 * Whether anyone is signed in on this device is known without the backend, so
 * a visitor with no session goes to sign-in at once: they never wait for the
 * backend to wake, and an outage never stands between them and sign-in.
 */
export function SessionGate({
  needs,
  audience,
  children,
}: {
  needs: "profile" | "session";
  audience?: Side;
  children: ReactNode;
}) {
  const router = useRouter();
  const { data: me, error, refetch, isRefetching } = useMe();
  const account = useSignInAccount();
  const email = account.data?.email ?? null;
  // Read from this device, so it settles at once, with or without an email.
  const emailSettled = !account.isPending;

  const [noSession, setNoSession] = useState(false);

  // The backend no longer accepts a session this device still holds.
  const refused = error ? isSignedOutError(error) : false;
  const signedOut = noSession || refused;
  const notOnboarded =
    needs === "profile" && me !== undefined && !me.onboarding_complete;
  const ownKind = me?.profile ? sideOf(me.profile.account_type) : undefined;
  const wrongSide =
    needs === "profile" &&
    audience !== undefined &&
    ownKind !== undefined &&
    ownKind !== audience;
  const misplaced = notOnboarded || wrongSide;

  useEffect(() => {
    let left = false;
    void getAccessToken().then((token) => {
      if (!token && !left) setNoSession(true);
    });
    return () => {
      left = true;
    };
  }, []);

  useEffect(() => {
    if (!signedOut) return;
    // Start again at sign-in, remembering where they were going.
    const { pathname, search } = window.location;
    const toSignIn = () =>
      window.location.replace(signInUrlFor(pathname, search));
    // With no session there is nothing to clear.
    if (noSession) return toSignIn();
    forgetStudent();
    configureAuth();
    void signOut()
      .catch(() => undefined)
      .finally(toSignIn);
  }, [signedOut, noSession]);

  // Every signed-in screen is inside this gate, so this is the one place the
  // student's events are tied to their account. Runs again when the profile
  // changes, so a new class or board is known straight away.
  useEffect(() => {
    if (me && emailSettled) identifyStudent(me, email);
  }, [me, email, emailSettled]);

  useEffect(() => {
    if (notOnboarded) {
      const { pathname, search } = window.location;
      router.replace(onboardingUrlFor(pathname, search));
    } else if (wrongSide && ownKind) {
      router.replace(homePathFor(ownKind));
    }
  }, [notOnboarded, wrongSide, ownKind, router]);

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

  if (error) {
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

  return children;
}

function StatusScreen({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      {children}
    </div>
  );
}
