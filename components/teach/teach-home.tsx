"use client";

import { ArrowRightIcon, PlusIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { teachGroupPath } from "@/lib/auth/routes";
import { newGroupDialog } from "@/lib/groups/new-group-dialog";
import { useOwnedGroups } from "@/lib/groups/use-groups";
import {
  educatorTypeOf,
  groupDetails,
  membersNoun,
} from "@/lib/groups/wording";
import { useMe } from "@/lib/hooks/use-me";
import type { GroupSummary } from "@/types/groups";
import { EDUCATOR_LABELS, type EducatorType } from "@/types/profile";

/**
 * Where a teacher or parent starts: their groups. With none yet, the page
 * explains the whole idea in three steps, because the first visit is the one
 * that decides whether they come back.
 */
export function TeachHome() {
  const { data: me } = useMe();
  const { data: groups, error, refetch, isRefetching } = useOwnedGroups();
  const kind = educatorTypeOf(me?.profile);

  return (
    <main className="animate-rise mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-10 sm:px-10 sm:py-14">
      {error ? (
        <div className="flex flex-col items-start gap-4">
          <h1 className="text-3xl font-light tracking-tight">
            We can&apos;t load your groups
          </h1>
          <p className="text-muted-foreground">
            Check your connection and try again.
          </p>
          <Button
            size="touch"
            onClick={() => void refetch()}
            disabled={isRefetching}
          >
            Try again
          </Button>
        </div>
      ) : !groups ? (
        <GroupsOutline />
      ) : groups.length === 0 ? (
        <FirstVisit kind={kind} />
      ) : (
        <>
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <p className="label-mono text-muted-foreground">
                {EDUCATOR_LABELS[kind]}
              </p>
              <h1 className="text-3xl font-light tracking-tight sm:text-4xl">
                Your groups
              </h1>
            </div>
            <Button
              variant="ember"
              size="touch"
              onClick={() => newGroupDialog.open()}
            >
              <PlusIcon aria-hidden="true" />
              New group
            </Button>
          </header>
          <ul className="grid gap-3 sm:grid-cols-2">
            {groups.map((group) => (
              <li key={group.group_id}>
                <GroupCard group={group} kind={kind} />
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

function GroupCard({
  group,
  kind,
}: {
  group: GroupSummary;
  kind: EducatorType;
}) {
  return (
    <Link
      href={teachGroupPath(group.group_id)}
      className="glass-card glass-card-link group flex h-full flex-col gap-6 rounded-2xl p-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg leading-snug font-medium">{group.name}</h2>
        <ArrowRightIcon
          className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
      <p className="mt-auto text-sm text-muted-foreground">
        {groupDetails(kind, group)}
      </p>
    </Link>
  );
}

const STEPS = (kind: EducatorType) => [
  {
    title: "Create a group",
    body:
      kind === "parent"
        ? "One group for your children."
        : "One for each class or batch you teach.",
  },
  {
    title: "Share the link",
    body: `Your ${membersNoun(kind)} join with one tap. You never type their details.`,
  },
  {
    title: "Set vivas, read reports",
    body: "Pick a chapter. Each report comes back to you when they finish.",
  },
];

function FirstVisit({ kind }: { kind: EducatorType }) {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <p className="label-mono text-muted-foreground">
          {EDUCATOR_LABELS[kind]}
        </p>
        <h1 className="text-3xl font-light tracking-tight sm:text-4xl">
          Set up your first group
        </h1>
        <p className="max-w-md text-muted-foreground">
          Ambrace runs short spoken vivas with your {membersNoun(kind)} and
          tells you how each one went.
        </p>
      </div>
      <ol className="flex flex-col gap-6">
        {STEPS(kind).map((step, index) => (
          <li key={step.title} className="flex gap-4">
            <span className="label-mono flex size-8 shrink-0 items-center justify-center rounded-full border border-border">
              {index + 1}
            </span>
            <span className="flex flex-col gap-1 pt-1">
              <span className="font-medium">{step.title}</span>
              <span className="text-muted-foreground">{step.body}</span>
            </span>
          </li>
        ))}
      </ol>
      <Button
        variant="ember"
        size="touch"
        className="self-start"
        onClick={() => newGroupDialog.open()}
      >
        <PlusIcon aria-hidden="true" />
        Create your first group
      </Button>
    </div>
  );
}

function GroupsOutline() {
  return (
    <div
      className="flex flex-col gap-10"
      role="status"
      aria-label="Loading your groups"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-56" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    </div>
  );
}
