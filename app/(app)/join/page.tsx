import type { Metadata } from "next";
import { Suspense } from "react";

import { JoinGroup } from "@/components/groups/join-group";

export const metadata: Metadata = { title: "Join a group" };

export default function Page() {
  // The code is only known from the address, so it fills in after load.
  return (
    <Suspense>
      <JoinGroup />
    </Suspense>
  );
}
