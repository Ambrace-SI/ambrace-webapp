"use client";

import { ChevronUpIcon, Loader2Icon, PlusIcon } from "lucide-react";
import {
  createContext,
  use,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ENTIRE_CHAPTER, validCustomTopic } from "@/lib/curriculum/selection";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import type { VivaSetup } from "@/lib/hooks/use-viva-setup";
import { cn } from "@/lib/utils";
import { AVAILABLE_VOICES } from "@/types/viva";

const MAX_OWN_TOPICS = 20;

type Panel = "subject" | "chapter" | "topics" | "voice";

/**
 * Everything a viva needs, along the bottom of home, the way a chat app keeps
 * its message box: subject, chapter, topics, voice, and Start.
 *
 * Each choice opens its list just above the bar on a laptop, and as a sheet
 * from the bottom on a phone, where the thumb already is. A choice only opens
 * once the one before it is made, and picking a subject leads straight on to
 * its chapters, so the student is walked through without being asked to read
 * a form. Start is the only warm thing on the screen, and only once there is
 * something to start.
 */
export function ChoiceBar({
  setup,
  starting,
}: {
  setup: VivaSetup;
  starting: boolean;
}) {
  const [open, setOpen] = useState<Panel | null>(null);
  const ready = setup.catalog === "ready" && setup.subjects.length > 0;
  const chosen = setup.chosen;
  const ownTopics =
    (chosen?.topicIds.length ?? 0) + (chosen?.customTopics.length ?? 0);

  const panel = (name: Panel) => ({
    open: open === name,
    onOpenChange: (next: boolean) => setOpen(next ? name : null),
    // Another list is taking over, so focus moves there, not back here.
    handingOver: open !== null && open !== name,
  });

  return (
    <div className="flex flex-col rounded-[20px] border border-border bg-surface p-2 md:flex-row md:items-center md:gap-1">
      <Choice
        label="Subject"
        value={
          setup.subject?.name ??
          (setup.catalog === "loading" ? "Loading" : "Choose")
        }
        placeholder={!setup.subject}
        disabled={!ready || starting}
        className="md:w-40"
        panelClassName="md:w-64"
        {...panel("subject")}
      >
        <OptionList legend="Subject">
          {setup.subjects.map((subject) => (
            <Option
              key={subject.id}
              type="radio"

              checked={setup.selection.subjectId === subject.id}
              onChange={() =>
                setup.select({ type: "subject", value: subject.id })
              }
              // Picking a subject leads straight on to its chapters.
              onPick={() => setOpen("chapter")}
            >
              {subject.name}
            </Option>
          ))}
        </OptionList>
      </Choice>

      <Divider />

      <Choice
        label="Chapter"
        value={setup.chapter?.name ?? "Choose a chapter"}
        placeholder={!setup.chapter}
        disabled={!setup.subject || starting}
        className="md:min-w-0 md:flex-1"
        panelClassName="md:w-[28rem]"
        {...panel("chapter")}
      >
        <ChapterList setup={setup} onPick={() => setOpen(null)} />
      </Choice>

      <Divider />

      <Choice
        label="Topics"
        value={
          ownTopics === 0
            ? "Whole chapter"
            : ownTopics === 1
              ? "1 topic"
              : `${ownTopics} topics`
        }
        disabled={!setup.chapter || starting}
        className="md:w-44"
        panelClassName="md:w-[26rem]"
        {...panel("topics")}
      >
        {/* Keyed by chapter so a half-typed topic never follows to another. */}
        <TopicList
          key={setup.chapter?.id}
          setup={setup}
          onDone={() => setOpen(null)}
        />
      </Choice>

      <Divider />

      <Choice
        label="Voice"
        value={setup.voiceName}
        disabled={starting}
        className="md:w-32"
        panelClassName="md:w-60"
        {...panel("voice")}
      >
        <p className="px-3 pt-2 pb-1 text-sm text-muted-foreground">
          Pick the voice that&apos;s easiest for you to follow.
        </p>
        <OptionList legend="Examiner's voice">
          {AVAILABLE_VOICES.map((voice) => (
            <Option
              key={voice.value}
              type="radio"

              checked={setup.voiceName === voice.value}
              onChange={() => setup.setVoiceName(voice.value)}
              onPick={() => setOpen(null)}
            >
              {voice.value}
            </Option>
          ))}
        </OptionList>
      </Choice>

      <Button
        type="submit"
        variant="ember"
        size="touch"
        className={cn(
          "mt-2 h-13 rounded-[14px] md:mt-0 md:ml-1",
          // Nothing to start yet: a quiet button, so Ember stays rare.
          !setup.resolved &&
            "disabled:bg-surface-active disabled:text-muted-foreground disabled:opacity-100",
        )}
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
  );
}

/** A hairline between choices on a laptop, between rows on a phone. */
function Divider() {
  return (
    <span
      aria-hidden="true"
      className="mx-3 h-px shrink-0 bg-border md:mx-0 md:h-7 md:w-px"
    />
  );
}

/**
 * One choice in the bar: its name, what is chosen, and the list behind it.
 * The list is a popover on a laptop and a bottom sheet on a phone; the
 * button that opens it is the same either way.
 */
function Choice({
  label,
  value,
  placeholder = false,
  disabled,
  open,
  onOpenChange,
  handingOver,
  className,
  panelClassName,
  children,
}: {
  label: string;
  value: string;
  placeholder?: boolean;
  disabled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  handingOver: boolean;
  className?: string;
  panelClassName?: string;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();

  // Closing normally returns focus to this choice's button. When the next
  // list is opening instead, that would pull focus out of it and close it.
  const onCloseAutoFocus = (event: Event) => {
    if (handingOver) event.preventDefault();
  };

  const trigger = (
    <button
      type="button"
      disabled={disabled}
      aria-expanded={open}
      onClick={isMobile ? () => onOpenChange(true) : undefined}
      className={cn(
        "flex h-13 min-w-0 items-center gap-3 rounded-[14px] px-3 text-left transition-colors outline-none hover:bg-surface-active focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent aria-expanded:bg-surface-active md:gap-2",
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-3 md:flex-col md:items-start md:gap-0">
        <span className="label-mono w-20 shrink-0 text-muted-foreground md:w-auto">
          {label}
        </span>
        <span
          className={cn(
            "min-w-0 truncate md:max-w-full",
            placeholder && "text-muted-foreground",
          )}
        >
          {value}
        </span>
      </span>
      <ChevronUpIcon
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </button>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            side="bottom"
            aria-describedby={undefined}
            onCloseAutoFocus={onCloseAutoFocus}
            className="gap-3 bg-surface px-3 pt-3 pb-6 text-base shadow-none"
          >
            <span
              aria-hidden="true"
              className="mx-auto h-1 w-10 shrink-0 rounded-full bg-border"
            />
            <SheetTitle className="px-3 font-heading text-[28px] leading-tight font-normal">
              {label}
            </SheetTitle>
            <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
              {children}
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={10}
        onCloseAutoFocus={onCloseAutoFocus}
        className={cn(
          "max-h-[min(30rem,var(--radix-popover-content-available-height))] gap-0 overflow-hidden rounded-2xl border border-border bg-surface p-0 text-base text-foreground shadow-none ring-0",
          panelClassName,
        )}
      >
        {/* The panel clips to its rounded corners; this inner area scrolls,
            so the scrollbar sits inside the curve instead of poking out. */}
        <div className="flex min-h-0 flex-col gap-1.5 overflow-y-auto overscroll-contain p-1.5">
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}

type ListContext = {
  /** Shared by every radio in the list, so they form one group. */
  name: string;
  /** Whether the last thing the student did in the list was an arrow key. */
  browsing: () => boolean;
};

const OptionListContext = createContext<ListContext | null>(null);

/**
 * A real group of radio buttons or checkboxes, so keys and readers work.
 *
 * It remembers whether the student is moving through it with the arrow keys,
 * because the browser reports those moves as clicks too, and a click is
 * otherwise how a row is settled on.
 */
function OptionList({
  legend,
  children,
}: {
  legend: string;
  children: ReactNode;
}) {
  const name = useId();
  const lastKey = useRef<string | null>(null);
  const [list] = useState<ListContext>(() => ({
    name,
    browsing: () => lastKey.current?.startsWith("Arrow") ?? false,
  }));

  return (
    <fieldset
      className="flex min-w-0 flex-col gap-0.5"
      onKeyDownCapture={(event) => {
        lastKey.current = event.key;
      }}
      onPointerDownCapture={() => {
        lastKey.current = null;
      }}
    >
      <legend className="sr-only">{legend}</legend>
      <OptionListContext value={list}>{children}</OptionListContext>
    </fieldset>
  );
}

/**
 * One row in a list. A radio row fills in Ink when chosen; a checkbox row
 * shows its box, since several can be ticked at once.
 *
 * `onPick` runs when the student settles on a row: a click or tap, Space or
 * Enter. Arrow keys only move the choice, so the list stays open while
 * someone browses it from the keyboard.
 */
function Option({
  type,
  checked,
  onChange,
  onPick,
  children,
}: {
  type: "radio" | "checkbox";
  checked: boolean;
  onChange: () => void;
  onPick?: () => void;
  children: ReactNode;
}) {
  const list = use(OptionListContext);

  function settled() {
    if (!list?.browsing()) onPick?.();
  }

  // Enter does not click a radio button on its own; here it settles too.
  function settledByEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (!checked) onChange();
    onPick?.();
  }

  return (
    <label
      className={cn(
        "flex min-h-11 shrink-0 cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2 transition-colors hover:bg-surface-active has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        type === "radio" &&
          "has-checked:bg-primary has-checked:text-primary-foreground",
      )}
    >
      <input
        type={type}
        name={type === "radio" ? list?.name : undefined}
        checked={checked}
        onChange={onChange}
        onClick={settled}
        onKeyDown={settledByEnter}
        className={cn(
          type === "radio"
            ? "sr-only"
            : "size-[18px] shrink-0 accent-foreground",
        )}
      />
      {children}
    </label>
  );
}

/** The chapters of the chosen subject, with a box to find one by name. */
function ChapterList({
  setup,
  onPick,
}: {
  setup: VivaSetup;
  onPick: () => void;
}) {
  const [query, setQuery] = useState("");
  const wanted = query.trim().toLowerCase();
  const chapters = setup.chapters
    .map((chapter, index) => ({ chapter, number: index + 1 }))
    .filter(({ chapter }) => chapter.name.toLowerCase().includes(wanted));

  return (
    <>
      <Input
        aria-label="Find a chapter"
        placeholder="Find a chapter"
        // Pinned while the chapters scroll under it, so it is always at hand.
        className="sticky top-0 z-10 h-11 shrink-0 bg-background px-3 md:text-base"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <OptionList legend="Chapter">
        {chapters.map(({ chapter, number }) => (
          <Option
            key={chapter.id}
            type="radio"
            checked={setup.chosen?.chapterId === chapter.id}
            onChange={() =>
              setup.select({ type: "chapter", value: chapter.id })
            }
            onPick={onPick}
          >
            <span
              className="label-mono w-5 shrink-0 opacity-60"
              aria-hidden="true"
            >
              {number}
            </span>
            <span>{chapter.name}</span>
          </Option>
        ))}
      </OptionList>
      {chapters.length === 0 ? (
        <p className="px-3 py-2 text-muted-foreground">
          No chapter matches that.
        </p>
      ) : null}
    </>
  );
}

/**
 * How much of the chapter to cover. "Whole chapter" is the answer unless the
 * student narrows it, so leaving this alone is a valid choice.
 */
function TopicList({
  setup,
  onDone,
}: {
  setup: VivaSetup;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const errorId = useId();
  const chapter = setup.chapter;
  const chosen = setup.chosen;
  if (!chapter || !chosen) return null;

  const whole = !chosen.topicIds.length && !chosen.customTopics.length;

  function addOwnTopic() {
    const name = draft.trim();
    if (!name || !chapter || !chosen) return;
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

  const toggle = (value: string) =>
    setup.select({ type: "topic", chapterId: chapter.id, value });

  return (
    <>
      <p className="px-3 pt-2 pb-1 text-sm text-muted-foreground">
        Stay on the whole chapter, or tick the parts you want to be asked about.
      </p>
      <OptionList legend="Topics">
        <Option
          type="checkbox"
          checked={whole}
          onChange={() => toggle(ENTIRE_CHAPTER)}
        >
          Whole chapter
        </Option>
        {chapter.topics.map((topic) => (
          <Option
            key={topic.id}
            type="checkbox"
            checked={chosen.topicIds.includes(topic.id)}
            onChange={() => toggle(topic.id)}
          >
            {topic.name}
          </Option>
        ))}
        {chosen.customTopics.map((name) => (
          <Option
            key={name}
            type="checkbox"
            checked
            onChange={() =>
              setup.select({
                type: "remove-custom-topic",
                chapterId: chapter.id,
                value: name,
              })
            }
          >
            {name}
          </Option>
        ))}

        <div className="mt-1.5 flex flex-col gap-1.5 border-t border-border pt-2">
          <div className="flex gap-1.5">
            <Input
              aria-label="Add a topic of your own"
              aria-invalid={draftError ? true : undefined}
              aria-describedby={draftError ? errorId : undefined}
              placeholder="Add a topic of your own"
              className="h-11 min-w-0 bg-background px-3 md:text-base"
              value={draft}
              maxLength={120}
              onChange={(event) => {
                setDraft(event.target.value);
                setDraftError(null);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                addOwnTopic();
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="touch"
              className="px-3.5"
              onClick={addOwnTopic}
              disabled={!draft.trim()}
            >
              <PlusIcon aria-hidden="true" />
              Add
            </Button>
            <Button
              type="button"
              size="touch"
              className="px-4"
              onClick={onDone}
            >
              Done
            </Button>
          </div>
          {draftError ? (
            <p
              id={errorId}
              role="alert"
              className="px-1 text-sm text-destructive"
            >
              {draftError}
            </p>
          ) : null}
        </div>
      </OptionList>
    </>
  );
}
