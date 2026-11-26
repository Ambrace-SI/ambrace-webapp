import type { Metadata } from "next";
import { Suspense } from "react";

import { StudentResultReport } from "@/components/teach/viva-results";

export const metadata: Metadata = { title: "Student report" };

export default function Page() {
  // Whose report is only known from the address, so it fills in after load.
  return (
    <Suspense>
      <StudentResultReport />
    </Suspense>
  );
}
