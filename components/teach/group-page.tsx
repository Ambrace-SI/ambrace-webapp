"use client";

import {
  ClipboardListIcon,
  CopyIcon,
  EllipsisIcon,
  MessageCircleIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
  UserPlusIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type TouchEvent,
} from "react";
import { toast } from "sonner";

import { BackLink } from "@/components/app/back-link";
import { PageNotice } from "@/components/app/page-notice";
import { RenameGroupDialog } from "@/components/teach/group-name-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { track } from "@/lib/analytics/events";
import { PRIVATE_CLASS } from "@/lib/analytics/privacy";
import { httpStatus } from "@/lib/api/errors";
import {
  GROUP_ID_PARAM,
  TEACH_PATH,
  joinPath,
  teachAssignPath,
  teachVivaPath,
} from "@/lib/auth/routes";
import {
  useDeleteGroup,
  useGroup,
  useGroupAssignments,
  useRemoveMember,
  useReplaceJoinCode,
} from "@/lib/groups/use-groups";
import { isOverdue, localDay } from "@/lib/groups/viva-stage";
import { educatorTypeOf, membersNoun } from "@/lib/groups/wording";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useMe } from "@/lib/hooks/use-me";
import { cn } from "@/lib/utils";
import type { Assignment } from "@/types/assignments";
import type { GroupDetail, GroupMember } from "@/types/groups";
import type { EducatorType } from "@/types/profile";

const JOINED = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
});

const DUE = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** A due day (YYYY-MM-DD) read as a local calendar day, not a UTC moment. */
export function dueLabel(dueOn: string | null): string {
  if (!dueOn) return "No due date";
  const [year, month, day] = dueOn.split("-").map(Number);
  return `Due ${DUE.format(new Date(year, month - 1, day))}`;
}

type Panel = "invite" | "rename" | "delete" | null;
type Tab = "vivas" | "students";

/** Oldest first: the order things were set or joined in. */
function byOldest<T>(items: T[], at: (item: T) => string): T[] {
  return [...items].sort((a, b) => at(a).localeCompare(at(b)));
}

/**
 * One group, in two tabs: its vivas and its students. Setting a viva is the
 * one main action; renaming and deleting sit in the menu.
 */
export function GroupPage() {
  const groupId = useSearchParams().get(GROUP_ID_PARAM);
  const { data: me } = useMe();
  const { data: group, error, refetch, isRefetching } = useGroup(groupId);
  const kind = educatorTypeOf(me?.profile);
  const [panel, setPanel] = useState<Panel>(null);
  const [tab, setTab] = useState<Tab>("vivas");

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

  const close = (open: boolean) => {
    if (!open) setPanel(null);
  };
  const invite = () => setPanel("invite");

  return (
    <main className="animate-rise mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10 sm:px-10 sm:py-14">
      <header className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <BackLink href={TEACH_PATH}>Your groups</BackLink>
          <GroupMenu kind={kind} onOpen={setPanel} />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            {group.class_level === null ? null : (
              <p className="label-mono text-muted-foreground">
                Class {group.class_level}
              </p>
            )}
            <h1 className="truncate text-3xl font-light tracking-tight sm:text-4xl">
              {group.name}
            </h1>
          </div>
          <Button
            asChild
            variant={group.member_count > 0 ? "ember" : "outline"}
            size="touch"
          >
            <Link href={teachAssignPath(group.group_id)}>
              <PlusIcon aria-hidden="true" />
              Set a viva
            </Link>
          </Button>
        </div>
      </header>

      <GroupTabs
        group={group}
        kind={kind}
        tab={tab}
        onTab={setTab}
        onInvite={invite}
      />

      <InviteSheet
        group={group}
        kind={kind}
        open={panel === "invite"}
        onOpenChange={close}
      />
      <RenameGroupDialog
        groupId={group.group_id}
        currentName={group.name}
        open={panel === "rename"}
        onOpenChange={close}
      />
      <DeleteGroupDialog
        group={group}
        kind={kind}
        open={panel === "delete"}
        onOpenChange={close}
      />
    </main>
  );
}

function GroupMenu({
  kind,
  onOpen,
}: {
  kind: EducatorType;
  onOpen: (panel: Panel) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="glass" size="icon-touch" aria-label="Group options">
          <EllipsisIcon aria-hidden="true" strokeWidth={2.5} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onOpen("invite")}>
          <UserPlusIcon aria-hidden="true" />
          Invite {membersNoun(kind)}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onOpen("rename")}>
          <PencilIcon aria-hidden="true" />
          Rename group
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => onOpen("delete")}
        >
          <Trash2Icon aria-hidden="true" />
          Delete group
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ------------------------------------------------------------------- tabs

/** A sideways swipe at least this long, and mostly sideways, changes tab. */
const SWIPE_PX = 60;

/**
 * Vivas and Students as two big tabs, each with its count. On a phone a
 * sideways swipe on the list moves between them too; arrow keys do the same
 * from the keyboard.
 */
function GroupTabs({
  group,
  kind,
  tab,
  onTab,
  onInvite,
}: {
  group: GroupDetail;
  kind: EducatorType;
  tab: Tab;
  onTab: (tab: Tab) => void;
  onInvite: () => void;
}) {
  const { data: assignments } = useGroupAssignments(group.group_id);
  const start = useRef<{ x: number; y: number } | null>(null);
  const tabs: { id: Tab; label: string; icon: ReactNode; count?: number }[] = [
    {
      id: "vivas",
      label: "Vivas",
      icon: <ClipboardListIcon aria-hidden="true" />,
      count: assignments?.length,
    },
    {
      id: "students",
      label: kind === "parent" ? "Children" : "Students",
      icon: <UsersIcon aria-hidden="true" />,
      count: group.member_count,
    },
  ];

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next: Tab = tab === "vivas" ? "students" : "vivas";
    onTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  }

  function onTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const from = start.current;
    start.current = null;
    const touch = event.changedTouches[0];
    if (!from || !touch) return;
    const dx = touch.clientX - from.x;
    const dy = touch.clientY - from.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    onTab(dx < 0 ? "students" : "vivas");
  }

  return (
    <section className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Group"
        onKeyDown={onKeyDown}
        className="grid grid-cols-2 gap-1 rounded-full border border-foreground/10 bg-muted/70 p-1 sm:max-w-sm"
      >
        {tabs.map(({ id, label, icon, count }) => {
          const selected = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={selected}
              aria-controls={`panel-${id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onTab(id)}
              className={cn(
                "flex h-11 items-center justify-center gap-2 rounded-full px-4 text-base transition-[background-color,color,box-shadow] duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4.5",
                selected
                  ? "glass-card font-semibold text-foreground"
                  : "border border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {icon}
              {label}
              {count === undefined ? null : (
                <span
                  className={cn(
                    "min-w-6 rounded-full px-1.5 font-mono text-xs leading-5",
                    selected
                      ? "bg-foreground text-background"
                      : "bg-foreground/10",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        key={tab}
        id={`panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          start.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
        }}
        onTouchEnd={onTouchEnd}
        className={cn(
          "animate-in duration-300 fade-in-0 motion-reduce:animate-none",
          tab === "vivas" ? "slide-in-from-left-3" : "slide-in-from-right-3",
        )}
      >
        {tab === "vivas" ? (
          <VivaList group={group} kind={kind} onInvite={onInvite} />
        ) : (
          <StudentList group={group} kind={kind} onInvite={onInvite} />
        )}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ vivas

/** Every viva set in the group, the first one set at the top. */
function VivaList({
  group,
  kind,
  onInvite,
}: {
  group: GroupDetail;
  kind: EducatorType;
  onInvite: () => void;
}) {
  const {
    data: assignments,
    error,
    refetch,
  } = useGroupAssignments(group.group_id);

  if (error) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">
          We couldn&apos;t load the vivas.
        </span>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (!assignments) {
    return (
      <div
        className="flex flex-col gap-3"
        role="status"
        aria-label="Loading the vivas"
      >
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    );
  }

  if (assignments.length === 0) {
    return group.member_count === 0 ? (
      <EmptyState
        title={`Invite your ${membersNoun(kind)} first`}
        body="Share a link or code. Once they join, set a viva and their reports come back here."
        action={
          <Button variant="ember" size="touch" onClick={onInvite}>
            <UserPlusIcon aria-hidden="true" />
            Invite {membersNoun(kind)}
          </Button>
        }
      />
    ) : (
      <EmptyState
        title="No vivas yet"
        body={`Pick a chapter and your ${membersNoun(kind)} will see it on their home page.`}
        action={
          <Button asChild variant="outline" size="touch">
            <Link href={teachAssignPath(group.group_id)}>
              <PlusIcon aria-hidden="true" />
              Set a viva
            </Link>
          </Button>
        }
      />
    );
  }

  const today = localDay();
  return (
    <ul className="glass-card flex flex-col gap-0.5 rounded-2xl p-1.5">
      {byOldest(assignments, (a) => a.created_at).map((assignment) => (
        <li key={assignment.assignment_id}>
          <VivaRow
            group={group}
            assignment={assignment}
            overdue={isOverdue(assignment, group.member_count, today)}
          />
        </li>
      ))}
    </ul>
  );
}

// --------------------------------------------------------------- students

/** Everyone who joined, the first to join at the top, with a way to invite more. */
function StudentList({
  group,
  kind,
  onInvite,
}: {
  group: GroupDetail;
  kind: EducatorType;
  onInvite: () => void;
}) {
  const noun = membersNoun(kind);
  if (group.members.length === 0) {
    return (
      <EmptyState
        title={`No ${noun} yet`}
        body="Share the link or code. Joining is their choice, and once they're in, the vivas you set appear on their home page."
        action={
          <Button variant="ember" size="touch" onClick={onInvite}>
            <UserPlusIcon aria-hidden="true" />
            Invite {noun}
          </Button>
        }
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Everyone who joined with your link or code.
        </p>
        <Button variant="outline" size="touch" onClick={onInvite}>
          <UserPlusIcon aria-hidden="true" />
          Invite {noun}
        </Button>
      </div>
      <ul className="glass-card flex flex-col divide-y divide-border rounded-2xl">
        {byOldest(group.members, (m) => m.joined_at).map((member) => (
          <MemberRow
            key={member.student_id}
            groupId={group.group_id}
            member={member}
          />
        ))}
      </ul>
    </div>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-border p-6 sm:p-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">{title}</h2>
        <p className="max-w-md text-muted-foreground">{body}</p>
      </div>
      {action}
    </div>
  );
}

/** The topics, or that it covers the whole chapter. */
export function scopeLabel(assignment: Assignment): string {
  const topics = assignment.curriculum_selection.chapters[0]?.topics ?? [];
  return topics.length
    ? topics.map((topic) => topic.name).join(", ")
    : "Whole chapter";
}

/**
 * One viva as one line of a list: what it is on the left, how it went on
 * the right. The average is the figure a teacher scans for; the count
 * under it says how complete that figure is.
 */
function VivaRow({
  group,
  assignment,
  overdue,
}: {
  group: GroupDetail;
  assignment: Assignment;
  overdue: boolean;
}) {
  const average = assignment.average_score;
  return (
    <Link
      href={teachVivaPath(group.group_id, assignment.assignment_id)}
      className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-lg px-3.5 py-3 transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium">{assignment.title}</span>
        <VivaMeta assignment={assignment} overdue={overdue} />
      </span>
      <span className="flex flex-col items-end gap-0.5">
        {average === null ? (
          <span
            className="font-mono text-base text-muted-foreground"
            aria-label="No scores yet"
          >
            –
          </span>
        ) : (
          <span className="font-mono text-base whitespace-nowrap">
            {average}
            <span className="text-muted-foreground">/10</span>
          </span>
        )}
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          {group.member_count === 0
            ? "No one joined yet"
            : `${assignment.completed_count} of ${group.member_count} done`}
        </span>
      </span>
    </Link>
  );
}

/**
 * "Science · Whole chapter · Due Fri 28 Nov". Overdue is the one state that
 * gets colour, because it is the one thing to chase.
 */
export function VivaMeta({
  assignment,
  overdue,
  className,
}: {
  assignment: Assignment;
  overdue: boolean;
  className?: string;
}) {
  const due = dueLabel(assignment.due_on);
  return (
    <span className={cn("truncate text-sm text-muted-foreground", className)}>
      {assignment.curriculum_selection.subject_name} · {scopeLabel(assignment)}{" "}
      ·{" "}
      {overdue ? (
        <span className="text-ember-text">Overdue, was due {due.slice(4)}</span>
      ) : (
        due
      )}
    </span>
  );
}

/** A thin, quiet bar: how much of the group has done it. */
export function Progress({ done, of }: { done: number; of: number }) {
  const share = of > 0 ? Math.min(100, Math.round((done / of) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={`${done} of ${of} done`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={share}
      className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
    >
      <div
        className="h-full rounded-full bg-foreground transition-[width] duration-500 motion-reduce:transition-none"
        style={{ width: `${share}%` }}
      />
    </div>
  );
}

// ------------------------------------------------- what the menu opens

function SidePanel({
  title,
  description,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  description: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-6 overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <SheetTitle className="text-xl font-medium">{title}</SheetTitle>
            <SheetDescription className="text-muted-foreground">
              {description}
            </SheetDescription>
          </div>
          <SheetClose asChild>
            <Button variant="glass" size="icon-touch" aria-label="Close">
              <XIcon aria-hidden="true" strokeWidth={2.5} />
            </Button>
          </SheetClose>
        </div>
        {children}
      </SheetContent>
    </Sheet>
  );
}

/**
 * The code is shown large because it is read aloud in class and copied off a
 * board; the link is what gets pasted into a WhatsApp group. Both lead to the
 * same place, and joining from either is the student's own choice.
 */
function InviteSheet({
  group,
  kind,
  open,
  onOpenChange,
}: {
  group: GroupDetail;
  kind: EducatorType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
    <SidePanel
      title={`Invite ${membersNoun(kind)}`}
      description="They open the link or enter the code after signing in. Joining lets you see the reports of vivas you set them."
      open={open}
      onOpenChange={onOpenChange}
    >
      <div className="glass-card flex flex-col gap-3 rounded-2xl p-5">
        <p className="label-mono text-muted-foreground">Join code</p>
        <p
          className="font-mono text-4xl font-medium tracking-[0.2em]"
          aria-label={`Join code ${group.join_code.split("").join(" ")}`}
        >
          {group.join_code}
        </p>
        {link ? (
          <p className="truncate text-sm text-muted-foreground">{link}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
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

      <div className="mt-auto border-t border-border pt-4">
        {confirmingNewCode ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              The current link and code will stop working. Anyone already in the
              group stays in it.
            </p>
            <div className="flex gap-2">
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
    </SidePanel>
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

/**
 * Deleting asks first, saying what is lost, because it cannot be undone and
 * it affects everyone in the group.
 */
function DeleteGroupDialog({
  group,
  kind,
  open,
  onOpenChange,
}: {
  group: GroupDetail;
  kind: EducatorType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const remove = useDeleteGroup(group.group_id);

  async function confirmDelete() {
    try {
      await remove.mutateAsync();
      track("group_deleted", { members: group.member_count });
      toast.success(`${group.name} deleted`);
      router.replace(TEACH_PATH);
    } catch {
      toast.error("Couldn't delete the group. Try again.");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle className="text-lg font-medium">
          Delete {group.name}?
        </DialogTitle>
        <DialogDescription className="text-muted-foreground">
          This removes it for everyone. Its {membersNoun(kind)} leave the group,
          its link stops working, and its vivas and reports are deleted. This
          can&apos;t be undone.
        </DialogDescription>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Keep it
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => void confirmDelete()}
          >
            Delete group
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GroupOutline() {
  return (
    <main
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10 sm:px-10 sm:py-14"
      role="status"
      aria-label="Loading the group"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-64" />
      </div>
      <Skeleton className="h-11 w-64 rounded-lg" />
      <Skeleton className="h-28 rounded-xl" />
    </main>
  );
}
