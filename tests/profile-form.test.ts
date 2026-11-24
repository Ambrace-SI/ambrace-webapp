import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, test } from "vitest";

import {
  httpStatus,
  isSignedOutError,
  isWorthRetrying,
} from "@/lib/api/errors";
import {
  EMPTY_DRAFT,
  draftFromProfile,
  hasErrors,
  suggestedName,
  toProfileUpdate,
  validateOptional,
  validateRequired,
  type ProfileDraft,
} from "@/lib/onboarding/profile-form";

const draft = (changes: Partial<ProfileDraft> = {}): ProfileDraft => ({
  ...EMPTY_DRAFT,
  name: "Asha Rao",
  classLevel: 9,
  ...changes,
});

describe("the two things onboarding insists on", () => {
  test("a name and a class are enough", () => {
    expect(hasErrors(validateRequired(draft()))).toBe(false);
  });

  test("an empty form asks for both, in plain words", () => {
    const errors = validateRequired(EMPTY_DRAFT);

    expect(errors.name).toBe("Tell us what to call you.");
    expect(errors.classLevel).toBe("Pick your class.");
  });

  test("spaces alone are not a name", () => {
    expect(validateRequired(draft({ name: "   " })).name).toBeDefined();
  });

  test("names in Indian scripts are welcome", () => {
    for (const name of ["आशा राव", "கவிதா", "ക്ഷമ"]) {
      expect(validateRequired(draft({ name })).name).toBeUndefined();
    }
  });

  test.each(["Asha\nRao", "Asha\u0000Rao", "Asha‮Rao"])(
    "%j is refused before it is sent",
    (name) => {
      expect(validateRequired(draft({ name })).name).toBeDefined();
    },
  );

  test.each([4, 13, 9.5])("class %s is refused", (classLevel) => {
    expect(validateRequired(draft({ classLevel })).classLevel).toBeDefined();
  });

  test("a name over 100 characters is refused", () => {
    expect(validateRequired(draft({ name: "x".repeat(101) })).name).toMatch(
      /100/,
    );
  });
});

describe("the optional details", () => {
  test("leaving everything blank is fine", () => {
    expect(hasErrors(validateOptional(draft()))).toBe(false);
  });

  test("an address may run over several lines, a school name may not", () => {
    const errors = validateOptional(
      draft({ schoolName: "Hill\nView", schoolAddress: "12 Lake Road\nPune" }),
    );

    expect(errors.schoolName).toBeDefined();
    expect(errors.schoolAddress).toBeUndefined();
  });

  test("lengths match the backend limits", () => {
    const errors = validateOptional(
      draft({ schoolName: "x".repeat(151), schoolAddress: "x".repeat(301) }),
    );

    expect(errors.schoolName).toMatch(/150/);
    expect(errors.schoolAddress).toMatch(/300/);
  });
});

describe("what is sent to the API", () => {
  test("the first step sends only the name and class, trimmed", () => {
    expect(
      toProfileUpdate(draft({ name: "  Asha Rao  ", board: "CBSE" }), {
        includeOptional: false,
      }),
    ).toEqual({ name: "Asha Rao", account_type: "student", class_level: 9 });
  });

  test("the second step sends everything, with blanks as null", () => {
    expect(
      toProfileUpdate(
        draft({ board: "ICSE", schoolName: "  ", schoolAddress: " Pune " }),
        { includeOptional: true },
      ),
    ).toEqual({
      name: "Asha Rao",
      account_type: "student",
      class_level: 9,
      board: "ICSE",
      school_name: null,
      school_address: "Pune",
    });
  });

  test("a draft without a class cannot be turned into a request", () => {
    expect(() =>
      toProfileUpdate(draft({ classLevel: null }), { includeOptional: false }),
    ).toThrow();
  });
});

describe("a teacher's or parent's profile", () => {
  const educator = (changes: Partial<ProfileDraft> = {}) =>
    draft({ accountType: "teacher", classLevel: null, ...changes });

  test("needs only a name, no class", () => {
    expect(hasErrors(validateRequired(educator()))).toBe(false);
    expect(validateRequired(educator({ name: "" })).name).toBeDefined();
  });

  test.each(["teacher", "parent"] as const)(
    "a %s is sent with their type and without a class",
    (accountType) => {
      expect(
        toProfileUpdate(educator({ accountType }), { includeOptional: false }),
      ).toEqual({ name: "Asha Rao", account_type: accountType });
    },
  );
});

describe("the name offered from the sign-in account", () => {
  test("uses the account's name", () => {
    expect(suggestedName({ name: " Asha Rao " })).toBe("Asha Rao");
    expect(suggestedName({ given_name: "Asha" })).toBe("Asha");
  });

  test("offers nothing rather than an email address or nothing at all", () => {
    expect(suggestedName({ name: "asha@example.com" })).toBe("");
    expect(suggestedName({})).toBe("");
    expect(suggestedName(undefined)).toBe("");
  });
});

describe("reading a failed API call", () => {
  const failure = (status?: number) =>
    new AxiosError(
      "failed",
      undefined,
      undefined,
      undefined,
      status === undefined
        ? undefined
        : {
            status,
            statusText: "",
            data: {},
            headers: {},
            config: { headers: new AxiosHeaders() },
          },
    );

  test("an expired session means signing in again, and is never retried", () => {
    expect(isSignedOutError(failure(401))).toBe(true);
    expect(isWorthRetrying(failure(401))).toBe(false);
  });

  test("a server fault or no answer at all is worth another try", () => {
    expect(isWorthRetrying(failure(503))).toBe(true);
    expect(isWorthRetrying(failure())).toBe(true);
    expect(httpStatus(failure())).toBeUndefined();
  });

  test("a rejected request is not retried", () => {
    expect(isWorthRetrying(failure(422))).toBe(false);
  });
});

describe("a saved profile, opened for editing", () => {
  const SAVED = {
    name: "Asha Rao",
    account_type: "student" as const,
    class_level: 9,
    board: "CBSE" as const,
    school_name: "DPS",
    school_address: "12 MG Road",
    created_at: "2026-11-21T10:00:00Z",
    updated_at: "2026-11-21T10:00:00Z",
  };

  test("is laid out the way the forms hold it", () => {
    expect(draftFromProfile(SAVED)).toEqual({
      accountType: "student",
      name: "Asha Rao",
      classLevel: 9,
      board: "CBSE",
      schoolName: "DPS",
      schoolAddress: "12 MG Road",
    });
  });

  test("what was never given is an empty box, not the word null", () => {
    const draft = draftFromProfile({
      ...SAVED,
      board: null,
      school_name: null,
      school_address: null,
    });

    expect(draft.board).toBeNull();
    expect(draft.schoolName).toBe("");
    expect(draft.schoolAddress).toBe("");
  });

  test("saving it unchanged sends back exactly what was saved", () => {
    expect(
      toProfileUpdate(draftFromProfile(SAVED), { includeOptional: true }),
    ).toEqual({
      name: "Asha Rao",
      account_type: "student",
      class_level: 9,
      board: "CBSE",
      school_name: "DPS",
      school_address: "12 MG Road",
    });
  });
});
