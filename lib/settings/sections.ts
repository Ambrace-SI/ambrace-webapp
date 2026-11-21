import { ShieldCheckIcon, UserRoundIcon, type LucideIcon } from "lucide-react";

/**
 * Every part of Settings, in the order they are listed.
 *
 * To add one: add it here, then give it a panel in
 * `components/settings/settings-window.tsx`. TypeScript refuses to build
 * until the new part has one.
 */
export const SETTINGS_SECTIONS = [
  {
    id: "profile",
    label: "Profile",
    description: "What your examiner knows about you.",
    icon: UserRoundIcon,
  },
  {
    id: "account",
    label: "Account",
    description: "How you sign in, and the way out.",
    icon: ShieldCheckIcon,
  },
] as const satisfies readonly {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
}[];

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];
export type SettingsSectionId = SettingsSection["id"];

/** Where Settings opens when no part was asked for. */
export const DEFAULT_SETTINGS_SECTION: SettingsSectionId =
  SETTINGS_SECTIONS[0].id;

export function isSettingsSection(id: string): id is SettingsSectionId {
  return SETTINGS_SECTIONS.some((section) => section.id === id);
}
