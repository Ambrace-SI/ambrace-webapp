import type { Metadata } from "next";
import { Suspense } from "react";

import { StudentGroup } from "@/components/groups/student-groups";

export const metadata: Metadata = { title: "Group" };

export default function Page() {
  // Which group is only known from the address, so it fills in after load.
  return (
    <Suspense>
      <StudentGroup />
    </Suspense>
  );
}
