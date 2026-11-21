"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type ReactNode } from "react";

import { AppSidebar } from "@/components/app/app-sidebar";
import { Logo } from "@/components/brand/logo";
import { SettingsWindow } from "@/components/settings/settings-window";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { panelPreference } from "@/lib/app/panel-preference";
import { WholeScreenContext } from "@/lib/app/whole-screen";
import { HOME_PATH } from "@/lib/auth/routes";

/**
 * The frame around every signed-in page: the side panel on the left and the
 * page beside it. It is one frame for all of them, so the panel stays exactly
 * as it was while the student moves between pages.
 *
 * On a phone the panel is a drawer, so a slim bar at the top carries the
 * button that opens it. On a laptop the panel is always there and that bar is
 * not needed.
 *
 * A page can ask for the whole screen (see useWholeScreen); the panel and the
 * bar are then put away until it hands the screen back.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const open = useSyncExternalStore(
    panelPreference.subscribe,
    panelPreference.isOpen,
    // The page is prepared before anyone's preference is known: start open.
    () => true,
  );
  const [wholeScreen, setWholeScreen] = useState(false);

  // The panel and the bar come and go around the page; the page itself never
  // moves. If it did, React would build it again from nothing, and a viva
  // that had just begun would be thrown away.
  return (
    <TooltipProvider delayDuration={300}>
      <SidebarProvider open={open} onOpenChange={panelPreference.remember}>
        {wholeScreen ? null : <AppSidebar />}
        <SidebarInset>
          {wholeScreen ? null : (
            <header className="flex items-center gap-1 border-b border-border px-2 py-1.5 md:hidden">
              <SidebarTrigger />
              <Link
                href={HOME_PATH}
                className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Logo surface="paper" className="w-[120px]" priority />
              </Link>
            </header>
          )}
          <WholeScreenContext value={setWholeScreen}>
            {children}
          </WholeScreenContext>
        </SidebarInset>
      </SidebarProvider>
      {/* Settings opens over any page, but never over a viva in progress. */}
      {wholeScreen ? null : <SettingsWindow />}
      <Toaster />
    </TooltipProvider>
  );
}
