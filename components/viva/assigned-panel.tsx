"use client";

import { ClipboardListIcon } from "lucide-react";
import Link from "next/link";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AssignedRow } from "@/components/viva/assigned-row";
import { STUDENT_GROUPS_PATH } from "@/lib/auth/routes";
import { usePendingAssigned } from "@/lib/groups/use-groups";
import type { StudentAssignment } from "@/types/assignments";

/**
 * Every set viva, from a button in home's top corner: the count on the
 * button, and the whole list in a small window floating under it, so none
 * needs scrolling to find. Its open state belongs to home, so home's list
 * can open it too ("see all").
 */
export function AssignedPanel({
  starting,
  onStart,
  open,
  onOpenChange,
}: {
  starting: boolean;
  onStart: (assignment: StudentAssignment) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pending = usePendingAssigned();
  const headingId = useId();

  if (pending.length === 0) return null;

  const count = pending.length;
  const waiting = `${count} ${count === 1 ? "viva" : "vivas"} waiting`;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="glass"
          size="touch"
          className="animate-rise gap-2 pr-2.5"
          aria-label={`Viva for you, ${waiting}`}
        >
          <ClipboardListIcon aria-hidden="true" />
          <span className="hidden sm:inline">Viva for you</span>
          <span
            aria-hidden="true"
            className="flex h-6 min-w-6 items-center justify-center rounded-full bg-ember px-1.5 text-xs font-semibold text-ember-foreground tabular-nums"
          >
            {count}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        collisionPadding={12}
        aria-labelledby={headingId}
        className="max-h-(--radix-popover-content-available-height) w-[min(24rem,calc(100vw-1.5rem))] gap-1 overflow-y-auto rounded-3xl p-2"
      >
        <div className="flex flex-col gap-0.5 px-3 pt-2 pb-1">
          <h2 id={headingId} className="font-medium">
            Viva for you
          </h2>
          <p className="text-muted-foreground">
            {waiting} from your teacher or parent.
          </p>
        </div>
        <ul className="flex flex-col gap-1">
          {pending.map((assignment) => (
            <AssignedRow
              key={assignment.assignment_id}
              assignment={assignment}
              look="plain"
              starting={starting}
              onStart={() => {
                onOpenChange(false);
                onStart(assignment);
              }}
            />
          ))}
        </ul>
        <div className="mx-3 mt-1 border-t border-border pt-2 pb-1">
          <Link
            href={STUDENT_GROUPS_PATH}
            className="inline-flex min-h-11 items-center text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            See them by group in Your groups
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
