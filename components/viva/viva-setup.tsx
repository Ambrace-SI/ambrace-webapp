"use client";

import { XIcon } from "lucide-react";
import { Suspense, useState, type CSSProperties, type FormEvent } from "react";

import { WelcomeMark } from "@/components/brand/welcome-mark";
import { FormMessage } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { AssignedList } from "@/components/viva/assigned-list";
import { AssignedPanel } from "@/components/viva/assigned-panel";
import { ChoiceBar } from "@/components/viva/choice-bar";
import { PRIVATE_CLASS } from "@/lib/analytics/privacy";
import type { CurriculumSelection } from "@/lib/curriculum/types";
import { useVivaSetup, type VivaSetup } from "@/lib/hooks/use-viva-setup";
import { useVivaStore } from "@/lib/store/viva-store";
import { cn } from "@/lib/utils";
import { BOARD_LABELS, MIN_CLASS_LEVEL, type Profile } from "@/types/profile";
import type { StudentAssignment } from "@/types/assignments";
import { DEFAULT_VOICE } from "@/types/viva";

export type VivaChoice = { selection: CurriculumSelection; voiceName: string };

/**
 * Home: a welcome, and everything needed to begin.
 *
 * The middle of the screen greets the student and does nothing else. What
 * the viva is about is chosen along the bottom, where a chat app keeps its
 * message box, so there is one page to land on and no form to read. Name and
 * class are not asked: we already know them. Nor is the examiner's voice:
 * every viva uses DEFAULT_VOICE, to keep starting simple. The side panel is
 * the way to anywhere else.
 */
export function VivaSetup({
  profile,
  starting,
  error,
  onStart,
  onStartAssigned,
}: {
  profile: Profile;
  starting: boolean;
  error: string | null;
  onStart: (choice: VivaChoice) => void;
  /** Starts a viva a teacher or parent set; none are offered without it. */
  onStartAssigned?: (assignment: StudentAssignment) => void;
}) {
  // Only students reach this screen (the gate sends educators to /teach), and
  // a student's profile always has a class.
  const setup = useVivaSetup(profile.class_level ?? MIN_CLASS_LEVEL);
  const [allVivasOpen, setAllVivasOpen] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!setup.resolved || starting) return;
    onStart({ selection: setup.resolved, voiceName: DEFAULT_VOICE });
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      {onStartAssigned ? (
        // Every set viva, a tap away in the top corner. It floats: sticky at
        // the top as home scrolls, and taking no room of its own (h-0), so
        // the welcome below never moves.
        <div className="pointer-events-none sticky top-3 z-20 flex h-0 justify-end px-3 sm:top-5 sm:px-6">
          <div className="pointer-events-auto">
            <AssignedPanel
              starting={starting}
              onStart={onStartAssigned}
              open={allVivasOpen}
              onOpenChange={setAllVivasOpen}
            />
          </div>
        </div>
      ) : null}
      <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-10 text-center">
        <WelcomeMark className="w-48 sm:w-60" />
        <Greeting profile={profile} line={lineFor(setup, starting)} />
        {onStartAssigned ? (
          // Which one to point out comes from the address.
          <Suspense fallback={null}>
            <AssignedList
              starting={starting}
              onStart={onStartAssigned}
              onShowAll={() => setAllVivasOpen(true)}
            />
          </Suspense>
        ) : null}
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
        className={cn(
          "label-mono animate-rise text-muted-foreground",
          // Carries the school's name.
          PRIVATE_CLASS,
        )}
        style={after(500)}
      >
        {details.join(" · ")}
      </p>
      <h1
        className="animate-rise text-5xl font-light tracking-tight sm:text-6xl"
        style={after(620)}
      >
        Hello, <span className={PRIVATE_CLASS}>{firstName}</span>.
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
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Dismiss"
          onClick={() => setError(null)}
          className="-m-2"
        >
          <XIcon aria-hidden="true" />
        </Button>
      </div>
    </FormMessage>
  );
}
