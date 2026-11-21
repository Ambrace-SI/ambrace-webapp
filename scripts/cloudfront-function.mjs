// Loads a CloudFront Function from infra/functions so it can be run here.
//
// CloudFront runs those files as plain scripts with a top-level `handler`, so
// they cannot export anything. This reads the file and hands back its handler,
// which lets the tests and the local preview run the exact code that ships.
import { readFileSync } from "node:fs";

export function loadCloudFrontFunction(path) {
  const code = readFileSync(path, "utf8");
  return new Function(`${code}\nreturn handler;`)();
}

export const CLEAN_ADDRESSES = "infra/functions/clean-addresses.js";

/** The file in the bucket that CloudFront will ask for, given an address. */
export function fileFor(uri, handler) {
  return handler({ request: { uri } }).uri;
}
