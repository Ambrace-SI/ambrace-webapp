import type { Metadata } from "next";
import { Suspense } from "react";

import { ReportOutline, VivaReport } from "@/components/report/viva-report";

export const metadata: Metadata = { title: "Report" };

export default function Page() {
  // Which report to show is only known from the address, so the outline is
  // what can be prepared ahead and the report itself fills in after.
  return (
    <Suspense fallback={<ReportOutline />}>
      <VivaReport />
    </Suspense>
  );
}
