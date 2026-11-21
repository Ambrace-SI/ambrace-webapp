import { fetchAuthSession, updatePassword } from "aws-amplify/auth";

import { configureAuth } from "./client";

/** How the student signs in, as far as Settings needs to know. */
export type SignInAccount = {
  /** The address the account belongs to, when the sign-in service gave one. */
  email: string | null;
  /**
   * "google": the password is Google's and cannot be changed from Ambrace.
   * "password": the account has an Ambrace password.
   */
  method: "google" | "password";
};

/**
 * Reads the account from the ID token already held in the browser, so it
 * costs no request and needs no extra permission.
 *
 * Cognito adds an `identities` claim only to accounts that came from another
 * sign-in service. Google is the only one Ambrace offers.
 */
export async function getSignInAccount(): Promise<SignInAccount> {
  configureAuth();
  const session = await fetchAuthSession();
  const claims = session.tokens?.idToken?.payload;
  if (!claims) throw new Error("Nobody is signed in.");

  const { email, identities } = claims;
  return {
    email: typeof email === "string" && email ? email : null,
    method:
      Array.isArray(identities) && identities.length > 0
        ? "google"
        : "password",
  };
}

/** Swaps the Ambrace password for a new one. The current one is the proof. */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  configureAuth();
  await updatePassword({ oldPassword: currentPassword, newPassword });
}
