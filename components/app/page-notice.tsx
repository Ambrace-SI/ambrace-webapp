import type { ReactNode } from "react";

/**
 * A page that has one thing to say instead of its usual content: a wrong
 * address, or something that broke. A small label, a plain sentence about
 * what happened, and what to do next.
 */
export function PageNotice({
  label,
  title,
  body,
  children,
}: {
  label: string;
  title: string;
  body: string;
  /** The ways forward, as buttons or links. */
  children: ReactNode;
}) {
  return (
    <main className="animate-rise mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16 sm:px-10">
      <div className="flex flex-col gap-3">
        <p className="label-mono text-muted-foreground">{label}</p>
        <h1 className="text-3xl font-light tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="max-w-md text-muted-foreground">{body}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">{children}</div>
    </main>
  );
}
