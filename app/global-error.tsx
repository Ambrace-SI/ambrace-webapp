"use client";

import "./globals.css";

import { useEffect } from "react";

/**
 * The last resort: shown only when the frame every page shares has itself
 * broken, so none of that frame (fonts, providers, the side panel) can be
 * relied on here. It brings its own page and styles, and offers one thing:
 * try again.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[Ambrace] the app failed to render", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col justify-center gap-6 px-6 py-16 sm:px-10">
        <title>Something went wrong · Ambrace</title>
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          <p className="label-mono text-muted-foreground">
            Something went wrong
          </p>
          <h1 className="text-3xl font-light tracking-tight">
            Ambrace couldn&apos;t load
          </h1>
          <p className="max-w-md text-muted-foreground">
            It&apos;s a problem on our side, not something you did. Your reports
            are safe.
          </p>
        </div>
        <div className="mx-auto flex w-full max-w-2xl gap-3">
          <button
            type="button"
            onClick={() => retry()}
            className="h-11 rounded-lg bg-primary px-5 text-base font-medium text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
