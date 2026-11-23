"use client";

import { useEffect, useRef } from "react";

import { PRIVATE_CLASS } from "@/lib/analytics/privacy";
import type { Transcript } from "@/lib/store/viva-store";
import { cn } from "@/lib/utils";

/** How close to the bottom still counts as "following the conversation". */
const FOLLOW_WITHIN_PX = 32;

/**
 * What is being said, as it is said.
 *
 * These are captions for a spoken conversation, not a chat: no bubbles, just
 * the words and who said them. The newest line stays in view unless the
 * student scrolls up to re-read, in which case it is left alone until they
 * come back down.
 */
export function LiveCaptions({
  transcripts,
}: {
  transcripts: readonly Transcript[];
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const lines = transcripts.filter((entry) => entry.text.trim());

  useEffect(() => {
    if (transcripts.length === 0) following.current = true;
    const element = viewport.current;
    if (element && following.current) element.scrollTop = element.scrollHeight;
  }, [transcripts]);

  if (lines.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        What you and your examiner say will appear here.
      </p>
    );
  }

  return (
    <div
      ref={viewport}
      role="log"
      aria-label="Conversation"
      tabIndex={0}
      className={cn(
        "max-h-full min-h-0 overflow-y-auto overscroll-contain rounded-lg outline-none [overflow-anchor:none] focus-visible:ring-3 focus-visible:ring-ring/50",
        // What the student and the examiner said.
        PRIVATE_CLASS,
      )}
      onScroll={(event) => {
        const element = event.currentTarget;
        following.current =
          element.scrollHeight - element.scrollTop - element.clientHeight <
          FOLLOW_WITHIN_PX;
      }}
    >
      <ol className="flex flex-col gap-5">
        {lines.map((entry) => {
          const student = entry.role === "user";
          return (
            <li key={entry.id} className="flex flex-col gap-1">
              <span
                className={cn(
                  "label-mono",
                  student ? "text-ember-text" : "text-muted-foreground",
                )}
              >
                {student ? "You" : "Examiner"}
              </span>
              <p
                className={cn(
                  "text-lg leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]",
                  !student && "text-muted-foreground",
                )}
              >
                {entry.text}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
