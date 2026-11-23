"use client";

import { XIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  analyticsOn,
  track,
  type FeedbackRating,
  type FeedbackSubject,
} from "@/lib/analytics/events";

/** The two things asked about, in the order they are asked. */
const QUESTIONS: Record<FeedbackSubject, string> = {
  session: "How was the session?",
  report: "How is the report?",
};

const RATINGS: readonly { rating: FeedbackRating; label: string }[] = [
  { rating: "bad", label: "Bad" },
  { rating: "fine", label: "Fine" },
  { rating: "good", label: "Good" },
];

type Step = FeedbackSubject | "thanks" | "closed";

/**
 * Two questions at the end of a report: how the viva went, then how useful
 * what the examiner wrote about it was. One tap each.
 *
 * It is a quiet row, not a dialog: the report is what the student came for,
 * and this must never stand between them and it. The answers are plain words
 * rather than stars or faces, so nothing has to be decoded, and the three sit
 * in the same place for both questions.
 *
 * Answers go to analytics only, so the row is not shown when analytics is off
 * (the answer would go nowhere). Nothing remembers that it was answered: once
 * answered or closed it is gone for this visit to the report, and opening the
 * report again asks again. Kept that simple on purpose; an answer given twice
 * is told apart in analytics by its time.
 */
export function VivaFeedbackPrompt({
  vivaSessionId,
  score,
}: {
  vivaSessionId: string;
  /** Sent with each answer, so a rating can be read beside how the viva went. */
  score: number;
}) {
  const [step, setStep] = useState<Step>(() =>
    analyticsOn() ? "session" : "closed",
  );
  const questionId = useId();
  const thanks = useRef<HTMLParagraphElement>(null);

  // The button that was pressed is gone once the thanks replace it. Focus
  // goes to the thanks, so a keyboard or screen reader is not left nowhere.
  useEffect(() => {
    if (step === "thanks") thanks.current?.focus();
  }, [step]);

  if (step === "closed") return null;

  if (step === "thanks") {
    return (
      <Row>
        <p
          ref={thanks}
          tabIndex={-1}
          role="status"
          className="py-2.5 font-medium outline-none"
        >
          Thank you. That helps us make Ambrace better.
        </p>
      </Row>
    );
  }

  const about = step;

  function answer(rating: FeedbackRating) {
    track("viva_feedback_given", {
      viva_session_id: vivaSessionId,
      about,
      rating,
      score,
    });
    setStep(about === "session" ? "report" : "thanks");
  }

  function dismiss() {
    track("viva_feedback_dismissed", {
      viva_session_id: vivaSessionId,
      at: about,
    });
    setStep("closed");
  }

  return (
    <Row labelledBy={questionId}>
      {/* Announced when it changes, so the second question is heard too. */}
      <p id={questionId} aria-live="polite" className="font-medium">
        {QUESTIONS[about]}
      </p>
      <div className="-mx-2 flex items-center gap-1 sm:mx-0">
        {RATINGS.map(({ rating, label }) => (
          <Button
            key={rating}
            type="button"
            variant="ghost"
            size="touch"
            className="px-3 text-muted-foreground hover:text-foreground sm:px-4"
            onClick={() => answer(rating)}
          >
            {label}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          className="ml-auto text-muted-foreground hover:text-foreground sm:ml-1"
          aria-label="Close these questions"
          onClick={dismiss}
        >
          <XIcon aria-hidden="true" />
        </Button>
      </div>
    </Row>
  );
}

/** The frame both the questions and the thanks sit in, so nothing jumps. */
function Row({
  labelledBy,
  children,
}: {
  labelledBy?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : "Feedback"}
      className="animate-rise flex flex-col gap-2 rounded-2xl border border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
    >
      {children}
    </section>
  );
}
