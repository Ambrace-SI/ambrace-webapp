"use client";

import { fetchUserAttributes } from "aws-amplify/auth";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  HeartHandshakeIcon,
  PresentationIcon,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { Logo } from "@/components/brand/logo";
import { Orbit } from "@/components/brand/orbit";
import { ChoiceChips } from "@/components/forms/choice-chips";
import {
  FormMessage,
  SubmitButton,
  TextAreaField,
  TextField,
} from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/events";
import { PRIVATE_CLASS } from "@/lib/analytics/privacy";
import { isSignedOutError } from "@/lib/api/errors";
import { configureAuth } from "@/lib/auth/client";
import { HOME_PATH, TEACH_PATH, safeReturnPath } from "@/lib/auth/routes";
import { useMe, useSaveProfile } from "@/lib/hooks/use-me";
import {
  EMPTY_DRAFT,
  SCHOOL_ADDRESS_MAX_LENGTH,
  SCHOOL_NAME_MAX_LENGTH,
  NAME_MAX_LENGTH,
  hasErrors,
  suggestedName,
  toProfileUpdate,
  validateOptional,
  validateRequired,
  type ProfileDraft,
  type ProfileErrors,
} from "@/lib/onboarding/profile-form";
import {
  BOARDS,
  BOARD_LABELS,
  CLASS_LEVELS,
  isEducator,
  type AccountType,
} from "@/types/profile";

type Step = "who" | "basics" | "extras";

type Who = {
  accountType: AccountType;
  title: string;
  description: string;
  icon: LucideIcon;
};

/**
 * Teachers and parents get the same tools; the choice only changes how the
 * app speaks to them. It decides which side of the app they see, so it is
 * asked first.
 */
const WHO: Who[] = [
  {
    accountType: "student",
    title: "I'm a student",
    description: "Practise vivas and see how you're doing.",
    icon: BookOpenIcon,
  },
  {
    accountType: "teacher",
    title: "I'm a teacher",
    description: "Set vivas for your class and read their reports.",
    icon: PresentationIcon,
  },
  {
    accountType: "parent",
    title: "I'm a parent",
    description: "Set vivas for your child and follow their progress.",
    icon: HeartHandshakeIcon,
  },
];

/** Where a student goes once they are set up: back to the link they opened. */
function studentDestination(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return safeReturnPath(next);
}

const CLASS_OPTIONS = CLASS_LEVELS.map((level) => ({
  value: level,
  label: String(level),
}));
const BOARD_OPTIONS = BOARDS.map((board) => ({
  value: board,
  label: BOARD_LABELS[board],
}));

const SAVE_FAILED =
  "We couldn't save that. Check your connection and try again.";

/**
 * The first conversation with a new student.
 *
 * It asks for the two things a viva cannot start without, a name and a class,
 * and saves them the moment they are given. Everything else is on a second,
 * clearly optional step with a skip button as easy to reach as the finish
 * button, so nobody is held up by a question they would rather not answer.
 *
 * The screen is Paper (light): the student has arrived, and this is their
 * workspace. Ember appears here for the first time, on the one button that
 * moves them forward.
 */
export function OnboardingFlow() {
  const { data: me } = useMe();

  // The steps start only once we know who has arrived, because their first
  // decision (is onboarding already done?) is made exactly once.
  if (!me) {
    return (
      <div
        className="flex min-h-dvh flex-col items-center justify-center gap-5"
        role="status"
      >
        <Orbit className="w-16" />
        <p className="label-mono text-muted-foreground">Getting things ready</p>
      </div>
    );
  }
  return <OnboardingSteps arrivedOnboarded={me.onboarding_complete} />;
}

function OnboardingSteps({
  arrivedOnboarded: onboardedNow,
}: {
  arrivedOnboarded: boolean;
}) {
  const router = useRouter();
  const save = useSaveProfile();

  // Decided once, on arrival. Saving the first step completes onboarding, and
  // that must not throw the student out before the optional step.
  const [arrivedOnboarded] = useState(onboardedNow);
  // Step one can be saved again after going back. Onboarding completes once.
  const completionCounted = useRef(onboardedNow);

  const [step, setStep] = useState<Step>("who");
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [formError, setFormError] = useState<string>();
  const [nameTouched, setNameTouched] = useState(false);

  useEffect(() => {
    if (arrivedOnboarded) router.replace(HOME_PATH);
  }, [arrivedOnboarded, router]);

  // Offer the name from the sign-in account so a Google user need not retype
  // it. Never overwrites something the student has typed.
  useEffect(() => {
    if (arrivedOnboarded) return;
    let cancelled = false;
    configureAuth();
    fetchUserAttributes().then(
      (attributes) => {
        const name = suggestedName(attributes);
        if (cancelled || !name) return;
        setDraft((current) => (current.name ? current : { ...current, name }));
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [arrivedOnboarded]);

  function update(changes: Partial<ProfileDraft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  /** Saves the draft. Returns what was saved, or null if it could not be. */
  async function send(includeOptional: boolean) {
    setFormError(undefined);
    const update = toProfileUpdate(draft, { includeOptional });
    try {
      await save.mutateAsync(update);
      return update;
    } catch (error) {
      if (isSignedOutError(error)) {
        setFormError(
          "Your session has ended. Refresh the page to sign in again.",
        );
      } else {
        setFormError(SAVE_FAILED);
      }
      return null;
    }
  }

  async function submitBasics(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problems = validateRequired(draft);
    setErrors(problems);
    setNameTouched(true);
    if (hasErrors(problems)) return;
    const saved = await send(false);
    if (!saved) return;
    if (!completionCounted.current) {
      completionCounted.current = true;
      track("onboarding_completed", {
        account_type: saved.account_type,
        class_level: saved.class_level ?? null,
      });
    }
    // An educator's school and board belong to their groups, not to them.
    if (isEducator(saved.account_type)) router.replace(TEACH_PATH);
    else setStep("extras");
  }

  async function submitExtras(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problems = validateOptional(draft);
    setErrors(problems);
    if (hasErrors(problems)) return;
    const saved = await send(true);
    if (!saved) return;
    track("onboarding_extras_saved", {
      board: saved.board ?? null,
      has_school: Boolean(saved.school_name),
    });
    router.replace(studentDestination());
  }

  const educator = isEducator(draft.accountType);
  const stepNumber = step === "who" ? 1 : step === "basics" ? 2 : 3;

  if (arrivedOnboarded) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Orbit className="w-16" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-6 sm:px-10">
        <Logo surface="theme" priority />
        <p className="label-mono text-muted-foreground" aria-live="polite">
          Step {stepNumber} of {educator ? 2 : 3}
        </p>
      </header>

      <main className="flex flex-1 flex-col px-6 pb-16 sm:px-10 sm:pt-8">
        <div key={step} className="animate-rise mx-auto w-full max-w-lg">
          {step === "who" ? (
            <WhoStep
              chosen={draft}
              onChoose={(who) => {
                update({
                  accountType: who.accountType,
                  classLevel: null,
                });
                setErrors({});
                setStep("basics");
              }}
            />
          ) : step === "basics" ? (
            <form
              onSubmit={submitBasics}
              noValidate
              className="flex flex-col gap-8"
            >
              <div className="flex flex-col gap-3">
                <h1 className="text-4xl font-light tracking-tight">
                  Let&apos;s get you set up
                </h1>
                <p className="text-muted-foreground">
                  {educator
                    ? "Your students will see this name on the vivas you set."
                    : "Two quick things, so your examiner knows who they're talking to and what to ask."}
                </p>
              </div>

              {formError ? (
                <FormMessage tone="error">{formError}</FormMessage>
              ) : null}

              <TextField
                label="What should we call you?"
                name="name"
                autoComplete="name"
                autoCapitalize="words"
                maxLength={NAME_MAX_LENGTH}
                value={draft.name}
                onChange={(event) => update({ name: event.target.value })}
                onBlur={() => {
                  setNameTouched(true);
                  setErrors((current) => ({
                    ...current,
                    name: validateRequired(draft).name,
                  }));
                }}
                error={nameTouched ? errors.name : undefined}
                hint={
                  educator
                    ? "For example, Mrs Sharma or Riya's mother."
                    : "Your examiner will greet you by this name."
                }
              />

              {educator ? null : (
                <ChoiceChips
                  legend="Which class are you in?"
                  options={CLASS_OPTIONS}
                  value={draft.classLevel}
                  onChange={(classLevel) => {
                    update({ classLevel });
                    setErrors((current) => ({
                      ...current,
                      classLevel: undefined,
                    }));
                  }}
                  error={errors.classLevel}
                  columns="grid-cols-4"
                />
              )}

              <SubmitButton
                variant="ember"
                pending={save.isPending}
                pendingLabel="Saving…"
              >
                {educator ? "Finish" : "Continue"}
              </SubmitButton>

              <BackButton
                disabled={save.isPending}
                onClick={() => {
                  setFormError(undefined);
                  setStep("who");
                }}
              >
                Back
              </BackButton>
            </form>
          ) : (
            <form
              onSubmit={submitExtras}
              noValidate
              className="flex flex-col gap-8"
            >
              <div className="flex flex-col gap-3">
                <h1 className="text-4xl font-light tracking-tight">
                  A little more, if you like
                </h1>
                <p className="text-muted-foreground">
                  You&apos;re all set,{" "}
                  <span className={PRIVATE_CLASS}>
                    {draft.name.trim().split(/\s+/)[0]}
                  </span>
                  . These help us match questions to your syllabus. Skip them
                  now and add them whenever you want.
                </p>
              </div>

              {formError ? (
                <FormMessage tone="error">{formError}</FormMessage>
              ) : null}

              <ChoiceChips
                legend="Your board"
                options={BOARD_OPTIONS}
                value={draft.board}
                onChange={(board) => update({ board })}
                columns="grid-cols-2 sm:grid-cols-4"
                optional
              />

              <TextField
                label="School name"
                name="school-name"
                autoComplete="organization"
                maxLength={SCHOOL_NAME_MAX_LENGTH}
                value={draft.schoolName}
                onChange={(event) => update({ schoolName: event.target.value })}
                error={errors.schoolName}
                optional
              />

              <TextAreaField
                label="School address"
                name="school-address"
                autoComplete="street-address"
                maxLength={SCHOOL_ADDRESS_MAX_LENGTH}
                value={draft.schoolAddress}
                onChange={(event) =>
                  update({ schoolAddress: event.target.value })
                }
                error={errors.schoolAddress}
                optional
              />

              <div className="flex flex-col gap-3">
                <SubmitButton
                  variant="ember"
                  pending={save.isPending}
                  pendingLabel="Saving…"
                >
                  Finish
                </SubmitButton>
                <Button
                  type="button"
                  variant="ghost"
                  size="touch"
                  className="w-full"
                  disabled={save.isPending}
                  onClick={() => router.replace(studentDestination())}
                >
                  Skip for now
                </Button>
              </div>

              <BackButton
                disabled={save.isPending}
                onClick={() => {
                  setFormError(undefined);
                  setStep("basics");
                }}
              >
                Back to name and class
              </BackButton>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

function BackButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="link"
      className="h-auto self-start p-0 text-muted-foreground"
      disabled={disabled}
      onClick={onClick}
    >
      <ArrowLeftIcon className="size-4" aria-hidden="true" />
      {children}
    </Button>
  );
}

/**
 * The first question. Three large choices rather than a dropdown: each says
 * what the person will be able to do, which is what they are really choosing.
 * Choosing moves on at once; nothing is saved until the next step.
 */
function WhoStep({
  chosen,
  onChoose,
}: {
  chosen: { accountType: AccountType };
  onChoose: (who: Who) => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-light tracking-tight">
          Welcome to Ambrace
        </h1>
        <p className="text-muted-foreground">
          Who will be using this account? You can change it later in Settings.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {WHO.map((who) => {
          const Icon = who.icon;
          const selected = chosen.accountType === who.accountType;
          return (
            <li key={who.title}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onChoose(who)}
                className="glass-card glass-card-link flex min-h-16 w-full items-center gap-4 rounded-2xl px-4 py-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:border-foreground"
              >
                <Icon
                  className="size-6 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">{who.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {who.description}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
