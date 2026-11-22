import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";
import { WelcomeMark } from "@/components/brand/welcome-mark";

/**
 * The frame around every signed-out screen: sign in, create account, reset
 * password.
 *
 * It follows the student's theme, Paper or Ink, like every other screen. On
 * a laptop the brand sits on the left and the form on the right; on a phone
 * they stack: wordmark, a smaller mark, the words, then the form. It is one
 * grid that rearranges itself, not two copies, so a screen reader hears the
 * welcome once.
 *
 * There is no Ember button here. The only warm thing is the student's dot in
 * the mark, because the student has not arrived yet.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-1 content-start gap-8 bg-background px-5 py-6 text-foreground sm:px-10 lg:grid-cols-[1.1fr_1fr] lg:grid-rows-[auto_1fr_auto] lg:content-stretch lg:gap-0 lg:p-0">
      <header className="lg:col-start-1 lg:row-start-1 lg:px-16 lg:pt-12">
        {/* The word alone: the mark is right below it. */}
        <Logo
          surface="theme"
          variant="wordmark"
          className="w-[120px] lg:w-[132px]"
          priority
        />
      </header>

      <Welcome />

      <main className="flex justify-center lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:items-center lg:px-16">
        <GlassCard>{children}</GlassCard>
      </main>

      <footer className="label-mono text-center text-muted-foreground lg:col-start-1 lg:row-start-3 lg:px-16 lg:pb-10 lg:text-left">
        Ambrace Super Intelligence
      </footer>
    </div>
  );
}

/** Each line arrives a beat after the one before, under the mark. */
const after = (milliseconds: number) => ({
  animationDelay: `${milliseconds}ms`,
});

/**
 * The welcome: the mark greets on every visit, then the promise. These are
 * words, not headings: the form's own title is the page's one heading.
 */
function Welcome() {
  return (
    <section
      aria-label="Welcome to Ambrace"
      className="flex flex-col items-center gap-6 text-center lg:col-start-1 lg:row-start-2 lg:items-start lg:justify-center lg:gap-11 lg:px-16 lg:text-left"
    >
      <WelcomeMark className="w-28 lg:ml-24 lg:w-58" />
      <div className="flex max-w-lg flex-col gap-3 lg:gap-4">
        <p
          className="animate-rise font-heading text-[38px] leading-[1.1] font-light tracking-tight lg:text-[64px] lg:leading-[1.05]"
          style={after(500)}
        >
          Learn differently.
        </p>
        <p
          className="animate-rise text-base text-pretty text-muted-foreground lg:text-lg"
          style={after(640)}
        >
          Spend 10 minutes a day with Ambrace, and discover how you learn best.
        </p>
      </div>
    </section>
  );
}

/**
 * A quiet glass card for the form: the surface colour, slightly see-through,
 * a faint border and a hairline of light along the top edge. No blur, since
 * nothing sits behind it to soften, and no gradient, glow or shadow.
 */
function GlassCard({ children }: { children: ReactNode }) {
  return (
    <div
      data-slot="auth-card"
      className="animate-rise w-full max-w-md rounded-3xl border border-foreground/10 bg-surface/55 p-6 shadow-[inset_0_1px_0_var(--glass-highlight)] sm:p-9"
      style={after(300)}
    >
      {children}
    </div>
  );
}

/** The heading block shared by the signed-out screens. */
export function AuthHeading({
  title,
  description,
}: {
  title: string;
  description?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-2">
      <h1 className="text-3xl font-light tracking-tight">{title}</h1>
      {description ? (
        <p className="text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
