import type { Metadata } from "next";

import { StudentGroups } from "@/components/groups/student-groups";

export const metadata: Metadata = { title: "Your groups" };

export default function Page() {
  return <StudentGroups />;
}
