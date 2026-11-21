"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { getAccessToken } from "@/lib/auth/client";
import { isSignedOutOnlyPath, safeReturnPath } from "@/lib/auth/routes";

/**
 * Moves a student who is already signed in off the sign-in screens, to where
 * they were heading. It draws nothing: the form stays up for the moment the
 * check takes, which is the right screen for everyone else.
 *
 * The page that finishes a Google sign-in is left alone; it is busy.
 */
export function SignedOutOnly() {
  const pathname = usePathname();
  const applies = isSignedOutOnlyPath(pathname);

  useEffect(() => {
    if (!applies) return;
    let left = false;
    void getAccessToken().then((token) => {
      if (!token || left) return;
      const next = new URLSearchParams(window.location.search).get("next");
      // A full load, so nothing remembered from the sign-in screen survives.
      window.location.replace(safeReturnPath(next));
    });
    return () => {
      left = true;
    };
  }, [applies]);

  return null;
}
