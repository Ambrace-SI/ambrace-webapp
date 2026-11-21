// Serves the built site (out/) the way CloudFront and S3 will.
//
//   npm run build && npm run preview
//
// `next dev` runs a Next.js server; production has none. This is the honest
// local check: the same address function that ships to CloudFront picks the
// file, and a file that is not there is answered with 404.html and status 404.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

import {
  CLEAN_ADDRESSES,
  fileFor,
  loadCloudFrontFunction,
} from "./cloudfront-function.mjs";

const ROOT = resolve("out");
const PORT = Number(process.env.PORT ?? 3000);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

if (!existsSync(join(ROOT, "index.html"))) {
  console.error("There is no out/index.html. Run `npm run build` first.");
  process.exit(1);
}

const cleanAddresses = loadCloudFrontFunction(CLEAN_ADDRESSES);

/** The file on disk for a bucket key, or null if the bucket would not have it. */
function fileOnDisk(key) {
  const path = normalize(join(ROOT, decodeURIComponent(key)));
  // Never serve anything outside out/, whatever the address says.
  if (!path.startsWith(ROOT)) return null;
  return existsSync(path) && statSync(path).isFile() ? path : null;
}

createServer((request, response) => {
  const { pathname } = new URL(request.url, "http://localhost");
  const found = fileOnDisk(fileFor(pathname, cleanAddresses));
  const path = found ?? join(ROOT, "404.html");

  response.writeHead(found ? 200 : 404, {
    "content-type": TYPES[extname(path)] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(path).pipe(response);
}).listen(PORT, () => {
  console.log(`Serving out/ as CloudFront would, on http://localhost:${PORT}`);
});
