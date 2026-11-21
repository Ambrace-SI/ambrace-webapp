import { signOut } from "aws-amplify/auth";

import { configureAuth } from "@/lib/auth/client";
import { SIGN_IN_PATH } from "@/lib/auth/routes";

/**
 * Ends the session and returns to the sign-in screen.
 *
 * For a Google account, ending the session at the sign-in service sends the
 * browser back to sign-in by itself. If it fails (offline, or already signed
 * out) leaving the app is still what was asked for, so we go there anyway.
 */
export async function leaveAmbrace(): Promise<void> {
  configureAuth();
  try {
    await signOut();
  } catch {
    // Nothing to do: the destination is the same.
  } finally {
    window.location.assign(SIGN_IN_PATH);
  }
}
