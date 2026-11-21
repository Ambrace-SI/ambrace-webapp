"use client";

import { XIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Tabs } from "radix-ui";
import type { ComponentType } from "react";

import { AccountSettings } from "@/components/settings/account/account-settings";
import { ProfileSettings } from "@/components/settings/profile/profile-settings";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import { useSettingsSection } from "@/lib/hooks/use-settings-window";
import { EDIT_FORM_ATTRIBUTE } from "@/lib/settings/editing";
import {
  SETTINGS_SECTIONS,
  isSettingsSection,
  type SettingsSectionId,
} from "@/lib/settings/sections";
import { settingsWindow } from "@/lib/settings/settings-window";

/** What each part of Settings shows. A new part must be given one here. */
const PANELS: Record<SettingsSectionId, ComponentType> = {
  profile: ProfileSettings,
  account: AccountSettings,
};

/** How the highlight moves between parts: quick, and settling without a bounce. */
const GLIDE = { type: "spring", stiffness: 500, damping: 40 } as const;

/**
 * Settings: a window over whatever page the student is on.
 *
 * It is a window, not a page, because a student changing their name should
 * find the page they were on exactly as they left it when they close it.
 *
 * The parts are listed down the left on a laptop and across the top on a
 * phone, where the window fills the screen. They are tabs, so the arrow keys
 * move between them and a screen reader announces "Profile, tab, 1 of 2".
 */
export function SettingsWindow() {
  const section = useSettingsSection();
  const isMobile = useIsMobile();
  const stillMotion = useReducedMotion();

  return (
    <Dialog
      open={section !== null}
      onOpenChange={(open) => {
        if (!open) settingsWindow.close();
      }}
    >
      <DialogContent
        className="h-dvh max-w-full gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-[min(44rem,calc(100dvh-4rem))] sm:max-w-4xl sm:rounded-xl sm:border"
        onOpenAutoFocus={(event) => {
          // The window itself takes the cursor, not its first tab. A screen
          // reader then announces "Settings" and what is showing, and nobody
          // is greeted by a focus ring on a tab they did not choose.
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
        onEscapeKeyDown={(event) => {
          // Inside a form that is changing a setting, Escape cancels that
          // change (the form sees the same key press). Only elsewhere does it
          // close Settings.
          const target = event.target as Element | null;
          if (target?.closest(`[${EDIT_FORM_ATTRIBUTE}]`))
            event.preventDefault();
        }}
      >
        {section ? (
          <Tabs.Root
            value={section}
            onValueChange={(next) => {
              if (isSettingsSection(next)) settingsWindow.open(next);
            }}
            orientation={isMobile ? "horizontal" : "vertical"}
            className="flex h-full min-h-0 flex-col sm:flex-row"
          >
            <div className="flex shrink-0 flex-col gap-4 border-b border-border bg-sidebar px-4 pt-4 pb-3 sm:w-56 sm:border-r sm:border-b-0 sm:pb-4">
              <DialogTitle className="px-2 pr-12 text-xl sm:pr-2">
                Settings
              </DialogTitle>
              <Tabs.List
                aria-label="Settings"
                className="flex gap-1 overflow-x-auto sm:flex-col"
              >
                {SETTINGS_SECTIONS.map(({ id, label, icon: Icon }) => (
                  <Tabs.Trigger
                    key={id}
                    value={id}
                    className="relative isolate flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-sm whitespace-nowrap text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=active]:font-medium data-[state=active]:text-foreground"
                  >
                    {id === section ? (
                      // One highlight for the whole list. It glides to the
                      // chosen part instead of blinking off and on, so the
                      // eye is led to where the student now is.
                      <motion.span
                        layoutId="settings-part"
                        aria-hidden="true"
                        className="absolute inset-0 -z-10 rounded-lg bg-sidebar-accent"
                        transition={stillMotion ? { duration: 0 } : GLIDE}
                      />
                    ) : null}
                    <Icon className="size-5 shrink-0" aria-hidden="true" />
                    {label}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </div>

            {SETTINGS_SECTIONS.map(({ id, label, description }) => {
              const Panel = PANELS[id];
              return (
                <Tabs.Content
                  key={id}
                  value={id}
                  className="min-h-0 flex-1 overflow-y-auto outline-none"
                >
                  <div className="animate-rise flex flex-col gap-8 px-5 py-6 sm:px-10 sm:py-8">
                    <div className="flex flex-col gap-1.5 sm:pr-10">
                      <h3 className="text-2xl">{label}</h3>
                      {/* Read out as the window opens, so it describes the
                          part that is showing. */}
                      <DialogDescription className="text-base">
                        {description}
                      </DialogDescription>
                    </div>
                    <Panel />
                  </div>
                </Tabs.Content>
              );
            })}
          </Tabs.Root>
        ) : null}

        <DialogClose
          aria-label="Close settings"
          className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <XIcon className="size-5" aria-hidden="true" />
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
