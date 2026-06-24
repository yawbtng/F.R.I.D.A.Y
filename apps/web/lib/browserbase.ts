// Shared Browserbase session creation. Used by both /api/session (single voice
// browser) and /api/fleet (swarm), so the two paths behave identically — same
// model, same keepAlive handling, same live-view URL + scoped JWT.
//
// NOTE: keepAlive lets the session survive `close()` so /api/browser/* can reattach.
// If the plan tier doesn't support keepAlive, both paths break together and the fix
// is here, in one place. Verify behaviour with a live smoke run.

import { Stagehand } from "@browserbasehq/stagehand";
import { createSessionToken } from "./api-auth";

export interface CreatedSession {
  sessionId: string;
  liveViewUrl: string;
  token: string;
}

export async function createBrowserSession(opts?: { stealth?: boolean }): Promise<CreatedSession> {
  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    apiKey: process.env.BROWSERBASE_API_KEY!,
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    keepAlive: true,
    // Route through Browserbase's Model Gateway: a plain provider/model slug billed via
    // the Browserbase API key (the top-level apiKey above). No provider key or baseURL.
    model: process.env.STAGEHAND_MODEL || "openai/gpt-4.1-mini",
    // Stealth pass: residential proxies + auto CAPTCHA-solving, set at session creation
    // (reattaches preserve it). Verified to clear anti-bot walls a naive session hits
    // (OH security check, MI) and to expose ones mislabeled "notfound" (VA/CT) as real
    // blocks. Some walls (NV hCaptcha) still need Scale-tier advancedStealth.
    ...(opts?.stealth
      ? {
          browserbaseSessionCreateParams: {
            projectId: process.env.BROWSERBASE_PROJECT_ID!,
            proxies: true,
            browserSettings: { solveCaptchas: true },
          },
        }
      : {}),
  });
  await stagehand.init();
  const sessionId = stagehand.browserbaseSessionID!;

  // Live-view URL for the mission-control grid (per-session iframe).
  const debugRes = await fetch(
    `https://api.browserbase.com/v1/sessions/${sessionId}/debug`,
    { headers: { "x-bb-api-key": process.env.BROWSERBASE_API_KEY! } },
  );
  const { debuggerFullscreenUrl } = (await debugRes.json()) as {
    debuggerFullscreenUrl: string;
  };

  const token = await createSessionToken(sessionId);
  await stagehand.close(); // keepAlive keeps the session alive after the handle closes

  return { sessionId, liveViewUrl: debuggerFullscreenUrl, token };
}

/**
 * End a session on Browserbase. `stagehand.close()` alone does NOT stop a keepAlive
 * session — it disconnects the handle but the cloud session keeps RUNNING (and billing)
 * until the platform idle-timeout. REQUEST_RELEASE ends it immediately. Call this whenever
 * a swarm worker finishes so concurrency frees up and minutes aren't wasted.
 */
export async function releaseBrowserSession(sessionId: string): Promise<void> {
  await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}`, {
    method: "POST",
    headers: {
      "x-bb-api-key": process.env.BROWSERBASE_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      status: "REQUEST_RELEASE",
    }),
  });
}
