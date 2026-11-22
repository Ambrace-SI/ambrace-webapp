"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { HOME_PATH } from "@/lib/auth/routes";

/**
 * Sends anyone on an old address on to home. The site is plain files with no
 * server to redirect, so the browser does it, replacing the old address so
 * Back does not return to it.
 */
export function ForwardHome() {
  const router = useRouter();
  useEffect(() => {
    router.replace(HOME_PATH);
  }, [router]);
  return null;
}
