import { MonitorIcon, MoonIcon, SunIcon, type LucideIcon } from "lucide-react";

import type { ThemePreference } from "@/lib/theme/theme";

/**
 * How each theme choice is shown, in the order it is offered. Settings →
 * Appearance reads this list; anything else that offers the choice later
 * should read it too, so the names and icons stay the same everywhere.
 *
 * "system" is called Device: it is the word a student uses for their phone or
 * laptop's own setting.
 */
export const THEME_OPTIONS = [
  {
    value: "light",
    label: "Light",
    description: "Paper, for reading and writing.",
    icon: SunIcon,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Ink, easier on the eyes at night.",
    icon: MoonIcon,
  },
  {
    value: "system",
    label: "Device",
    description: "Follows your phone or laptop.",
    icon: MonitorIcon,
  },
] as const satisfies readonly {
  value: ThemePreference;
  label: string;
  description: string;
  icon: LucideIcon;
}[];
