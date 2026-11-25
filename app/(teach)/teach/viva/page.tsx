import type { Metadata } from "next";
import { Suspense } from "react";

import { VivaResults } from "@/components/teach/viva-results";

export const metadata: Metadata = { title: "Viva results" };

export default function Page() {
  // Which viva is only known from the address, so it fills in after load.
  return (
    <Suspense>
      <VivaResults />
    </Suspense>
  );
}
