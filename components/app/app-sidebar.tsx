"use client";

import { HistoryIcon, PlusIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { AccountMenu } from "@/components/app/account-menu";
import { HistoryList, HistoryOutline } from "@/components/app/history-list";
import { SearchDialog } from "@/components/app/search-dialog";
import { Logo } from "@/components/brand/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuLabel,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { HOME_PATH, VIVA_PATH } from "@/lib/auth/routes";

/**
 * The side panel: start a viva, find an old one, open a report, sign out.
 *
 * Everything a student moves between lives here, in the same place on every
 * page. Folded, it is a strip of icons that each still say what they are.
 */
export function AppSidebar() {
  const { isMobile, state, setOpen, setOpenMobile } = useSidebar();
  const [searching, setSearching] = useState(false);
  const folded = !isMobile && state === "collapsed";

  // On a phone, choosing somewhere to go also puts the drawer away.
  const closeDrawer = () => setOpenMobile(false);

  // Ctrl+K (Cmd+K on a Mac) opens search from anywhere.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k") return;
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      // The search window lives in the panel, so the drawer opens with it.
      if (isMobile) setOpenMobile(true);
      setSearching(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobile, setOpenMobile]);

  return (
    <Sidebar label="Your vivas and account">
      <SidebarHeader>
        <div className="flex h-11 items-center justify-between pl-2.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:pl-0">
          {folded ? null : (
            <Link
              href={HOME_PATH}
              onClick={closeDrawer}
              className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Logo surface="paper" className="w-[120px]" priority />
            </Link>
          )}
          <SidebarTrigger />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Which page is open is only known in the browser. */}
            <Suspense fallback={<NewVivaRow onNavigate={closeDrawer} />}>
              <NewVivaRowForThisPage onNavigate={closeDrawer} />
            </Suspense>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Search vivas"
              aria-label="Search vivas"
              onClick={() => setSearching(true)}
            >
              <SearchIcon aria-hidden="true" />
              <SidebarMenuLabel>Search vivas</SidebarMenuLabel>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {folded ? (
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Your vivas"
                  aria-label="Show your vivas"
                  onClick={() => setOpen(true)}
                >
                  <HistoryIcon aria-hidden="true" />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        ) : (
          <Suspense fallback={<HistoryOutline />}>
            <HistoryList onNavigate={closeDrawer} />
          </Suspense>
        )}
      </SidebarContent>

      <SidebarFooter>
        <AccountMenu />
      </SidebarFooter>

      <SearchDialog
        open={searching}
        onOpenChange={setSearching}
        onNavigate={closeDrawer}
      />
    </Sidebar>
  );
}

/** A plain row, not the warm button: each page has one of those already. */
function NewVivaRow({
  current = false,
  onNavigate,
}: {
  current?: boolean;
  onNavigate: () => void;
}) {
  return (
    <SidebarMenuButton
      asChild
      isActive={current}
      tooltip="New viva"
      className="font-medium"
    >
      <Link
        href={VIVA_PATH}
        aria-current={current ? "page" : undefined}
        onClick={onNavigate}
      >
        <PlusIcon aria-hidden="true" />
        <SidebarMenuLabel>New viva</SidebarMenuLabel>
      </Link>
    </SidebarMenuButton>
  );
}

/** The same row, marked when the student is already choosing a viva. */
function NewVivaRowForThisPage({ onNavigate }: { onNavigate: () => void }) {
  const current = usePathname() === VIVA_PATH;
  return <NewVivaRow current={current} onNavigate={onNavigate} />;
}
