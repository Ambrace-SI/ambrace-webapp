/* exported handler */

/**
 * CloudFront Function, run on every request before it reaches the bucket.
 *
 * The build writes each page as a file: `/viva` is `viva.html`, the home page
 * is `index.html`. A browser asks for the clean address, so this adds the file
 * name the bucket knows. Anything that already names a file (`.js`, `.css`,
 * `.txt`, an image) is passed through untouched.
 *
 * CloudFront runs this file as it is, with no build step: it must stay plain
 * JavaScript with a top-level `handler`, and cannot import anything.
 */
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // `/viva/` and `/viva` are the same page.
  if (uri.length > 1 && uri.endsWith("/")) uri = uri.slice(0, -1);

  var lastPart = uri.slice(uri.lastIndexOf("/") + 1);
  if (uri === "/") request.uri = "/index.html";
  else if (!lastPart.includes(".")) request.uri = uri + ".html";

  return request;
}
