import {
  BOARDS,
  MAX_CLASS_LEVEL,
  MIN_CLASS_LEVEL,
  type Board,
  type Profile,
  type ProfileUpdate,
} from "@/types/profile";

/**
 * The rules a profile must meet, at onboarding and whenever it is edited in
 * Settings. They are checked in the browser so a student hears about a problem
 * next to the field, before anything is sent. The backend applies the same
 * rules again and has the final say.
 */

export const NAME_MAX_LENGTH = 100;
export const SCHOOL_NAME_MAX_LENGTH = 150;
export const SCHOOL_ADDRESS_MAX_LENGTH = 300;

export type ProfileDraft = {
  name: string;
  classLevel: number | null;
  board: Board | null;
  schoolName: string;
  schoolAddress: string;
};

export const EMPTY_DRAFT: ProfileDraft = {
  name: "",
  classLevel: null,
  board: null,
  schoolName: "",
  schoolAddress: "",
};

/** A saved profile, laid out the way the forms hold it while it is edited. */
export function draftFromProfile(profile: Profile): ProfileDraft {
  return {
    name: profile.name,
    classLevel: profile.class_level,
    board: profile.board,
    schoolName: profile.school_name ?? "",
    schoolAddress: profile.school_address ?? "",
  };
}

export type ProfileErrors = Partial<
  Record<"name" | "classLevel" | "schoolName" | "schoolAddress", string>
>;

// Control characters, plus the characters that reorder text on screen. The
// joiners that Indian scripts rely on are format characters and stay allowed.
const UNSAFE = /[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/;
const UNSAFE_EXCEPT_NEWLINE = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f‪-‮⁦-⁩]/;

export function validateRequired(draft: ProfileDraft): ProfileErrors {
  const errors: ProfileErrors = {};
  const name = draft.name.trim();

  if (!name) {
    errors.name = "Tell us what to call you.";
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = `Keep your name under ${NAME_MAX_LENGTH} characters.`;
  } else if (UNSAFE.test(name)) {
    errors.name =
      "Your name has a character we can't use. Try typing it again.";
  }

  if (draft.classLevel === null) {
    errors.classLevel = "Pick your class.";
  } else if (
    !Number.isInteger(draft.classLevel) ||
    draft.classLevel < MIN_CLASS_LEVEL ||
    draft.classLevel > MAX_CLASS_LEVEL
  ) {
    errors.classLevel = `Pick a class from ${MIN_CLASS_LEVEL} to ${MAX_CLASS_LEVEL}.`;
  }

  return errors;
}

export function validateOptional(draft: ProfileDraft): ProfileErrors {
  const errors: ProfileErrors = {};
  const schoolName = draft.schoolName.trim();
  const schoolAddress = draft.schoolAddress.trim();

  if (schoolName.length > SCHOOL_NAME_MAX_LENGTH) {
    errors.schoolName = `Keep the school name under ${SCHOOL_NAME_MAX_LENGTH} characters.`;
  } else if (UNSAFE.test(schoolName)) {
    errors.schoolName =
      "The school name has a character we can't use. Try typing it again.";
  }

  if (schoolAddress.length > SCHOOL_ADDRESS_MAX_LENGTH) {
    errors.schoolAddress = `Keep the address under ${SCHOOL_ADDRESS_MAX_LENGTH} characters.`;
  } else if (UNSAFE_EXCEPT_NEWLINE.test(schoolAddress)) {
    errors.schoolAddress =
      "The address has a character we can't use. Try typing it again.";
  }

  return errors;
}

export function hasErrors(errors: ProfileErrors): boolean {
  return Object.keys(errors).length > 0;
}

function blankToNull(value: string): string | null {
  return value.trim() || null;
}

/**
 * The request body for a draft that has passed validation.
 *
 * `includeOptional` is false after the first step, so the name and class are
 * saved at once and survive even if the student closes the tab on step two.
 */
export function toProfileUpdate(
  draft: ProfileDraft,
  { includeOptional }: { includeOptional: boolean },
): ProfileUpdate {
  if (draft.classLevel === null) {
    throw new Error("A class is required before the profile can be saved.");
  }
  const required = { name: draft.name.trim(), class_level: draft.classLevel };
  if (!includeOptional) return required;

  return {
    ...required,
    board: draft.board && BOARDS.includes(draft.board) ? draft.board : null,
    school_name: blankToNull(draft.schoolName),
    school_address: blankToNull(draft.schoolAddress),
  };
}

/** A first guess at the name from the sign-in account, so nobody retypes it. */
export function suggestedName(
  attributes: { name?: string; given_name?: string } | undefined,
): string {
  const candidate = (attributes?.name ?? attributes?.given_name ?? "").trim();
  if (!candidate || candidate.includes("@") || UNSAFE.test(candidate))
    return "";
  return candidate.slice(0, NAME_MAX_LENGTH);
}
