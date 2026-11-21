import { describe, expect, test } from "vitest";

import { EXPECTATIONS, problemsWith } from "../scripts/check-live-site.mjs";

/**
 * The check the publish workflow runs against the live site. A check that
 * cannot fail is worse than none, so each kind of fault is shown to be caught.
 */
const PAGE = { path: "/viva", status: 200, type: "text/html" };
const EXPECTED = {
  "x-content-type-options": "nosniff",
  "strict-transport-security": "max-age=31536000",
};
const good = () => ({
  status: 200,
  headers: { "content-type": "text/html; charset=utf-8", ...EXPECTED },
});

describe("checking a response from the live site", () => {
  test("a page with the right status, type and headers has no problems", () => {
    expect(problemsWith(PAGE, good(), EXPECTED)).toEqual([]);
  });

  test("a missing page is reported", () => {
    const response = { ...good(), status: 404 };

    expect(problemsWith(PAGE, response, EXPECTED)).toEqual([
      "/viva: expected status 200, got 404",
    ]);
  });

  test("a wrong address answered with 200 is reported", () => {
    const wrong = { path: "/nowhere", status: 404, type: "text/html" };

    expect(problemsWith(wrong, good(), EXPECTED)).toEqual([
      "/nowhere: expected status 404, got 200",
    ]);
  });

  test("a bucket error page in place of the app's page is reported", () => {
    const response = good();
    response.headers["content-type"] = "application/xml";

    expect(problemsWith(PAGE, response, EXPECTED)).toEqual([
      '/viva: expected a text/html response, got "application/xml"',
    ]);
  });

  test("a response with no content type at all is reported, not crashed on", () => {
    const response = { status: 200, headers: { ...EXPECTED } };

    expect(problemsWith(PAGE, response, EXPECTED)).toEqual([
      '/viva: expected a text/html response, got ""',
    ]);
  });

  test("a missing security header is reported", () => {
    const response = good();
    delete (response.headers as Record<string, string>)[
      "strict-transport-security"
    ];

    expect(problemsWith(PAGE, response, EXPECTED)).toEqual([
      "/viva: strict-transport-security is missing",
    ]);
  });

  test("a security header with a different value is reported", () => {
    const response = good();
    response.headers["strict-transport-security"] = "max-age=60";

    expect(problemsWith(PAGE, response, EXPECTED)).toEqual([
      '/viva: strict-transport-security is "max-age=60", expected "max-age=31536000"',
    ]);
  });

  test("every fault in one response is reported together", () => {
    const response = { status: 500, headers: {} };

    expect(problemsWith(PAGE, response, EXPECTED)).toHaveLength(4);
  });
});

describe("what is checked", () => {
  test("the pages a student needs, a file served as it is, and a wrong address", () => {
    const byPath = Object.fromEntries(
      EXPECTATIONS.map((expectation) => [expectation.path, expectation.status]),
    );

    expect(byPath["/"]).toBe(200);
    expect(byPath["/sign-in"]).toBe(200);
    expect(byPath["/viva"]).toBe(200);
    expect(byPath["/v"]).toBe(200);
    // The voice engine loads this by name; it must never be rewritten.
    expect(byPath["/audio-worklet-processor.js"]).toBe(200);
    expect(Object.values(byPath)).toContain(404);
  });
});
