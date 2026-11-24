/**
 * Which addresses are for signed-out people, and where to send everyone else.
 *
 * Ambrace has no public pages. The site is plain files with no server in
 * front, so the gate runs in the browser: `SessionGate` around the app and
 * `SignedOutOnly` on the sign-in screens. Neither protects data; the backend
 * checks every request.
 */

export const SIGN_IN_PATH = "/sign-in";
export const SIGN_UP_PATH = "/sign-up";
export const RESET_PASSWORD_PATH = "/reset-password";
export const AUTH_CALLBACK_PATH = "/auth/callback";
export const ONBOARDING_PATH = "/onboarding";
export const HOME_PATH = "/";
export const VIVA_PATH = "/viva";
export const JOIN_PATH = "/join";
export const JOIN_CODE_PARAM = "code";

/** Home, pointing out one set viva: where a group's "Start" leads. */
export const ASSIGNMENT_PARAM = "assignment";
export const startAssignedPath = (assignmentId: string) =>
  `${HOME_PATH}?${ASSIGNMENT_PARAM}=${encodeURIComponent(assignmentId)}`;

/** A student's groups, and one of them. */
export const STUDENT_GROUPS_PATH = "/groups";
export const STUDENT_GROUP_PATH = "/groups/group";
export const studentGroupPath = (groupId: string) =>
  `${STUDENT_GROUP_PATH}?${GROUP_ID_PARAM}=${encodeURIComponent(groupId)}`;

/** The educator's side of the app: their groups and what they assign. */
export const TEACH_PATH = "/teach";
export const TEACH_GROUP_PATH = "/teach/group";
export const GROUP_ID_PARAM = "id";

/** Setting a viva for one group. */
export const TEACH_ASSIGN_PATH = "/teach/assign";
export const teachAssignPath = (groupId: string) =>
  `${TEACH_ASSIGN_PATH}?${GROUP_ID_PARAM}=${encodeURIComponent(groupId)}`;

/** One group's page. Like reports, the id cannot be part of the path. */
export const teachGroupPath = (groupId: string) =>
  `${TEACH_GROUP_PATH}?${GROUP_ID_PARAM}=${encodeURIComponent(groupId)}`;

/** The link a teacher shares. Signing in or onboarding first returns to it. */
export const joinPath = (code: string) =>
  `${JOIN_PATH}?${JOIN_CODE_PARAM}=${encodeURIComponent(code)}`;

/** Where each kind of account starts. */
export const homePathFor = (kind: "student" | "educator") =>
  kind === "educator" ? TEACH_PATH : HOME_PATH;

export const REPORT_PATH = "/v";
/** Which report: the site is plain files, so it cannot be part of the path. */
export const REPORT_ID_PARAM = "id";

/** A finished viva's report. The one place its address is written. */
export const reportPath = (sessionId: string) =>
  `${REPORT_PATH}?${REPORT_ID_PARAM}=${encodeURIComponent(sessionId)}`;

/** Screens whose whole purpose is getting signed in. */
const SIGNED_OUT_ONLY = [SIGN_IN_PATH, SIGN_UP_PATH, RESET_PASSWORD_PATH];

/** Reachable while signed out. The callback finishes a Google sign-in. */
const OPEN_PATHS = [...SIGNED_OUT_ONLY, AUTH_CALLBACK_PATH];

function matches(pathname: string, paths: string[]): boolean {
  return paths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function isOpenPath(pathname: string): boolean {
  return matches(pathname, OPEN_PATHS);
}

export function isSignedOutOnlyPath(pathname: string): boolean {
  return matches(pathname, SIGNED_OUT_ONLY);
}

/**
 * The page to return to after signing in.
 *
 * The value comes from the address bar, so anyone can craft it. Only a plain
 * path inside this app is accepted; anything that could leave the site
 * (another host, "//host", a backslash trick, a scheme) falls back to home.
 * Otherwise a link to our sign-in page could bounce a student to a fake one.
 */
export function safeReturnPath(candidate: string | null | undefined): string {
  if (!candidate) return HOME_PATH;
  if (!candidate.startsWith("/")) return HOME_PATH;
  if (candidate.startsWith("//") || candidate.includes("\\")) return HOME_PATH;
  // Control characters are stripped by browsers, which can turn "/\t/host"
  // into "//host".
  if (/[\u0000-\u001f\u007f]/.test(candidate)) return HOME_PATH;

  let parsed: URL;
  try {
    parsed = new URL(candidate, "https://app.invalid");
  } catch {
    return HOME_PATH;
  }
  if (parsed.origin !== "https://app.invalid") return HOME_PATH;
  // Returning to a sign-in screen after signing in would loop.
  if (isOpenPath(parsed.pathname)) return HOME_PATH;

  return `${parsed.pathname}${parsed.search}`;
}

/** The onboarding address that remembers where the person was heading. */
export function onboardingUrlFor(pathname: string, search = ""): string {
  const destination = safeReturnPath(`${pathname}${search}`);
  if (destination === HOME_PATH) return ONBOARDING_PATH;
  return `${ONBOARDING_PATH}?next=${encodeURIComponent(destination)}`;
}

/** The sign-in address that remembers where the person was heading. */
export function signInUrlFor(pathname: string, search = ""): string {
  const destination = safeReturnPath(`${pathname}${search}`);
  if (destination === HOME_PATH) return SIGN_IN_PATH;
  return `${SIGN_IN_PATH}?next=${encodeURIComponent(destination)}`;
}
