"use client";

import { Loader2Icon, PlusIcon } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";

import { FormMessage } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ENTIRE_CHAPTER, validCustomTopic } from "@/lib/curriculum/selection";
import type { CurriculumSelection } from "@/lib/curriculum/types";
import { useVivaSetup, type VivaSetup } from "@/lib/hooks/use-viva-setup";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/profile";
import { AVAILABLE_VOICES } from "@/types/viva";

export type VivaChoice = { selection: CurriculumSelection; voiceName: string };

const MAX_OWN_TOPICS = 20;

/**
 * Choosing what to talk about.
 *
 * The student answers one question at a time, and the next only appears once
 * the one before it is answered: subject, then chapter, then how much of it.
 * Nothing is hidden behind a dropdown, because on a phone every hidden option
 * costs a tap and a scroll. Name and class are not asked: we already know
 * them. The side panel is the way to anywhere else. The only warm thing on
 * the screen is the button that begins.
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
  const firstName = profile.name.split(/\s+/)[0];

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!setup.resolved || starting) return;
    onStart({ selection: setup.resolved, voiceName: setup.voiceName });
  }

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col">
      <main className="animate-rise mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-6 pt-10 pb-12 sm:px-10 sm:pt-14">
        <div className="flex flex-col gap-3">
          <p className="label-mono text-muted-foreground">
            Class {profile.class_level} · {firstName}
          </p>
          <h1 className="text-3xl font-light tracking-tight sm:text-4xl">
            What shall we talk through?
          </h1>
        </div>

        {setup.catalog === "loading" ? <ChoicesOutline /> : null}

        {setup.catalog === "failed" ? (
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
        ) : null}

        {setup.catalog === "ready" ? (
          <Choices setup={setup} disabled={starting} />
        ) : null}
      </main>

      {/* Always within reach of a thumb, and always saying what happens next. */}
      <footer className="sticky bottom-0 border-t border-border bg-background">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-6 py-4 sm:px-10">
          {error ? <FormMessage tone="error">{error}</FormMessage> : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p
              className="min-w-0 text-sm text-pretty text-muted-foreground"
              role="status"
            >
              {summaryOf(setup)}
            </p>
            <Button
              type="submit"
              variant="ember"
              size="touch"
              className="shrink-0 sm:min-w-40"
              disabled={!setup.resolved || starting}
              aria-busy={starting}
            >
              {starting ? (
                <>
                  <Loader2Icon className="animate-spin" aria-hidden="true" />
                  Starting
                </>
              ) : (
                "Start viva"
              )}
            </Button>
          </div>
        </div>
      </footer>
    </form>
  );
}

function summaryOf(setup: VivaSetup): string {
  if (setup.catalog !== "ready") return "Getting your subjects ready.";
  if (!setup.subject) return "Choose a subject to begin.";
  if (!setup.chapter) return "Now choose a chapter.";
  return "You'll speak with your examiner. Your browser will ask for the microphone.";
}

function Choices({ setup, disabled }: { setup: VivaSetup; disabled: boolean }) {
  const id = useId();

  if (setup.subjects.length === 0) {
    return (
      <FormMessage tone="info">
        There are no subjects for Class {setup.selection.classLevel} yet.
      </FormMessage>
    );
  }

  return (
    <>
      <Question legend="Subject">
        <div className="flex flex-wrap gap-2">
          {setup.subjects.map((subject) => (
            <Pill
              key={subject.id}
              type="radio"
              name={`${id}-subject`}
              checked={setup.selection.subjectId === subject.id}
              disabled={disabled}
              onChange={() =>
                setup.select({ type: "subject", value: subject.id })
              }
            >
              {subject.name}
            </Pill>
          ))}
        </div>
      </Question>

      {setup.subject ? (
        // Keyed by subject so the list arrives afresh when the subject changes.
        <Question key={setup.subject.id} legend="Chapter">
          <ol className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
            {setup.chapters.map((chapter, index) => (
              <li
                key={chapter.id}
                className="border-b border-border last:border-b-0"
              >
                <label className="flex min-h-12 cursor-pointer items-center gap-4 px-4 py-2.5 transition-colors hover:bg-muted has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50 has-focus-visible:ring-inset has-disabled:cursor-default has-disabled:opacity-60">
                  <input
                    type="radio"
                    name={`${id}-chapter`}
                    className="sr-only"
                    checked={setup.chosen?.chapterId === chapter.id}
                    disabled={disabled}
                    onChange={() =>
                      setup.select({ type: "chapter", value: chapter.id })
                    }
                  />
                  <span
                    className="label-mono w-5 shrink-0 opacity-60"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <span>{chapter.name}</span>
                </label>
              </li>
            ))}
          </ol>
        </Question>
      ) : null}

      {setup.chapter && setup.chosen ? (
        <>
          <Focus key={setup.chapter.id} setup={setup} disabled={disabled} />
          <Question
            legend="Examiner's voice"
            hint="Pick the one that's easiest for you to follow."
          >
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_VOICES.map((voice) => (
                <Pill
                  key={voice.value}
                  type="radio"
                  name={`${id}-voice`}
                  checked={setup.voiceName === voice.value}
                  disabled={disabled}
                  onChange={() => setup.setVoiceName(voice.value)}
                >
                  {voice.value}
                </Pill>
              ))}
            </div>
          </Question>
        </>
      ) : null}
    </>
  );
}

/**
 * How much of the chapter to cover. "Whole chapter" is the answer unless the
 * student narrows it, so doing nothing here is a valid choice.
 */
function Focus({ setup, disabled }: { setup: VivaSetup; disabled: boolean }) {
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const chapter = setup.chapter!;
  const chosen = setup.chosen!;
  const whole = !chosen.topicIds.length && !chosen.customTopics.length;
  const errorId = useId();

  function addOwnTopic() {
    const name = draft.trim();
    if (!name) return;
    if (!validCustomTopic(name)) {
      setDraftError("Keep a topic to one line of 100 characters or fewer.");
      return;
    }
    if (chosen.customTopics.length >= MAX_OWN_TOPICS) {
      setDraftError(`You can add up to ${MAX_OWN_TOPICS} topics of your own.`);
      return;
    }
    setup.select({ type: "custom-topic", chapterId: chapter.id, value: name });
    setDraft("");
    setDraftError(null);
  }

  return (
    <Question
      legend="Focus"
      hint="Stay on the whole chapter, or pick the parts you want to be asked about."
    >
      <div className="flex flex-wrap gap-2">
        <Pill
          type="checkbox"
          checked={whole}
          disabled={disabled}
          onChange={() =>
            setup.select({
              type: "topic",
              chapterId: chapter.id,
              value: ENTIRE_CHAPTER,
            })
          }
        >
          Whole chapter
        </Pill>
        {chapter.topics.map((topic) => (
          <Pill
            key={topic.id}
            type="checkbox"
            checked={chosen.topicIds.includes(topic.id)}
            disabled={disabled}
            onChange={() =>
              setup.select({
                type: "topic",
                chapterId: chapter.id,
                value: topic.id,
              })
            }
          >
            {topic.name}
          </Pill>
        ))}
        {chosen.customTopics.map((name) => (
          <Pill
            key={name}
            type="checkbox"
            checked
            disabled={disabled}
            onChange={() =>
              setup.select({
                type: "remove-custom-topic",
                chapterId: chapter.id,
                value: name,
              })
            }
          >
            {name}
          </Pill>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          aria-label="Add a topic of your own"
          aria-invalid={draftError ? true : undefined}
          aria-describedby={draftError ? errorId : undefined}
          placeholder="Add a topic of your own"
          className="h-11 min-w-0 px-3.5 md:text-base"
          value={draft}
          maxLength={120}
          disabled={disabled}
          onChange={(event) => {
            setDraft(event.target.value);
            setDraftError(null);
          }}
          onKeyDown={(event) => {
            // Enter adds the topic; it must not start the viva.
            if (event.key !== "Enter") return;
            event.preventDefault();
            addOwnTopic();
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="touch"
          onClick={addOwnTopic}
          disabled={disabled || !draft.trim()}
        >
          <PlusIcon aria-hidden="true" />
          Add
        </Button>
      </div>
      {draftError ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {draftError}
        </p>
      ) : null}
    </Question>
  );
}

function Question({
  legend,
  hint,
  children,
}: {
  legend: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="animate-rise flex min-w-0 flex-col gap-3">
      <legend className="mb-3 flex flex-col gap-1">
        <span className="font-heading text-lg">{legend}</span>
        {hint ? (
          <span className="text-sm text-muted-foreground">{hint}</span>
        ) : null}
      </legend>
      {children}
    </fieldset>
  );
}

/**
 * One choice the size of its own words. It is a real radio button or checkbox
 * underneath, so arrow keys, Space and screen readers work without any code.
 */
function Pill({
  children,
  className,
  ...input
}: {
  type: "radio" | "checkbox";
  name?: string;
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center rounded-lg border border-input bg-card px-4 py-2 text-base transition-colors hover:border-foreground/40 has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50 has-disabled:cursor-default has-disabled:opacity-60 active:scale-[0.98]",
        className,
      )}
    >
      <input className="sr-only" {...input} />
      {children}
    </label>
  );
}

/**
 * The shape of the choices while the subject list downloads. The line beside
 * the Start button already says what is happening, so this stays silent.
 */
function ChoicesOutline() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <div className="h-6 w-24 animate-pulse rounded bg-muted" />
      <div className="flex flex-wrap gap-2">
        {[28, 20, 24, 16, 32].map((width, index) => (
          <div
            key={index}
            className="h-11 animate-pulse rounded-lg bg-muted"
            style={{ width: `${width * 4}px` }}
          />
        ))}
      </div>
    </div>
  );
}
