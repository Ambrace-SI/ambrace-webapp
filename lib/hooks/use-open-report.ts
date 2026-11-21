"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { REPORT_ID_PARAM, REPORT_PATH } from "@/lib/auth/routes";

/** The viva whose report is on screen, or null on any other page. */
export function useOpenReportId(): string | null {
  const pathname = usePathname();
  const id = useSearchParams().get(REPORT_ID_PARAM);
  return pathname === REPORT_PATH ? id : null;
}
