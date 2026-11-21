"use client";

import { ArrowRightIcon, XIcon } from "lucide-react";
import Link from "next/link";

import { FormMessage } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { VIVA_PATH } from "@/lib/auth/routes";
import { useMe } from "@/lib/hooks/use-me";
import { useVivaStore } from "@/lib/store/viva-store";
import { BOARD_LABELS } from "@/types/profile";

/**
 * The signed-in home. One thing to do here, so one thing is offered: start a
 * viva. Past vivas are in the side panel, on every page.
 */
export function Home() {
  const { data: me } = useMe();
  const profile = me?.profile;
  if (!profile) return <HomeOutline />;

  const firstName = profile.name.split(/\s+/)[0];
  const details = [
    `Class ${profile.class_level}`,
    profile.board ? BOARD_LABELS[profile.board] : null,
    profile.school_name,
  ].filter(Boolean);

  return (
    <main className="animate-rise mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-6 py-12 sm:px-10 sm:py-16">
      <div className="flex flex-col gap-3">
        <p className="label-mono text-muted-foreground">
          {details.join(" · ")}
        </p>
        <h1 className="text-4xl font-light tracking-tight sm:text-5xl">
          Hello, {firstName}.
        </h1>
      </div>

      <LastVivaNotice />

      <section className="flex flex-col items-start gap-5 rounded-xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl">Ready when you are</h2>
          <p className="text-muted-foreground">
            Pick a chapter and talk it through with your examiner. It takes a
            few minutes, and you get a report at the end.
          </p>
        </div>
        <Button asChild variant="ember" size="touch">
          <Link href={VIVA_PATH}>
            Start a viva
            <ArrowRightIcon aria-hidden="true" />
          </Link>
        </Button>
      </section>
    </main>
  );
}

/**
 * When a viva breaks (a blocked microphone, a lost line) the voice engine
 * brings the student back here. Without this they would land on the home
 * screen with no idea why, so the reason travels with them until dismissed.
 */
function LastVivaNotice() {
  const reason = useVivaStore((state) => state.error);
  const setError = useVivaStore((state) => state.setError);
  if (!reason) return null;

  return (
    <FormMessage tone="error">
      <div className="flex items-start justify-between gap-3">
        <p>
          <span className="font-medium">Your viva stopped.</span> {reason}
        </p>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setError(null)}
          className="-m-2 flex size-9 shrink-0 items-center justify-center rounded-lg outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <XIcon className="size-4" aria-hidden="true" />
        </button>
      </div>
    </FormMessage>
  );
}

/**
 * The shape of the home screen while the profile loads: the same blocks in
 * the same places, so nothing jumps when the real content arrives.
 */
function HomeOutline() {
  return (
    <main
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-6 py-12 sm:px-10 sm:py-16"
      aria-busy="true"
    >
      <p className="sr-only" role="status">
        Loading your home screen
      </p>
      <div className="flex flex-col gap-3">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-11 w-64 animate-pulse rounded bg-muted sm:h-12" />
      </div>
      <div className="h-40 animate-pulse rounded-xl border border-border bg-card" />
    </main>
  );
}
