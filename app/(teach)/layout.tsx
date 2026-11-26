import type { ReactNode } from "react";

import { AppShell } from "@/components/app/app-shell";
import { SessionGate } from "@/components/app/session-gate";
import { NewGroupDialog } from "@/components/teach/group-name-dialog";
import { TeachSidebar } from "@/components/teach/teach-sidebar";
import { TEACH_PATH } from "@/lib/auth/routes";

/** The teacher's and parent's side: the same frame, their own panel. */
export default function TeachLayout({ children }: { children: ReactNode }) {
  return (
    <SessionGate needs="profile" audience="educator">
      <AppShell sidebar={<TeachSidebar />} homePath={TEACH_PATH}>
        {children}
        <NewGroupDialog />
      </AppShell>
    </SessionGate>
  );
}
