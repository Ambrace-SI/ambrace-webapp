"use client";

import { RouteError } from "@/components/app/route-error";

/**
 * Catches a page that breaks inside the signed-in frame. Sitting here keeps
 * the side panel on screen, so the student can still go somewhere else.
 */
export default RouteError;
