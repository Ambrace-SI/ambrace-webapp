import type { Metadata } from "next";

import { VivaRoom } from "@/components/viva/viva-room";

export const metadata: Metadata = { title: "Viva" };

export default function Page() {
  return <VivaRoom />;
}
