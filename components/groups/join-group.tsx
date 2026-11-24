"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import {
  FormMessage,
  SubmitButton,
  TextField,
} from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { track } from "@/lib/analytics/events";
import { httpStatus } from "@/lib/api/errors";
import { HOME_PATH, JOIN_CODE_PARAM, joinPath } from "@/lib/auth/routes";
import { useInvitePreview, useJoinGroup } from "@/lib/groups/use-groups";
import { EDUCATOR_LABELS } from "@/types/profile";

/**
 * Where an invite link lands a student. It shows who is inviting them and
 * what joining means before anything happens: joining is their consent to
 * share the reports of vivas this person sets, so it is never automatic.
 *
 * Without a code in the address it asks for one, for a code read off a board.
 */
export function JoinGroup() {
  const code = useSearchParams().get(JOIN_CODE_PARAM);
  return code ? <Invite code={code} /> : <EnterCode />;
}

function EnterCode({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState(initialError);

  function submit(event: FormEvent) {
    event.preventDefault();
    const cleaned = code.replace(/[\s-]/g, "").toUpperCase();
    if (cleaned.length !== 6) {
      setError("A code has 6 letters and numbers.");
      return;
    }
    router.replace(joinPath(cleaned));
  }

  return (
    <JoinFrame>
      <div className="flex flex-col gap-3">
        <p className="label-mono text-muted-foreground">Join a group</p>
        <h1 className="text-3xl font-light tracking-tight sm:text-4xl">
          Enter your group code
        </h1>
        <p className="text-muted-foreground">
          Your teacher or parent will have shared it with you.
        </p>
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        <TextField
          label="Code"
          name="join-code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={9}
          className="font-mono text-lg tracking-[0.2em] uppercase"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          error={error}
        />
        <SubmitButton variant="ember" pending={false} pendingLabel="">
          Continue
        </SubmitButton>
      </form>
    </JoinFrame>
  );
}

function Invite({ code }: { code: string }) {
  const router = useRouter();
  const preview = useInvitePreview(code);
  const join = useJoinGroup();
  const [failed, setFailed] = useState<string>();
  const reported = useRef(false);

  const missing = preview.error && httpStatus(preview.error) === 404;

  useEffect(() => {
    if (reported.current || (!preview.data && !missing)) return;
    reported.current = true;
    track("group_invite_opened", { found: Boolean(preview.data) });
  }, [preview.data, missing]);

  if (missing) {
    return (
      <EnterCode initialError="That code doesn't match a group. Check it with whoever shared it." />
    );
  }
  if (preview.error) {
    return (
      <JoinFrame>
        <h1 className="text-3xl font-light tracking-tight">
          We can&apos;t open this invite
        </h1>
        <p className="text-muted-foreground">
          Check your connection and try again.
        </p>
        <Button size="touch" onClick={() => void preview.refetch()}>
          Try again
        </Button>
      </JoinFrame>
    );
  }
  if (!preview.data) {
    return (
      <JoinFrame>
        <div
          className="flex flex-col gap-3"
          role="status"
          aria-label="Opening the invite"
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-full" />
        </div>
      </JoinFrame>
    );
  }

  const invite = preview.data;
  const inviter = invite.owner_name;

  async function accept() {
    setFailed(undefined);
    try {
      const group = await join.mutateAsync(code);
      if (group.already_member) {
        // Joined from another tab or device since this page opened.
        toast.info(`You're already part of ${group.name}`);
      } else {
        track("group_joined", { owner_type: group.owner_type });
        toast.success(`You're in ${group.name}`);
      }
      router.replace(HOME_PATH);
    } catch (error) {
      const status = httpStatus(error);
      setFailed(
        status === 409
          ? "This group is full. Ask whoever shared the link."
          : status === 404
            ? "This code has just been changed. Ask for the new link."
            : status === 429
              ? "Too many tries. Wait a minute and try again."
              : "We couldn't join you. Check your connection and try again.",
      );
    }
  }

  const details = [
    `${EDUCATOR_LABELS[invite.owner_type]} · ${inviter}`,
    invite.class_level === null ? null : `Class ${invite.class_level}`,
  ]
    .filter(Boolean)
    .join(" · ");

  if (invite.already_member) {
    return (
      <JoinFrame>
        <div className="flex flex-col gap-3">
          <p className="label-mono text-muted-foreground">{details}</p>
          <h1 className="text-3xl font-light tracking-tight sm:text-4xl">
            You&apos;re already part of {invite.group_name}
          </h1>
          <p className="text-muted-foreground">
            There&apos;s nothing more to do. Vivas {inviter} sets for this group
            will appear on your home page.
          </p>
        </div>
        <Button
          variant="ember"
          size="touch"
          className="w-full"
          onClick={() => router.replace(HOME_PATH)}
        >
          Go to home
        </Button>
      </JoinFrame>
    );
  }

  return (
    <JoinFrame>
      <div className="flex flex-col gap-3">
        <p className="label-mono text-muted-foreground">{details}</p>
        <h1 className="text-3xl font-light tracking-tight sm:text-4xl">
          Join {invite.group_name}
        </h1>
        <p className="text-muted-foreground">
          {inviter} will be able to set vivas for you and read the reports of
          those vivas. They never hear or read what you said, only the report.
        </p>
      </div>
      {failed ? <FormMessage tone="error">{failed}</FormMessage> : null}
      <div className="flex flex-col gap-3">
        <Button
          variant="ember"
          size="touch"
          className="w-full"
          disabled={join.isPending}
          aria-busy={join.isPending}
          onClick={() => void accept()}
        >
          {join.isPending ? "Joining…" : "Join group"}
        </Button>
        <Button
          variant="ghost"
          size="touch"
          className="w-full"
          onClick={() => router.replace(HOME_PATH)}
        >
          Not now
        </Button>
      </div>
    </JoinFrame>
  );
}

function JoinFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="animate-rise mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-16">
      {children}
    </main>
  );
}
