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
    // EVERY session gets an explicit timeout + CAPTCHA solving — not just stealth ones.
    // The project's defaultTimeout is ~60s, but a single agent run can take 45-50s, so a
    // default-timeout session would END mid-run (COMPLETED + CDP socket 1006), nulling the
    // page and crashing the next Stagehand call with `awaitActivePage` on null. 300s gives
    // every target headroom to finish and still frees the session fast on release.
    //
    // Residential proxies stay OPT-IN — proxy bandwidth is metered separately ($12/GB) and
    // swarm runs blew 640% of the plan allowance (2026-07-05). They turn on for a stealth
    // retry (the "try harder" escalation on a target that a datacenter IP couldn't read) or
    // globally via BB_PROXIES=1. First-pass runs stay proxy-free unless the env flag is set.
    browserbaseSessionCreateParams: {
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      timeout: Number(process.env.BB_SESSION_TIMEOUT ?? 300),
      browserSettings: { solveCaptchas: true },
      ...(opts?.stealth || process.env.BB_PROXIES === "1" ? { proxies: true } : {}),
    },
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
