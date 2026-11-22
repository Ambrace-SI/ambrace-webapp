import type { Metadata } from "next";

import { VivaRoom } from "@/components/viva/viva-room";

export const metadata: Metadata = { title: "Home" };

/** Home is the viva room: the welcome, the choices and the viva itself. */
export default function Page() {
  return <VivaRoom />;
}
