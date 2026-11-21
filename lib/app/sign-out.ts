import { signOut } from "aws-amplify/auth";

import { getSignInAccount } from "@/lib/auth/account";
import { configureAuth } from "@/lib/auth/client";
import { SIGN_IN_PATH } from "@/lib/auth/routes";

/**
 * How long a Google account is given to leave for the sign-in service before
 * we return to sign-in ourselves. The trip normally starts within a moment.
 */
const SIGN_IN_SERVICE_WAIT_MS = 5_000;

/** Read before the session ends: afterwards there is nothing to read it from. */
async function signedInWithGoogle(): Promise<boolean> {
  try {
    return (await getSignInAccount()).method === "google";
  } catch {
    return false;
  }
}

/**
 * Ends the session and returns to the sign-in screen.
 *
 * For a Google account, ending the session also sends the browser to the
 * sign-in service, which ends its own session and brings the browser back to
 * sign-in. Going anywhere ourselves at that moment would cancel that trip and
 * leave the service signed in: the next person to press "Continue with
 * Google" on a shared computer would enter this student's account. So for a
 * Google account we wait, and only go ourselves if the trip never starts.
 *
 * If ending the session fails (offline, or already signed out) leaving the app
 * is still what was asked for, so we go to sign-in anyway.
 */
export async function leaveAmbrace(): Promise<void> {
  configureAuth();
  const toSignIn = () => window.location.assign(SIGN_IN_PATH);
  const google = await signedInWithGoogle();

  try {
    await signOut();
  } catch {
    return toSignIn();
  }

  if (google) window.setTimeout(toSignIn, SIGN_IN_SERVICE_WAIT_MS);
  else toSignIn();
}
