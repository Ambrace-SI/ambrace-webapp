"use client";

import { ArrowRightIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { BackLink } from "@/components/app/back-link";
import { PageNotice } from "@/components/app/page-notice";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GROUP_ID_PARAM,
  JOIN_PATH,
  STUDENT_GROUPS_PATH,
  studentGroupPath,
  reportPath,
  startAssignedPath,
} from "@/lib/auth/routes";
import {
  useAssigned,
  useJoinedGroups,
  useLeaveGroup,
} from "@/lib/groups/use-groups";
import type { StudentAssignment } from "@/types/assignments";
import type { JoinedGroup } from "@/types/groups";
import { EDUCATOR_LABELS } from "@/types/profile";

const JOINED = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "Teacher · Meera Sharma · Class 9": who runs the group, and for which class. */
function describe(group: JoinedGroup): string {
  return [
    `${EDUCATOR_LABELS[group.owner_type]} · ${group.owner_name}`,
    group.class_level === null ? null : `Class ${group.class_level}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The groups a student has joined. Joining is how a teacher or parent gets
 * to set them vivas, so the way to join another sits right here too.
 */
export function StudentGroups() {
  const { data: groups, error, refetch, isRefetching } = useJoinedGroups();

  if (error) {
    return (
      <PageNotice
        label="Your groups"
        title="We can't load your groups"
        body="Check your connection and try again."
      >
        <Button
          size="touch"
          onClick={() => void refetch()}
          disabled={isRefetching}
        >
          Try again
        </Button>
      </PageNotice>
    );
  }

  return (
    <main className="animate-rise mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-10 sm:px-10 sm:py-14">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="label-mono text-muted-foreground">Groups</p>
          <h1 className="text-3xl font-light tracking-tight sm:text-4xl">
            Your groups
          </h1>
        </div>
        <Button asChild variant="ember" size="touch">
          <Link href={JOIN_PATH}>
            <PlusIcon aria-hidden="true" />
            Join a group
          </Link>
        </Button>
      </header>

      {!groups ? (
        <div
          className="grid gap-3 sm:grid-cols-2"
          role="status"
          aria-label="Loading your groups"
        >
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      ) : groups.length === 0 ? (
        <p className="max-w-md text-muted-foreground">
          You&apos;re not in any groups yet. Ask your teacher or parent for
          their group code or link, and the vivas they set will appear here.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {groups.map((group) => (
            <li key={group.group_id}>
              <Link
                href={studentGroupPath(group.group_id)}
                className="group flex h-full flex-col gap-6 rounded-xl border border-border bg-card p-5 transition-colors outline-none hover:border-foreground/30 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg leading-snug font-medium">
                    {group.name}
                  </h2>
                  <ArrowRightIcon
                    className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-auto text-sm text-muted-foreground">
                  {describe(group)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

/**
 * One group, as its student sees it: who runs it, the vivas set in it, and
 * the way out. The vivas list arrives with assigned vivas (AMBRACE-87); until
 * then it says plainly that nothing has been set.
 */
export function StudentGroup() {
  const router = useRouter();
  const groupId = useSearchParams().get(GROUP_ID_PARAM);
  const { data: groups, error, refetch, isRefetching } = useJoinedGroups();
  const leave = useLeaveGroup();
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  if (error) {
    return (
      <PageNotice
        label="Group"
        title="We can't load this group"
        body="Check your connection and try again."
      >
        <Button
          size="touch"
          onClick={() => void refetch()}
          disabled={isRefetching}
        >
          Try again
        </Button>
      </PageNotice>
    );
  }
  if (!groups) {
    return (
      <main
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10 sm:px-10 sm:py-14"
        role="status"
        aria-label="Loading the group"
      >
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-32 rounded-xl" />
      </main>
    );
  }

  const group = groups.find((g) => g.group_id === groupId);
  if (!group) {
    return (
      <PageNotice
        label="Group"
        title="You're not in this group"
        body="You may have left it, or it was removed by whoever ran it."
      >
        <Button asChild size="touch">
          <Link href={STUDENT_GROUPS_PATH}>Your groups</Link>
        </Button>
      </PageNotice>
    );
  }

  async function confirmLeave(left: JoinedGroup) {
    try {
      await leave.mutateAsync(left.group_id);
      toast.success(`You left ${left.name}`);
      router.replace(STUDENT_GROUPS_PATH);
    } catch {
      toast.error("Couldn't leave the group. Try again.");
      setConfirmingLeave(false);
    }
  }

  return (
    <main className="animate-rise mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-10 sm:px-10 sm:py-14">
      <header className="flex flex-col gap-4">
        <BackLink href={STUDENT_GROUPS_PATH}>Your groups</BackLink>
        <p className="label-mono text-muted-foreground">{describe(group)}</p>
        <h1 className="text-3xl font-light tracking-tight sm:text-4xl">
          {group.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Joined {JOINED.format(new Date(group.joined_at))}
        </p>
      </header>

      <GroupVivas group={group} />

      <section className="border-t border-border pt-6">
        {confirmingLeave ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="text-sm">
              {group.owner_name} will no longer be able to set you vivas here.
              You can rejoin with their code.
            </p>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="destructive"
                size="sm"
                disabled={leave.isPending}
                onClick={() => void confirmLeave(group)}
              >
                Leave group
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingLeave(false)}
              >
                Stay
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="link"
            className="h-auto p-0 text-muted-foreground"
            onClick={() => setConfirmingLeave(true)}
          >
            Leave this group
          </Button>
        )}
      </section>
    </main>
  );
}

const DUE = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

function dueText(dueOn: string | null): string | null {
  if (!dueOn) return null;
  const [year, month, day] = dueOn.split("-").map(Number);
  return `Due ${DUE.format(new Date(year, month - 1, day))}`;
}

/**
 * The vivas set in this group: to do first, then done with the score and a
 * way to the report. Starting happens on home, where the live room is.
 */
function GroupVivas({ group }: { group: JoinedGroup }) {
  const { data, error, refetch } = useAssigned();
  const vivas = (data ?? []).filter((a) => a.group_id === group.group_id);

  return (
    <section aria-labelledby="vivas-heading" className="flex flex-col gap-4">
      <h2 id="vivas-heading" className="label-mono text-muted-foreground">
        Vivas
      </h2>
      {error ? (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            We couldn&apos;t load the vivas.
          </span>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : !data ? (
        <Skeleton className="h-16 rounded-xl" />
      ) : vivas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6">
          <p className="font-medium">No vivas set yet</p>
          <p className="mt-1 text-muted-foreground">
            When {group.owner_name} sets a viva for this group, it appears here
            and on your home page. Your reports from it go to them as well.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {vivas.map((viva) => (
            <GroupVivaRow key={viva.assignment_id} viva={viva} />
          ))}
        </ul>
      )}
    </section>
  );
}

function GroupVivaRow({ viva }: { viva: StudentAssignment }) {
  const done = viva.status === "done";
  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{viva.title}</span>
        <span className="truncate text-sm text-muted-foreground">
          {[viva.subject_name, done ? "Done" : dueText(viva.due_on)]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
      {done && viva.session_id ? (
        <Button asChild variant="outline" size="touch" className="shrink-0">
          <Link href={reportPath(viva.session_id)}>
            <span className="font-mono">{viva.score}/10</span> Report
          </Link>
        </Button>
      ) : (
        <Button asChild size="touch" className="shrink-0">
          <Link
            href={startAssignedPath(viva.assignment_id)}
            aria-label={`Start ${viva.title}`}
          >
            Start
          </Link>
        </Button>
      )}
    </li>
  );
}
