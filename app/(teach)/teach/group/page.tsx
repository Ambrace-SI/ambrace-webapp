import type { Metadata } from "next";
import { Suspense } from "react";

import { GroupPage } from "@/components/teach/group-page";

export const metadata: Metadata = { title: "Group" };

export default function Page() {
  // Which group is only known from the address, so it fills in after load.
  return (
    <Suspense>
      <GroupPage />
    </Suspense>
  );
}
