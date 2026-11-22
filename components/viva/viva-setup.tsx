"use client";

import { XIcon } from "lucide-react";
import type { CSSProperties, FormEvent } from "react";

import { WelcomeMark } from "@/components/brand/welcome-mark";
import { FormMessage } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { ChoiceBar } from "@/components/viva/choice-bar";
import type { CurriculumSelection } from "@/lib/curriculum/types";
import { useVivaSetup, type VivaSetup } from "@/lib/hooks/use-viva-setup";
import { useVivaStore } from "@/lib/store/viva-store";
import { BOARD_LABELS, type Profile } from "@/types/profile";

export type VivaChoice = { selection: CurriculumSelection; voiceName: string };

/**
 * Home: a welcome, and everything needed to begin.
 *
 * The middle of the screen greets the student and does nothing else. What
 * the viva is about is chosen along the bottom, where a chat app keeps its
 * message box, so there is one page to land on and no form to read. Name and
 * class are not asked: we already know them. The side panel is the way to
 * anywhere else.
 */
export function VivaSetup({
  profile,
  starting,
  error,
  onStart,
}: {
  profile: Profile;
  starting: boolean;
  error: string | null;
  onStart: (choice: VivaChoice) => void;
}) {
  const setup = useVivaSetup(profile.class_level);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!setup.resolved || starting) return;
    onStart({ selection: setup.resolved, voiceName: setup.voiceName });
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-10 text-center">
        <WelcomeMark className="w-48 sm:w-60" />
        <Greeting profile={profile} line={lineFor(setup, starting)} />
      </main>

      {/* Always within reach of a thumb, and always saying what happens next. */}
      <div className="sticky bottom-0 mx-auto flex w-full max-w-4xl flex-col gap-3 bg-background px-3 pt-2 pb-4 sm:px-6 sm:pb-6">
        <LastVivaNotice />
        <CatalogNotice setup={setup} />
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <ChoiceBar setup={setup} starting={starting} />
        <p
          className="text-center text-sm text-pretty text-muted-foreground"
          role="status"
        >
          {summaryOf(setup)}
        </p>
      </div>
    </form>
  );
}

/** Each line arrives a beat after the one before, under the mark. */
const after = (milliseconds: number): CSSProperties => ({
  animationDelay: `${milliseconds}ms`,
});

function Greeting({ profile, line }: { profile: Profile; line: string }) {
  const firstName = profile.name.trim().split(/\s+/)[0];
  const details = [
    `Class ${profile.class_level}`,
    profile.board ? BOARD_LABELS[profile.board] : null,
    profile.school_name,
  ].filter(Boolean);

  return (
    <div className="flex max-w-2xl flex-col items-center gap-3">
      <p
        className="label-mono animate-rise text-muted-foreground"
        style={after(500)}
      >
        {details.join(" · ")}
      </p>
      <h1
        className="animate-rise text-5xl font-light tracking-tight sm:text-6xl"
        style={after(620)}
      >
        Hello, {firstName}.
      </h1>
      <p
        className="animate-rise text-lg text-pretty text-muted-foreground"
        style={after(780)}
      >
        {line}
      </p>
    </div>
  );
}

/** The line under the greeting answers what has been chosen so far. */
function lineFor(setup: VivaSetup, starting: boolean): string {
  if (starting) return "Finding your examiner…";
  if (setup.chapter) return `${setup.chapter.name}. Ready when you are.`;
  if (setup.subject)
    return `${setup.subject.name} it is. Which chapter shall we talk through?`;
  return "How are you doing today?";
}

/** The line under the bar always says what happens next. */
function summaryOf(setup: VivaSetup): string {
  if (setup.catalog !== "ready") return "Getting your subjects ready.";
  if (!setup.subject) return "Choose a subject to begin.";
  if (!setup.chapter) return "Now choose a chapter.";
  return "You'll speak with your examiner. Your browser will ask for the microphone.";
}

/** Only shown when the subjects could not be fetched, or there are none. */
function CatalogNotice({ setup }: { setup: VivaSetup }) {
  if (setup.catalog === "failed")
    return (
      <FormMessage tone="error">
        <p>We couldn&apos;t load your subjects.</p>
        <Button
          type="button"
          variant="outline"
          size="touch"
          className="mt-3"
          onClick={setup.retryCatalog}
        >
          Try again
        </Button>
      </FormMessage>
    );
  if (setup.catalog === "ready" && setup.subjects.length === 0)
    return (
      <FormMessage tone="info">
        There are no subjects for Class {setup.selection.classLevel} yet.
      </FormMessage>
    );
  return null;
}

/**
 * When a viva breaks (a blocked microphone, a lost line) the voice engine
 * brings the student back here. Without this they would land on the welcome
 * with no idea why, so the reason stays until it is dismissed or a new viva
 * begins.
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
