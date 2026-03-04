"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * Reactively fetch the latest screenshot URL for a session.
 * Returns null if no screenshot is stored or Convex is loading.
 *
 * Usage:
 *   const screenshotUrl = useSessionScreenshot(session.lastScreenshot);
 */
export function useSessionScreenshot(
  storageId: Id<"_storage"> | null | undefined,
): string | null | undefined {
  return useQuery(
    api.screenshots.getUrl,
    storageId ? { storageId } : "skip",
  );
}
