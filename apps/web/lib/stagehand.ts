import { Stagehand } from "@browserbasehq/stagehand";

interface StagehandEntry {
  stagehand: Stagehand;
  lastUsed: number;
  currentUrl: string;
  cachedScreenshot: string | null;
}

const instances = new Map<string, StagehandEntry>();
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

export async function getStagehand(sessionId: string): Promise<Stagehand> {
  const existing = instances.get(sessionId);
  if (existing) {
    existing.lastUsed = Date.now();
    return existing.stagehand;
  }

  const stagehand = new Stagehand({
    browserbaseSessionID: sessionId,
    env: "BROWSERBASE",
    apiKey: process.env.BROWSERBASE_API_KEY!,
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    keepAlive: true,
    // Route through Browserbase's Model Gateway: a plain provider/model slug billed via
    // the Browserbase API key (the top-level apiKey above). No provider key or baseURL.
    model: process.env.STAGEHAND_MODEL || "openai/gpt-4.1-mini",
  });
  await stagehand.init();

  instances.set(sessionId, {
    stagehand,
    lastUsed: Date.now(),
    currentUrl: "",
    cachedScreenshot: null,
  });

  return stagehand;
}

/** URL cache: skip navigation if already on the target URL (30s TTL) */
export function getCachedScreenshot(
  sessionId: string,
  url: string
): string | null {
  const entry = instances.get(sessionId);
  if (!entry || entry.currentUrl !== url) return null;
  if (Date.now() - entry.lastUsed > 30_000) return null;
  return entry.cachedScreenshot;
}

export function updateCache(
  sessionId: string,
  url: string,
  screenshot: string
): void {
  const entry = instances.get(sessionId);
  if (entry) {
    entry.currentUrl = url;
    entry.cachedScreenshot = screenshot;
    entry.lastUsed = Date.now();
  }
}

/** Remove a session from the singleton map (used on explicit close) */
export function removeSession(sessionId: string): void {
  const entry = instances.get(sessionId);
  if (entry) {
    entry.stagehand.close().catch(() => {});
    instances.delete(sessionId);
  }
}

// Cleanup idle sessions every 60s
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of instances) {
    if (now - entry.lastUsed > IDLE_TIMEOUT_MS) {
      entry.stagehand.close().catch(() => {});
      instances.delete(id);
    }
  }
}, 60_000);
