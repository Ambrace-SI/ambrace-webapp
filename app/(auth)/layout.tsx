import type { ReactNode } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignedOutOnly } from "@/components/auth/signed-out-only";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AuthShell>
      <SignedOutOnly />
      {children}
    </AuthShell>
  );
}
