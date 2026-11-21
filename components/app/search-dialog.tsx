"use client";

import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { reportPath } from "@/lib/auth/routes";
import { describeViva, searchVivas } from "@/lib/history/describe";
import { useHistory } from "@/lib/hooks/use-history";

/** With nothing typed, the most recent reports are offered. */
const RECENT = 5;

/**
 * Find a report by chapter or by the name it was given.
 *
 * It looks through the vivas already loaded in the side panel. When there are
 * older ones still on the server it says so and offers to fetch them, instead
 * of claiming there is no match.
 */
export function SearchDialog({
  open,
  onOpenChange,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: () => void;
}) {
  const history = useHistory();
  const router = useRouter();
  const [typed, setTyped] = useState("");

  // Search is for opening a report, so only vivas that have one are offered.
  const reports = (history.data ?? []).filter(
    (viva) => viva.status === "completed",
  );
  const asked = typed.trim() !== "";
  const shown = asked ? searchVivas(reports, typed) : reports.slice(0, RECENT);

  function close() {
    onOpenChange(false);
    setTyped("");
    onNavigate();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setTyped("");
      }}
    >
      <DialogContent className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Search your vivas</DialogTitle>
        <DialogDescription className="sr-only">
          Type a chapter. Press Enter to open the first match.
        </DialogDescription>

        <form
          role="search"
          className="flex items-center gap-3 border-b border-border px-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (shown.length === 0) return;
            router.push(reportPath(shown[0].viva_session_id));
            close();
          }}
        >
          <SearchIcon
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            aria-label="Search your vivas"
            placeholder="Electricity"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            className="h-13 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </form>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {shown.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {asked
                ? history.hasNextPage
                  ? "No match in the vivas loaded so far."
                  : "No viva matches that."
                : "Your reports will appear here after your first viva."}
            </p>
          ) : (
            <>
              <p className="label-mono px-3 py-2 text-muted-foreground">
                {asked ? "Matches" : "Recent"}
              </p>
              <ul className="flex flex-col gap-0.5">
                {shown.map((viva) => {
                  const row = describeViva(viva);
                  return (
                    <li key={row.id}>
                      <Link
                        href={reportPath(row.id)}
                        onClick={close}
                        className="flex min-h-11 flex-col justify-center rounded-lg px-3 py-2 text-sm outline-none hover:bg-muted focus-visible:bg-muted"
                      >
                        <span className="truncate">{row.title}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {row.detail}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {history.hasNextPage ? (
          <div className="border-t border-border p-1.5">
            <Button
              variant="ghost"
              size="lg"
              className="w-full text-muted-foreground"
              disabled={history.isFetchingNextPage}
              onClick={() => void history.fetchNextPage()}
            >
              {history.isFetchingNextPage
                ? "Loading"
                : "Load older vivas to search"}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
