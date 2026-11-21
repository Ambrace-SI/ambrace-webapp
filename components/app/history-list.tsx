"use client";

import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

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
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  useSidebar,
} from "@/components/ui/sidebar";
import { HOME_PATH, reportPath } from "@/lib/auth/routes";
import { describeViva, type VivaRow } from "@/lib/history/describe";
import {
  useDeleteViva,
  useHistory,
  useRenameViva,
} from "@/lib/hooks/use-history";

/** A viva's name can be this long; the server refuses more. */
const TITLE_LIMIT = 200;
const OUTLINE_WIDTHS = ["72%", "54%", "81%", "63%", "47%"];
/** The highlight that follows the pointer from row to row. */
const GLIDE = { type: "spring", stiffness: 350, damping: 30 } as const;

/**
 * The student's past vivas, newest first.
 *
 * Each row is the chapter, with when it was and how it went underneath. A
 * finished viva opens its report. One that ended early has no report, so it
 * is listed but does not pretend to lead anywhere. Any row can be renamed or
 * deleted from the menu at its end.
 */
export function HistoryList({ onNavigate }: { onNavigate: () => void }) {
  const history = useHistory();
  const rename = useRenameViva();
  const remove = useDeleteViva();
  const pathname = usePathname();
  const router = useRouter();
  const stillMotion = useReducedMotion();

  const [pointedAt, setPointedAt] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<VivaRow | null>(null);

  function saveName(row: VivaRow, typed: string) {
    setRenaming(null);
    const title = typed.trim();
    if (!title || title === row.title) return;
    rename.mutate(
      { id: row.id, title },
      { onError: () => toast.error("Couldn't rename that viva. Try again.") },
    );
  }

  function confirmDelete(row: VivaRow) {
    setDeleting(null);
    remove.mutate(row.id, {
      onError: () => toast.error("Couldn't delete that viva. Try again."),
    });
    // The report on screen is the one being deleted: leave it.
    if (pathname === reportPath(row.id)) router.replace(HOME_PATH);
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Your vivas</SidebarGroupLabel>
      <ListBody
        history={history}
        renderRow={(row) => {
          const open = pathname === reportPath(row.id);
          return (
            <SidebarMenuItem
              key={row.id}
              onPointerEnter={() => setPointedAt(row.id)}
            >
              {pointedAt === row.id && !open ? (
                <motion.span
                  layoutId="viva-pointed-at"
                  aria-hidden="true"
                  className="absolute inset-0 rounded-lg bg-sidebar-accent/70"
                  transition={stillMotion ? { duration: 0 } : GLIDE}
                />
              ) : null}
              {renaming === row.id ? (
                <RenameField
                  row={row}
                  onSave={(typed) => saveName(row, typed)}
                  onCancel={() => setRenaming(null)}
                />
              ) : (
                <>
                  <RowBody row={row} open={open} onNavigate={onNavigate} />
                  <RowMenu
                    row={row}
                    onRename={() => setRenaming(row.id)}
                    onDelete={() => setDeleting(row)}
                  />
                </>
              )}
            </SidebarMenuItem>
          );
        }}
        onPointerLeave={() => setPointedAt(null)}
      />

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Delete this viva?</DialogTitle>
          <DialogDescription>
            &ldquo;{deleting?.title}&rdquo; and its report will be removed for
            good.
          </DialogDescription>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              size="touch"
              onClick={() => setDeleting(null)}
            >
              Cancel
            </Button>
            <Button
              size="touch"
              className="bg-destructive text-foreground hover:bg-destructive/85"
              onClick={() => deleting && confirmDelete(deleting)}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarGroup>
  );
}

/** The rows' shape while the list loads, so nothing jumps when it arrives. */
function HistoryRowsOutline() {
  return (
    <div aria-busy="true">
      <p className="sr-only" role="status">
        Loading your vivas
      </p>
      {OUTLINE_WIDTHS.map((width) => (
        <SidebarMenuSkeleton key={width} width={width} />
      ))}
    </div>
  );
}

/**
 * The whole list as an outline. The list marks the report being read, which
 * it learns from the address, and on a report page the address is not known
 * while the page is being prepared. This is what stands in until it is.
 */
export function HistoryOutline() {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Your vivas</SidebarGroupLabel>
      <HistoryRowsOutline />
    </SidebarGroup>
  );
}

function ListBody({
  history,
  renderRow,
  onPointerLeave,
}: {
  history: ReturnType<typeof useHistory>;
  renderRow: (row: VivaRow) => ReactNode;
  onPointerLeave: () => void;
}) {
  if (history.isPending) return <HistoryRowsOutline />;

  const vivas = history.data;
  // A failed refresh keeps showing the list already on screen.
  if (!vivas) {
    return (
      <div className="flex flex-col items-start gap-2 px-2.5 py-1">
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t load your vivas. Check your connection and try again.
        </p>
        <Button
          variant="outline"
          size="lg"
          onClick={() => void history.refetch()}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (vivas.length === 0) {
    return (
      <p className="px-2.5 py-1 text-sm text-muted-foreground">
        Your reports collect here after each viva, so you can see how
        you&apos;re improving.
      </p>
    );
  }

  return (
    <>
      <SidebarMenu onPointerLeave={onPointerLeave}>
        {vivas.map((viva) => renderRow(describeViva(viva)))}
      </SidebarMenu>
      {history.hasNextPage ? (
        <Button
          variant="ghost"
          size="lg"
          className="mt-1 justify-start px-3 text-muted-foreground"
          disabled={history.isFetchingNextPage}
          onClick={() => void history.fetchNextPage()}
        >
          {history.isFetchingNextPage
            ? "Loading"
            : history.isFetchNextPageError
              ? "Couldn't load more. Try again"
              : "Show older vivas"}
        </Button>
      ) : null}
    </>
  );
}

function RowBody({
  row,
  open,
  onNavigate,
}: {
  row: VivaRow;
  open: boolean;
  onNavigate: () => void;
}) {
  const words = (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate">{row.title}</span>
      <span className="truncate text-xs font-normal text-muted-foreground">
        {row.detail}
      </span>
    </span>
  );

  if (!row.hasReport) {
    return (
      <div className="relative flex min-h-11 items-center px-3 py-2 pr-11 text-sm text-muted-foreground">
        {words}
      </div>
    );
  }

  return (
    <SidebarMenuButton
      asChild
      isActive={open}
      // The gliding highlight above is this row's hover.
      className="hover:bg-transparent"
    >
      <Link
        href={reportPath(row.id)}
        aria-current={open ? "page" : undefined}
        onClick={onNavigate}
      >
        {words}
      </Link>
    </SidebarMenuButton>
  );
}

function RowMenu({
  row,
  onRename,
  onDelete,
}: {
  row: VivaRow;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { isMobile } = useSidebar();
  // Both choices move focus somewhere new (the name field, the question).
  // Without this the closing menu would pull focus back to its own button.
  const handedOn = useRef(false);

  return (
    // Not modal: the delete question opens straight after, and two modal
    // layers closing and opening together can leave the page unclickable.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <SidebarMenuAction aria-label={`More options for ${row.title}`}>
          <MoreHorizontalIcon aria-hidden="true" />
        </SidebarMenuAction>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={isMobile ? "bottom" : "right"}
        align={isMobile ? "end" : "start"}
        onCloseAutoFocus={(event) => {
          if (!handedOn.current) return;
          handedOn.current = false;
          event.preventDefault();
        }}
      >
        <DropdownMenuItem
          onSelect={() => {
            handedOn.current = true;
            onRename();
          }}
        >
          <PencilIcon aria-hidden="true" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            handedOn.current = true;
            onDelete();
          }}
        >
          <Trash2Icon aria-hidden="true" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RenameField({
  row,
  onSave,
  onCancel,
}: {
  row: VivaRow;
  onSave: (typed: string) => void;
  onCancel: () => void;
}) {
  // Escape also blurs the field; this stops that blur saving what was typed.
  const cancelled = useRef(false);

  return (
    <input
      aria-label={`New name for ${row.title}`}
      defaultValue={row.title}
      maxLength={TITLE_LIMIT}
      autoFocus
      onFocus={(event) => event.currentTarget.select()}
      onBlur={(event) => {
        if (!cancelled.current) onSave(event.currentTarget.value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          cancelled.current = true;
          onCancel();
        }
      }}
      className="relative h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    />
  );
}
