"use client";

import { useRef, useState, type ComponentType } from "react";
import { toast } from "sonner";

import { ChoiceChips } from "@/components/forms/choice-chips";
import { TextAreaField, TextField } from "@/components/forms/fields";
import { EditForm } from "@/components/settings/edit-form";
import {
  RowButton,
  SettingRow,
  SettingsGroup,
  SettingValue,
} from "@/components/settings/setting-rows";
import { isSignedOutError } from "@/lib/api/errors";
import { useSaveProfile } from "@/lib/hooks/use-me";
import {
  NAME_MAX_LENGTH,
  SCHOOL_ADDRESS_MAX_LENGTH,
  SCHOOL_NAME_MAX_LENGTH,
  draftFromProfile,
  toProfileUpdate,
  validateOptional,
  validateRequired,
  type ProfileDraft,
  type ProfileErrors,
} from "@/lib/onboarding/profile-form";
import {
  BOARDS,
  BOARD_LABELS,
  CLASS_LEVELS,
  type Profile,
} from "@/types/profile";

/** What an editor is given: the profile being edited, and how to change it. */
type EditorProps = {
  draft: ProfileDraft;
  update: (changes: Partial<ProfileDraft>) => void;
  error?: string;
};

/** One detail of the profile: how its row reads, and how it is edited. */
type Detail = {
  key: keyof ProfileDraft;
  label: string;
  description: string;
  /** The saved value as the row shows it, or null when there is none. */
  shown: (profile: Profile) => string | null;
  /** Said in place of the description while it is being changed. */
  whileEditing: string;
  Editor: ComponentType<EditorProps>;
};

const CLASS_OPTIONS = CLASS_LEVELS.map((level) => ({
  value: level,
  label: String(level),
}));
const BOARD_OPTIONS = BOARDS.map((board) => ({
  value: board,
  label: BOARD_LABELS[board],
}));

/**
 * The details, in the order onboarding asked for them. To let a student edit
 * something new about themselves, add it here.
 */
const DETAILS: Detail[] = [
  {
    key: "name",
    label: "Name",
    description: "Your examiner greets you by this name.",
    shown: (profile) => profile.name,
    whileEditing: "Your examiner will greet you by this name.",
    Editor: ({ draft, update, error }) => (
      <TextField
        label="Name"
        name="name"
        autoComplete="name"
        autoCapitalize="words"
        maxLength={NAME_MAX_LENGTH}
        value={draft.name}
        onChange={(event) => update({ name: event.target.value })}
        error={error}
      />
    ),
  },
  {
    key: "classLevel",
    label: "Class",
    description: "Decides the subjects and chapters you can choose for a viva.",
    shown: (profile) => `Class ${profile.class_level}`,
    whileEditing:
      "Your next viva will offer this class's subjects. Past reports stay as they are.",
    Editor: ({ draft, update, error }) => (
      <ChoiceChips
        legend="Class"
        options={CLASS_OPTIONS}
        value={draft.classLevel}
        // A class cannot be cleared, only swapped for another.
        onChange={(classLevel) => update({ classLevel })}
        error={error}
        columns="grid-cols-4"
      />
    ),
  },
  {
    key: "board",
    label: "Board",
    description: "The board your school follows.",
    shown: (profile) => (profile.board ? BOARD_LABELS[profile.board] : null),
    whileEditing: "Press your board again to clear it.",
    Editor: ({ draft, update }) => (
      <ChoiceChips
        legend="Board"
        options={BOARD_OPTIONS}
        value={draft.board}
        onChange={(board) => update({ board })}
        columns="grid-cols-2"
        optional
      />
    ),
  },
  {
    key: "schoolName",
    label: "School",
    description: "The school you study at.",
    shown: (profile) => profile.school_name,
    whileEditing: "Leave it empty to remove it.",
    Editor: ({ draft, update, error }) => (
      <TextField
        label="School name"
        name="school-name"
        autoComplete="organization"
        maxLength={SCHOOL_NAME_MAX_LENGTH}
        value={draft.schoolName}
        onChange={(event) => update({ schoolName: event.target.value })}
        error={error}
        optional
      />
    ),
  },
  {
    key: "schoolAddress",
    label: "School address",
    description: "Where your school is.",
    shown: (profile) => profile.school_address,
    whileEditing: "Leave it empty to remove it.",
    Editor: ({ draft, update, error }) => (
      <TextAreaField
        label="School address"
        name="school-address"
        autoComplete="street-address"
        maxLength={SCHOOL_ADDRESS_MAX_LENGTH}
        value={draft.schoolAddress}
        onChange={(event) => update({ schoolAddress: event.target.value })}
        error={error}
        optional
      />
    ),
  },
];

/**
 * What the student told us about themselves, one row each.
 *
 * Each row is changed on its own, in place, and saved the moment Save is
 * pressed. A long form with one Save at the bottom would make a student who
 * only wants to fix their name scroll past everything else, and wonder what
 * else they had changed. Only one row is open at a time.
 */
export function ProfileDetails({ profile }: { profile: Profile }) {
  const [editing, setEditing] = useState<Detail["key"] | null>(null);
  const group = useRef<HTMLDivElement>(null);

  function finish(key: Detail["key"]) {
    setEditing(null);
    // The cursor goes back to where the student pressed, not to the top.
    requestAnimationFrame(() =>
      group.current
        ?.querySelector<HTMLElement>(`[data-detail="${key}"]`)
        ?.focus(),
    );
  }

  return (
    <div ref={group}>
      <SettingsGroup title="Details">
        {DETAILS.map((detail) => {
          const shown = detail.shown(profile);
          const verb = shown ? "Edit" : "Add";
          const open = editing === detail.key;
          return (
            <SettingRow
              key={detail.key}
              label={detail.label}
              description={open ? detail.whileEditing : detail.description}
              value={<SettingValue>{shown}</SettingValue>}
              action={
                <RowButton
                  data-detail={detail.key}
                  aria-label={`${verb} ${detail.label.toLowerCase()}`}
                  onClick={() => setEditing(detail.key)}
                >
                  {verb}
                </RowButton>
              }
              editor={
                open ? (
                  <DetailEditor
                    detail={detail}
                    profile={profile}
                    onDone={() => finish(detail.key)}
                  />
                ) : undefined
              }
            />
          );
        })}
      </SettingsGroup>
    </div>
  );
}

/**
 * Edits one detail. The server stores the profile as a whole, so the rest of
 * it is sent back exactly as it was saved, with this one thing changed.
 */
function DetailEditor({
  detail,
  profile,
  onDone,
}: {
  detail: Detail;
  profile: Profile;
  onDone: () => void;
}) {
  const save = useSaveProfile();
  const [saved] = useState(() => draftFromProfile(profile));
  const [draft, setDraft] = useState(saved);
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState<string>();

  async function submit() {
    const problems: ProfileErrors = {
      ...validateRequired(draft),
      ...validateOptional(draft),
    };
    const problem = problems[detail.key as keyof ProfileErrors];
    setFieldError(problem);
    setFormError(undefined);
    if (problem) return;

    const request = toProfileUpdate(draft, { includeOptional: true });
    const unchanged =
      JSON.stringify(request) ===
      JSON.stringify(toProfileUpdate(saved, { includeOptional: true }));
    // Nothing to send; Save still does what was asked and closes the row.
    if (unchanged) return onDone();

    try {
      await save.mutateAsync(request);
      toast(`${detail.label} updated.`);
      onDone();
    } catch (error) {
      setFormError(
        isSignedOutError(error)
          ? "Your session has ended. Refresh the page to sign in again."
          : "We couldn't save that. Check your connection and try again.",
      );
    }
  }

  return (
    <EditForm
      onSubmit={() => void submit()}
      onCancel={onDone}
      pending={save.isPending}
      error={formError}
    >
      <detail.Editor
        draft={draft}
        update={(changes) => {
          setDraft((current) => ({ ...current, ...changes }));
          setFieldError(undefined);
        }}
        error={fieldError}
      />
    </EditForm>
  );
}
