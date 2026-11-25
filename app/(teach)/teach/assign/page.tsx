import type { Metadata } from "next";
import { Suspense } from "react";

import { AssignViva } from "@/components/teach/assign-viva";

export const metadata: Metadata = { title: "Set a viva" };

export default function Page() {
  // Which group is only known from the address, so it fills in after load.
  return (
    <Suspense>
      <AssignViva />
    </Suspense>
  );
}
