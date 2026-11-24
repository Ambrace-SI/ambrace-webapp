import type { Metadata } from "next";

import { TeachHome } from "@/components/teach/teach-home";

export const metadata: Metadata = { title: "Your groups" };

export default function Page() {
  return <TeachHome />;
}
