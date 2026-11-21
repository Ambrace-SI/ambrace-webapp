import { Amplify } from "aws-amplify";
import { fetchAuthSession } from "aws-amplify/auth";

import { buildAuthConfig, readAuthEnvironment } from "./config";

let configured = false;

/**
 * Points the Amplify library at our Cognito user pool. Safe to call often.
 *
 * The session is kept in the browser's own storage, not in cookies. No server
 * reads it, and cookies would be sent along with every file request.
 */
export function configureAuth(): void {
  if (configured) return;
  Amplify.configure(buildAuthConfig(readAuthEnvironment()));
  configured = true;
}

/**
 * The access token for API calls, or null when nobody is signed in.
 *
 * Called before every request rather than cached by us: the library hands back
 * the stored token while it is valid and quietly swaps in a fresh one when it
 * has expired, so a long viva never fails on a stale token.
 *
 * The backend accepts the access token only, never the ID token.
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    configureAuth();
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString() ?? null;
  } catch {
    return null;
  }
}
