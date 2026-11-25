import type { ReactNode } from "react";

import { AppShell } from "@/components/app/app-shell";
import { SessionGate } from "@/components/app/session-gate";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SessionGate needs="profile" audience="student">
      <AppShell>{children}</AppShell>
    </SessionGate>
  );
}
