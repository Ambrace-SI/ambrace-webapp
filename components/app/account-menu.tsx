"use client";

import {
  ChevronsUpDownIcon,
  Loader2Icon,
  LogOutIcon,
  SettingsIcon,
} from "lucide-react";
import { useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuLabel,
  useSidebar,
} from "@/components/ui/sidebar";
import { leaveAmbrace } from "@/lib/app/sign-out";
import { useMe } from "@/lib/hooks/use-me";
import { settingsWindow } from "@/lib/settings/settings-window";
import { BOARD_LABELS } from "@/types/profile";

/**
 * Who is signed in, at the foot of the side panel, with the way to their
 * settings and the way out. The theme is in Settings, under Appearance.
 *
 * Signing out sits one step away, inside a menu, so it is never pressed by a
 * thumb reaching for something else.
 */
export function AccountMenu() {
  const { data: me } = useMe();
  const { isMobile, setOpenMobile } = useSidebar();
  const [leaving, setLeaving] = useState(false);

  const profile = me?.profile;
  const name = profile?.name.trim() || "Your account";
  const details = profile
    ? [
        `Class ${profile.class_level}`,
        profile.board ? BOARD_LABELS[profile.board] : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              aria-label={`Account menu for ${name}`}
              className="aria-expanded:bg-sidebar-accent"
            >
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-medium text-background"
              >
                {name.charAt(0).toUpperCase()}
              </span>
              <SidebarMenuLabel className="flex flex-col">
                <span className="truncate font-medium">{name}</span>
                {details ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {details}
                  </span>
                ) : null}
              </SidebarMenuLabel>
              <ChevronsUpDownIcon
                aria-hidden="true"
                className="size-4! text-muted-foreground group-data-[collapsible=icon]:hidden"
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? "top" : "right"}
            align="end"
            className="w-56"
          >
            <DropdownMenuItem
              onSelect={() => {
                // On a phone the drawer would sit on top of Settings.
                setOpenMobile(false);
                settingsWindow.open();
              }}
            >
              <SettingsIcon aria-hidden="true" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={leaving}
              onSelect={(event) => {
                // Stay open while it works, so the press is seen to land.
                event.preventDefault();
                setLeaving(true);
                void leaveAmbrace();
              }}
            >
              {leaving ? (
                <Loader2Icon className="animate-spin" aria-hidden="true" />
              ) : (
                <LogOutIcon aria-hidden="true" />
              )}
              {leaving ? "Signing out" : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
