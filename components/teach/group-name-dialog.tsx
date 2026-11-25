"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";

import { ChoiceChips } from "@/components/forms/choice-chips";
import {
  FormMessage,
  SubmitButton,
  TextField,
} from "@/components/forms/fields";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { track } from "@/lib/analytics/events";
import { teachGroupPath } from "@/lib/auth/routes";
import { newGroupDialog } from "@/lib/groups/new-group-dialog";
import { useCreateGroup, useRenameGroup } from "@/lib/groups/use-groups";
import { GROUP_NAME_MAX_LENGTH } from "@/types/groups";
import { CLASS_LEVELS } from "@/types/profile";

const CLASS_OPTIONS = CLASS_LEVELS.map((level) => ({
  value: level,
  label: String(level),
}));

// Same rule as profile names: no control or text-reordering characters.
const UNSAFE = /[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/;

function nameProblem(name: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return "Give the group a name.";
  if (trimmed.length > GROUP_NAME_MAX_LENGTH)
    return `Keep it under ${GROUP_NAME_MAX_LENGTH} characters.`;
  if (UNSAFE.test(trimmed)) return "The name has a character we can't use.";
  return undefined;
}

const SAVE_FAILED =
  "We couldn't save that. Check your connection and try again.";

/**
 * Creating a group asks for as little as possible: a name, and the class if
 * the whole group shares one. A parent's group often spans classes, so the
 * class can be left out. Once created, the teacher lands on the group, where
 * the invite link is waiting.
 */
export function NewGroupDialog() {
  const open = useSyncExternalStore(
    newGroupDialog.subscribe,
    newGroupDialog.isOpen,
    () => false,
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && newGroupDialog.close()}
    >
      <DialogContent>
        {/* Mounted only while open, so each new group starts blank. */}
        {open ? <NewGroupForm /> : null}
      </DialogContent>
    </Dialog>
  );
}

function NewGroupForm() {
  const router = useRouter();
  const create = useCreateGroup();
  const [name, setName] = useState("");
  const [classLevel, setClassLevel] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = nameProblem(name);
    setError(problem);
    if (problem) return;
    setFormError(undefined);
    try {
      const group = await create.mutateAsync({
        name: name.trim(),
        class_level: classLevel,
      });
      track("group_created", { class_level: classLevel });
      newGroupDialog.close();
      router.push(teachGroupPath(group.group_id));
    } catch {
      setFormError(SAVE_FAILED);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <DialogTitle>New group</DialogTitle>
        <DialogDescription>
          A class, a tuition batch or your own children. You&apos;ll get a link
          to share with them next.
        </DialogDescription>
      </div>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <TextField
        label="Group name"
        name="group-name"
        autoComplete="off"
        maxLength={GROUP_NAME_MAX_LENGTH}
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={error}
        hint="For example, Class 9-A Science"
      />
      <ChoiceChips
        legend="Class"
        options={CLASS_OPTIONS}
        value={classLevel}
        onChange={setClassLevel}
        columns="grid-cols-4"
        optional
      />
      <SubmitButton
        variant="ember"
        pending={create.isPending}
        pendingLabel="Creating…"
      >
        Create group
      </SubmitButton>
    </form>
  );
}

/** Renaming is the same name field on its own. */
export function RenameGroupDialog({
  groupId,
  currentName,
  open,
  onOpenChange,
}: {
  groupId: string;
  currentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <RenameForm
            groupId={groupId}
            currentName={currentName}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({
  groupId,
  currentName,
  onDone,
}: {
  groupId: string;
  currentName: string;
  onDone: () => void;
}) {
  const rename = useRenameGroup(groupId);
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = nameProblem(name);
    setError(problem);
    if (problem) return;
    try {
      await rename.mutateAsync(name.trim());
      onDone();
    } catch {
      setFormError(SAVE_FAILED);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <DialogTitle>Rename group</DialogTitle>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <TextField
        label="Group name"
        name="group-name"
        autoComplete="off"
        maxLength={GROUP_NAME_MAX_LENGTH}
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={error}
      />
      <SubmitButton pending={rename.isPending} pendingLabel="Saving…">
        Save
      </SubmitButton>
    </form>
  );
}
