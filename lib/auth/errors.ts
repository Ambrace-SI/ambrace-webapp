/**
 * Turns a sign-in failure into words a school student can act on.
 *
 * Cognito's own messages are written for engineers ("User pool client ... does
 * not exist") and some reveal whether an email is registered. Every message
 * here says what happened and what to do next, and none confirms that an
 * account exists.
 */

export type AuthProblem = {
  message: string;
  /** What the screen should do about it, beyond showing the message. */
  action?: "confirm-email" | "go-to-sign-in" | "already-signed-in";
};

const PROBLEMS: Record<string, AuthProblem> = {
  // Wrong password and unknown email share one message on purpose.
  NotAuthorizedException: {
    message: "That email and password don't match. Check them and try again.",
  },
  UserNotFoundException: {
    message: "That email and password don't match. Check them and try again.",
  },
  UserNotConfirmedException: {
    message: "Your email isn't confirmed yet. Enter the code we sent you.",
    action: "confirm-email",
  },
  UsernameExistsException: {
    message: "There's already an account for this email. Sign in instead.",
    action: "go-to-sign-in",
  },
  CodeMismatchException: {
    message: "That code isn't right. Check the email and try again.",
  },
  ExpiredCodeException: {
    message: "That code has expired. Ask for a new one.",
  },
  InvalidPasswordException: {
    message:
      "Use at least 8 characters, with an uppercase letter, a lowercase letter and a number.",
  },
  LimitExceededException: {
    message: "Too many attempts. Wait a few minutes, then try again.",
  },
  TooManyRequestsException: {
    message: "Too many attempts. Wait a few minutes, then try again.",
  },
  TooManyFailedAttemptsException: {
    message: "Too many attempts. Wait a few minutes, then try again.",
  },
  CodeDeliveryFailureException: {
    message: "We couldn't send the email. Check the address and try again.",
  },
  UserAlreadyAuthenticatedException: {
    message: "You're already signed in.",
    action: "already-signed-in",
  },
  NetworkError: {
    message: "We can't reach Ambrace. Check your connection and try again.",
  },
};

const UNKNOWN: AuthProblem = {
  message: "Something went wrong on our side. Please try again.",
};

/** Cognito reports a rejected password policy inside a generic error. */
function isPasswordPolicy(name: string, detail: string): boolean {
  return name === "InvalidParameterException" && /password/i.test(detail);
}

/**
 * The sign-in service's own name for a failure ("NotAuthorizedException").
 * Safe to count in analytics: unlike the message, it never names an account.
 */
export function authErrorName(error: unknown): string {
  if (typeof error !== "object" || error === null || !("name" in error))
    return "Unknown";
  return String(error.name) || "Unknown";
}

export function describeAuthError(error: unknown): AuthProblem {
  if (typeof error !== "object" || error === null) return UNKNOWN;
  const name = "name" in error ? String(error.name) : "";
  const detail = "message" in error ? String(error.message) : "";

  if (isPasswordPolicy(name, detail)) return PROBLEMS.InvalidPasswordException;
  if (/network|failed to fetch/i.test(`${name} ${detail}`)) {
    return PROBLEMS.NetworkError;
  }
  return PROBLEMS[name] ?? UNKNOWN;
}
