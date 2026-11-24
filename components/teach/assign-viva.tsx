"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { PageNotice } from "@/components/app/page-notice";
import { ChoiceChips } from "@/components/forms/choice-chips";
import { FormMessage, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChoiceBar } from "@/components/viva/choice-bar";
import { track } from "@/lib/analytics/events";
import { httpStatus } from "@/lib/api/errors";
import { GROUP_ID_PARAM, TEACH_PATH, teachGroupPath } from "@/lib/auth/routes";
import { useCreateAssignment, useGroup } from "@/lib/groups/use-groups";
import { membersNoun, educatorTypeOf } from "@/lib/groups/wording";
import { useMe } from "@/lib/hooks/use-me";
import { useVivaSetup } from "@/lib/hooks/use-viva-setup";
import type { GroupDetail } from "@/types/groups";
import { CLASS_LEVELS } from "@/types/profile";

const CLASS_OPTIONS = CLASS_LEVELS.map((level) => ({
  value: level,
  label: String(level),
}));

/** Today as YYYY-MM-DD in the teacher's own time zone, for the date picker. */
function today(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/**
 * Setting a viva uses the same subject, chapter and topic picker a student
 * uses, so the teacher chooses exactly what the student will be asked about.
 * A group with one class is fixed to it; a mixed group (often a parent's)
 * asks for the class first.
 */
export function AssignViva() {
  const groupId = useSearchParams().get(GROUP_ID_PARAM);
  const { data: group, error } = useGroup(groupId);
  const [chosenClass, setChosenClass] = useState<number | null>(null);

  if (!groupId || (error && [403, 404, 422].includes(httpStatus(error) ?? 0))) {
    return (
      <PageNotice
        label="Set a viva"
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
        label="Set a viva"
        title="We can't load this group"
        body="Check your connection and try again."
      >
        <Button asChild size="touch">
          <Link href={teachGroupPath(groupId)}>Back to the group</Link>
        </Button>
      </PageNotice>
    );
  }
  if (!group) {
    return (
      <main
        className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10 sm:px-10"
        role="status"
        aria-label="Loading the group"
      >
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-20 rounded-[20px]" />
      </main>
    );
  }

  const classLevel = group.class_level ?? chosenClass;

  return (
    <main className="animate-rise mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10 sm:px-10 sm:py-14">
      <header className="flex flex-col gap-4">
        <Button
          asChild
          variant="ghost"
          className="-ml-3 self-start text-muted-foreground"
        >
          <Link href={teachGroupPath(group.group_id)}>
            <ArrowLeftIcon aria-hidden="true" />
            {group.name}
          </Link>
        </Button>
        <h1 className="text-3xl font-light tracking-tight sm:text-4xl">
          Set a viva
        </h1>
        <p className="max-w-lg text-muted-foreground">
          Pick a chapter, and topics if you want to narrow it. Everyone in{" "}
          {group.name} sees it on their home page and takes it when they are
          ready.
        </p>
      </header>

      {group.class_level === null ? (
        <ChoiceChips
          legend="Which class is this viva for?"
          options={CLASS_OPTIONS}
          value={chosenClass}
          onChange={setChosenClass}
          columns="grid-cols-4 sm:grid-cols-8"
        />
      ) : null}

      {classLevel === null ? null : (
        // A new class starts a fresh choice of subject and chapter.
        <AssignForm key={classLevel} group={group} classLevel={classLevel} />
      )}
    </main>
  );
}

function AssignForm({
  group,
  classLevel,
}: {
  group: GroupDetail;
  classLevel: number;
}) {
  const router = useRouter();
  const { data: me } = useMe();
  const setup = useVivaSetup(classLevel);
  const create = useCreateAssignment(group.group_id);
  const [dueOn, setDueOn] = useState("");
  const [failed, setFailed] = useState<string>();
  const noun = membersNoun(educatorTypeOf(me?.profile));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const selection = setup.resolved;
    if (!selection || create.isPending) return;
    setFailed(undefined);
    try {
      await create.mutateAsync({
        curriculum_selection: selection,
        due_on: dueOn || null,
      });
      const chapter = selection.chapters[0];
      track("assignment_created", {
        class_level: selection.class_level,
        subject_id: selection.subject_id,
        chapter_id: chapter.id,
        topic_count: chapter.topics.length,
        has_due_date: Boolean(dueOn),
      });
      toast.success(`Viva set for ${group.name}`);
      router.push(teachGroupPath(group.group_id));
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: unknown } } })
        .response?.data?.detail;
      setFailed(
        httpStatus(error) === 422 && typeof detail === "string"
          ? detail
          : "We couldn't set that viva. Check your connection and try again.",
      );
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div className="max-w-xs">
        <TextField
          label="Due date"
          name="due-on"
          type="date"
          min={today()}
          value={dueOn}
          onChange={(event) => setDueOn(event.target.value)}
          hint={`Shown to your ${noun}. Leave it empty for no deadline.`}
          optional
        />
      </div>
      {failed ? <FormMessage tone="error">{failed}</FormMessage> : null}
      {setup.catalog === "failed" ? (
        <FormMessage tone="error">
          We couldn&apos;t load the subjects for Class {classLevel}.
        </FormMessage>
      ) : null}
      <ChoiceBar
        setup={setup}
        starting={create.isPending}
        actionLabel="Set viva"
        busyLabel="Setting"
      />
    </form>
  );
}
