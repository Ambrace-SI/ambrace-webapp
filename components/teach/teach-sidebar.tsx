"use client";

import { PlusIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { AccountMenu } from "@/components/app/account-menu";
import { Logo } from "@/components/brand/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuLabel,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  GROUP_ID_PARAM,
  TEACH_GROUP_PATH,
  TEACH_PATH,
  teachGroupPath,
} from "@/lib/auth/routes";
import { useOwnedGroups } from "@/lib/groups/use-groups";
import { newGroupDialog } from "@/lib/groups/new-group-dialog";

/**
 * The teacher's or parent's side panel: their groups, one tap apart, and the
 * way to make another. Same frame as the student's panel, so the app feels
 * like one product whichever side of it you are on.
 */
export function TeachSidebar() {
  const { setOpenMobile } = useSidebar();
  const closeDrawer = () => setOpenMobile(false);

  return (
    <Sidebar label="Your groups and account">
      <SidebarHeader>
        <div className="flex h-11 items-center justify-between pl-2.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:pl-0">
          <Link
            href={TEACH_PATH}
            onClick={closeDrawer}
            className="rounded-md outline-none group-data-[collapsible=icon]:hidden focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Logo surface="theme" className="w-[120px]" priority />
          </Link>
          <SidebarTrigger />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="New group"
              className="font-medium"
              onClick={() => {
                closeDrawer();
                newGroupDialog.open();
              }}
            >
              <PlusIcon aria-hidden="true" />
              <SidebarMenuLabel>New group</SidebarMenuLabel>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Your groups</SidebarGroupLabel>
          {/* Which group is open is only known in the browser. */}
          <Suspense
            fallback={<GroupLinks current={null} onNavigate={closeDrawer} />}
          >
            <GroupLinksForThisPage onNavigate={closeDrawer} />
          </Suspense>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <AccountMenu />
      </SidebarFooter>
    </Sidebar>
  );
}

function GroupLinksForThisPage({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const current =
    pathname === TEACH_GROUP_PATH ? params.get(GROUP_ID_PARAM) : null;
  return <GroupLinks current={current} onNavigate={onNavigate} />;
}

function GroupLinks({
  current,
  onNavigate,
}: {
  current: string | null;
  onNavigate: () => void;
}) {
  const { data: groups } = useOwnedGroups();

  if (!groups) return null;
  if (groups.length === 0) {
    return (
      <p className="px-2 text-sm text-muted-foreground">
        Groups you create appear here.
      </p>
    );
  }
  return (
    <SidebarMenu>
      {groups.map((group) => {
        const active = group.group_id === current;
        return (
          <SidebarMenuItem key={group.group_id}>
            <SidebarMenuButton asChild isActive={active}>
              <Link
                href={teachGroupPath(group.group_id)}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
              >
                <UsersIcon aria-hidden="true" />
                <SidebarMenuLabel className="truncate">
                  {group.name}
                </SidebarMenuLabel>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
