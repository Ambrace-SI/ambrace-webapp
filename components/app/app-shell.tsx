"use client";

import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";

import { AppSidebar } from "@/components/app/app-sidebar";
import { Logo } from "@/components/brand/logo";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { panelPreference } from "@/lib/app/panel-preference";
import { HOME_PATH } from "@/lib/auth/routes";

/**
 * The frame around every signed-in page outside the viva room: the side panel
 * on the left and the page beside it.
 *
 * On a phone the panel is a drawer, so a slim bar at the top carries the
 * button that opens it. On a laptop the panel is always there and that bar is
 * not needed.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const open = useSyncExternalStore(
    panelPreference.subscribe,
    panelPreference.isOpen,
    // The page is prepared before anyone's preference is known: start open.
    () => true,
  );

  return (
    <TooltipProvider delayDuration={300}>
      <SidebarProvider open={open} onOpenChange={panelPreference.remember}>
        <AppSidebar />
        <SidebarInset>
          <header className="flex items-center gap-1 border-b border-border px-2 py-1.5 md:hidden">
            <SidebarTrigger />
            <Link
              href={HOME_PATH}
              className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Logo surface="paper" className="w-[120px]" priority />
            </Link>
          </header>
          {children}
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </TooltipProvider>
  );
}
