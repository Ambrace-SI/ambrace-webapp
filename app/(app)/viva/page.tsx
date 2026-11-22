import type { Metadata } from "next";

import { ForwardHome } from "@/components/app/forward-home";

export const metadata: Metadata = { title: "Viva" };

/** Vivas start from home now; this address stays so old links still land. */
export default function Page() {
  return <ForwardHome />;
}
