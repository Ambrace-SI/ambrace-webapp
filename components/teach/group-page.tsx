"use client";

import {
  ArrowLeftIcon,
  CopyIcon,
  MessageCircleIcon,
  PencilIcon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { PageNotice } from "@/components/app/page-notice";
import { RenameGroupDialog } from "@/components/teach/group-name-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { track } from "@/lib/analytics/events";
import { PRIVATE_CLASS } from "@/lib/analytics/privacy";
import { httpStatus } from "@/lib/api/errors";
import { GROUP_ID_PARAM, TEACH_PATH, joinPath } from "@/lib/auth/routes";
import {
  useDeleteGroup,
  useGroup,
  useRemoveMember,
  useReplaceJoinCode,
} from "@/lib/groups/use-groups";
import {
  educatorTypeOf,
  groupDetails,
  membersNoun,
} from "@/lib/groups/wording";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useMe } from "@/lib/hooks/use-me";
import { cn } from "@/lib/utils";
import type { GroupDetail, GroupMember } from "@/types/groups";
import type { EducatorType } from "@/types/profile";

const JOINED = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
});

/**
 * One group: how to invite people into it, and who is in it.
 *
 * The invite comes first while the group is small, because getting students
 * in is the only thing that moves it forward. Assigned vivas and the class
 * summary join this page in the next phases.
 */
export function GroupPage() {
  const groupId = useSearchParams().get(GROUP_ID_PARAM);
  const { data: me } = useMe();
  const { data: group, error, refetch, isRefetching } = useGroup(groupId);
  const kind = educatorTypeOf(me?.profile);

  if (!groupId || (error && [403, 404, 422].includes(httpStatus(error) ?? 0))) {
    return (
      <PageNotice
        label="Group"
        title="We can't find that group"
        body="It may have been removed, or it belongs to a different account."
      >
        <Button asChild size="touch">
          <Link href={TEACH_PATH}>Your groups</Link>
        </Button>
      </PageNotice>
    );
  }
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
  if (!group) return <GroupOutline />;

  return (
    <main className="animate-rise mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-10 sm:px-10 sm:py-14">
      <GroupHeader group={group} kind={kind} />
      <InvitePanel group={group} kind={kind} />
      <Roster group={group} kind={kind} />
      <DeleteGroup group={group} kind={kind} />
    </main>
  );
}

function GroupHeader({
  group,
  kind,
}: {
  group: GroupDetail;
  kind: EducatorType;
}) {
  const [renaming, setRenaming] = useState(false);
  return (
    <header className="flex flex-col gap-4">
      <Button
        asChild
        variant="ghost"
        className="-ml-3 self-start text-muted-foreground"
      >
        <Link href={TEACH_PATH}>
          <ArrowLeftIcon aria-hidden="true" />
          Your groups
        </Link>
      </Button>
      <p className="label-mono text-muted-foreground">
        {groupDetails(kind, group)}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-3xl font-light tracking-tight sm:text-4xl">
          {group.name}
        </h1>
        <Button
          variant="ghost"
          size="icon-touch"
          aria-label="Rename group"
          onClick={() => setRenaming(true)}
        >
          <PencilIcon aria-hidden="true" />
        </Button>
      </div>
      <RenameGroupDialog
        groupId={group.group_id}
        currentName={group.name}
        open={renaming}
        onOpenChange={setRenaming}
      />
    </header>
  );
}

/**
 * The code is shown large because it is read aloud in class and copied off a
 * board; the link is what gets pasted into a WhatsApp group. Both lead to the
 * same place, and joining from either is the student's own choice.
 */
function InvitePanel({
  group,
  kind,
}: {
  group: GroupDetail;
  kind: EducatorType;
}) {
  const hydrated = useHydrated();
  const replace = useReplaceJoinCode(group.group_id);
  const [confirmingNewCode, setConfirmingNewCode] = useState(false);

  const link = hydrated
    ? `${window.location.origin}${joinPath(group.join_code)}`
    : "";
  const message = `Join "${group.name}" on Ambrace: ${link}`;

  async function copy(
    text: string,
    what: string,
    via: "copy_link" | "copy_code",
  ) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
      track("group_invite_shared", { via });
    } catch {
      toast.error(
        `Couldn't copy the ${what.toLowerCase()}. Select it and copy it instead.`,
      );
    }
  }

  async function newCode() {
    try {
      await replace.mutateAsync();
      track("group_code_replaced");
      toast.success("New code ready. The old link no longer works.");
    } catch {
      toast.error("Couldn't change the code. Try again.");
    } finally {
      setConfirmingNewCode(false);
    }
  }

  return (
    <section
      aria-labelledby="invite-heading"
      className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="invite-heading" className="label-mono text-muted-foreground">
          Invite {membersNoun(kind)}
        </h2>
        <p className="text-sm text-muted-foreground">
          They open the link or enter the code after signing in. Joining lets
          you see the reports of vivas you set them.
        </p>
      </div>

      <p
        className="font-mono text-4xl font-medium tracking-[0.2em] sm:text-5xl"
        aria-label={`Join code ${group.join_code.split("").join(" ")}`}
      >
        {group.join_code}
      </p>
      {link ? (
        <p className="truncate text-sm text-muted-foreground">{link}</p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          variant="ember"
          size="touch"
          disabled={!link}
          onClick={() => void copy(link, "Link", "copy_link")}
        >
          <CopyIcon aria-hidden="true" />
          Copy link
        </Button>
        <Button asChild variant="outline" size="touch">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("group_invite_shared", { via: "whatsapp" })}
          >
            <MessageCircleIcon aria-hidden="true" />
            Share on WhatsApp
          </a>
        </Button>
        <Button
          variant="ghost"
          size="touch"
          onClick={() => void copy(group.join_code, "Code", "copy_code")}
        >
          Copy code
        </Button>
      </div>

      <div className="border-t border-border pt-4">
        {confirmingNewCode ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="text-sm">
              The current link and code will stop working. Students already in
              the group stay in it.
            </p>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="destructive"
                size="sm"
                disabled={replace.isPending}
                onClick={() => void newCode()}
              >
                Get new code
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingNewCode(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="link"
            className="h-auto p-0 text-muted-foreground"
            onClick={() => setConfirmingNewCode(true)}
          >
            <RefreshCwIcon aria-hidden="true" />
            Link shared too widely? Get a new code
          </Button>
        )}
      </div>
    </section>
  );
}

function Roster({ group, kind }: { group: GroupDetail; kind: EducatorType }) {
  return (
    <section aria-labelledby="roster-heading" className="flex flex-col gap-4">
      <h2 id="roster-heading" className="label-mono text-muted-foreground">
        {kind === "parent" ? "Children" : "Students"} · {group.member_count}
      </h2>
      {group.members.length === 0 ? (
        <p className="text-muted-foreground">
          No one has joined yet. Share the link above and they&apos;ll appear
          here as they join.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {group.members.map((member) => (
            <MemberRow
              key={member.student_id}
              groupId={group.group_id}
              member={member}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function MemberRow({
  groupId,
  member,
}: {
  groupId: string;
  member: GroupMember;
}) {
  const remove = useRemoveMember(groupId);
  const [confirming, setConfirming] = useState(false);
  const firstName = member.name.trim().split(/\s+/)[0];

  async function confirmRemove() {
    try {
      await remove.mutateAsync(member.student_id);
      track("group_member_removed");
    } catch {
      toast.error("Couldn't remove them. Try again.");
      setConfirming(false);
    }
  }

  return (
    <li className="flex min-h-14 flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className={cn("flex flex-col", PRIVATE_CLASS)}>
        <span className="font-medium">{member.name}</span>
        <span className="text-sm text-muted-foreground">
          {[
            member.class_level === null ? null : `Class ${member.class_level}`,
            `Joined ${JOINED.format(new Date(member.joined_at))}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            They can rejoin with the link.
          </span>
          <Button
            variant="destructive"
            size="sm"
            disabled={remove.isPending}
            onClick={() => void confirmRemove()}
          >
            Remove
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(false)}
          >
            Keep
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="icon-touch"
          aria-label={`Remove ${firstName}`}
          onClick={() => setConfirming(true)}
        >
          <XIcon aria-hidden="true" />
        </Button>
      )}
    </li>
  );
}

function GroupOutline() {
  return (
    <main
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-10 sm:px-10 sm:py-14"
      role="status"
      aria-label="Loading the group"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-64" />
      </div>
      <Skeleton className="h-56 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
    </main>
  );
}

/**
 * Deleting is kept at the foot of the page and asks first, saying what is
 * lost, because it cannot be undone and it affects every student in it.
 */
function DeleteGroup({
  group,
  kind,
}: {
  group: GroupDetail;
  kind: EducatorType;
}) {
  const router = useRouter();
  const remove = useDeleteGroup(group.group_id);
  const [confirming, setConfirming] = useState(false);

  async function confirmDelete() {
    try {
      await remove.mutateAsync();
      track("group_deleted", { members: group.member_count });
      toast.success(`${group.name} deleted`);
      router.replace(TEACH_PATH);
    } catch {
      toast.error("Couldn't delete the group. Try again.");
      setConfirming(false);
    }
  }

  return (
    <section className="border-t border-border pt-6">
      {confirming ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            This removes {group.name} for everyone. Its {membersNoun(kind)}{" "}
            leave the group and its link stops working. This can&apos;t be
            undone.
          </p>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={remove.isPending}
              onClick={() => void confirmDelete()}
            >
              Delete group
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(false)}
            >
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="link"
          className="h-auto p-0 text-muted-foreground"
          onClick={() => setConfirming(true)}
        >
          Delete this group
        </Button>
      )}
    </section>
  );
}
