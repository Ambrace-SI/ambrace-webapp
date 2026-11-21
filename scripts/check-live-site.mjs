// Checks the site that students actually reach, after a publish.
//
//   node scripts/check-live-site.mjs https://app-dev.ambrace.in '<expected headers as JSON>'
//
// It asks for a few addresses the way a browser would and fails loudly if a
// page is missing, a wrong address is not answered with 404, or a security
// header is absent or different from what the infrastructure says it sends.

/** Pages every build must have, a file that must be served as it is, and an address nothing claims. */
export const EXPECTATIONS = [
  { path: "/", status: 200, type: "text/html" },
  { path: "/sign-in", status: 200, type: "text/html" },
  { path: "/viva", status: 200, type: "text/html" },
  { path: "/v", status: 200, type: "text/html" },
  { path: "/audio-worklet-processor.js", status: 200, type: "javascript" },
  { path: "/no-such-page-on-ambrace", status: 404, type: "text/html" },
];

/**
 * What is wrong with one response, as sentences. Empty means nothing.
 *
 * `headers` is a plain object with lower-case names, as is `expectedHeaders`.
 */
export function problemsWith(expectation, response, expectedHeaders) {
  const problems = [];
  const { path } = expectation;

  if (response.status !== expectation.status)
    problems.push(
      `${path}: expected status ${expectation.status}, got ${response.status}`,
    );

  const type = response.headers["content-type"] ?? "";
  if (!type.includes(expectation.type))
    problems.push(
      `${path}: expected a ${expectation.type} response, got "${type}"`,
    );

  for (const [name, expected] of Object.entries(expectedHeaders)) {
    const actual = response.headers[name];
    if (actual === undefined) problems.push(`${path}: ${name} is missing`);
    else if (actual !== expected)
      problems.push(`${path}: ${name} is "${actual}", expected "${expected}"`);
  }

  return problems;
}

async function main([appUrl, expectedJson]) {
  if (!appUrl || !expectedJson) {
    console.error(
      "Usage: node scripts/check-live-site.mjs <app url> <expected headers JSON>",
    );
    return 2;
  }
  const expectedHeaders = JSON.parse(expectedJson);
  const origin = appUrl.replace(/\/+$/, "");

  const problems = [];
  for (const expectation of EXPECTATIONS) {
    const reply = await fetch(`${origin}${expectation.path}`, {
      redirect: "manual",
    });
    const response = {
      status: reply.status,
      headers: Object.fromEntries(reply.headers),
    };
    const found = problemsWith(expectation, response, expectedHeaders);
    console.log(`${found.length ? "FAIL" : "ok  "} ${expectation.path}`);
    problems.push(...found);
  }

  for (const problem of problems) console.error(`  ${problem}`);
  return problems.length ? 1 : 0;
}

if (process.argv[1]?.endsWith("check-live-site.mjs"))
  process.exitCode = await main(process.argv.slice(2));
