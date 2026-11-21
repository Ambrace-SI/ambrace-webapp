import { describe, expect, test } from "vitest";

import {
  CLEAN_ADDRESSES,
  fileFor,
  loadCloudFrontFunction,
} from "../scripts/cloudfront-function.mjs";

/**
 * The function CloudFront runs on every request, loaded from the very file
 * that is deployed. The build writes `/viva` as `viva.html`; this is what
 * turns the address a browser asks for into the file the bucket has.
 */
const handler = loadCloudFrontFunction(CLEAN_ADDRESSES);
const file = (uri: string) => fileFor(uri, handler);

describe("a page address becomes the file the build wrote", () => {
  test("the home page", () => {
    expect(file("/")).toBe("/index.html");
  });

  test.each([
    ["/viva", "/viva.html"],
    ["/v", "/v.html"],
    ["/sign-in", "/sign-in.html"],
    ["/onboarding", "/onboarding.html"],
    ["/auth/callback", "/auth/callback.html"],
  ])("%s", (address, expected) => {
    expect(file(address)).toBe(expected);
  });

  test("a trailing slash is the same page", () => {
    expect(file("/viva/")).toBe("/viva.html");
    expect(file("/auth/callback/")).toBe("/auth/callback.html");
  });

  test("a wrong address still names a file, which the bucket will not have", () => {
    // CloudFront then answers with the app's 404 page.
    expect(file("/nowhere")).toBe("/nowhere.html");
  });
});

describe("anything that already names a file is left alone", () => {
  test.each([
    "/index.html",
    "/404.html",
    "/favicon.ico",
    "/site.webmanifest",
    "/audio-worklet-processor.js",
    "/brand/ambrace-lowercase-horizontal.svg",
    "/_next/static/chunks/app-1a2b3c.js",
    "/_next/static/media/font-1a2b3c.woff2",
    // What Next.js fetches when a link is followed inside the app.
    "/viva.txt",
    "/__next._tree.txt",
  ])("%s", (address) => {
    expect(file(address)).toBe(address);
  });

  test("a dot in a folder name does not make the page a file", () => {
    expect(file("/v1.2/notes")).toBe("/v1.2/notes.html");
  });
});

test("only the address is changed; the rest of the request is passed on", () => {
  const request = {
    uri: "/viva",
    method: "GET",
    querystring: { class: { value: "9" } },
    headers: { host: { value: "app-dev.ambrace.in" } },
  };

  const result = handler({ request });

  expect(result).toBe(request);
  expect(result.method).toBe("GET");
  expect(result.querystring).toEqual({ class: { value: "9" } });
  expect(result.headers).toEqual({ host: { value: "app-dev.ambrace.in" } });
});
