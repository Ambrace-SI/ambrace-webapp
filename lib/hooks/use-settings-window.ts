"use client";

import { useSyncExternalStore } from "react";

import { settingsWindow } from "@/lib/settings/settings-window";

/** The part of Settings that is open, or null when the window is closed. */
export function useSettingsSection() {
  return useSyncExternalStore(
    settingsWindow.subscribe,
    settingsWindow.section,
    settingsWindow.sectionOnServer,
  );
}
