import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ambrace is served as plain files from S3 behind CloudFront: there is no
  // Next.js server in dev or prod. The build writes the whole site to `out/`.
  // Cache Components and Partial Prefetching both need that server, so they
  // are off; Next.js refuses to build an export with them on.
  output: "export",
  // Resizing images needs a server. The only images are the SVG logos.
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
