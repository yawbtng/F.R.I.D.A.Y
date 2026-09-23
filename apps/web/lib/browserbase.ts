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

// Browserbase session lifetime, in seconds. Guarded because an unvalidated
// `Number(process.env.BB_SESSION_TIMEOUT)` sends NaN straight to the create-session API and
// EVERY fleet spawn 500s — a one-character env typo takes the whole swarm down, not one target.
// Range: 60s is the platform floor (below it a session can end before the first agent step);
// 21_600s (6h) is the platform ceiling. Default 300 — see the comment on the call site below.
const BB_SESSION_TIMEOUT_S = (() => {
  const n = Number(process.env.BB_SESSION_TIMEOUT);
  if (!Number.isFinite(n)) return 300;
  return Math.min(21_600, Math.max(60, Math.trunc(n)));
})();

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
    // Residential proxies are OFF by default and there are exactly two ways to turn them on;
    // both are a deliberate opt-in, never an automatic escalation:
    //   1. `opts.stealth` — set ONLY by the shield / "stealth retry" button. The user clicking
    //      it IS the consent: it says "these tiles were blocked, spend proxy bandwidth on them".
    //   2. `BB_PROXIES=1` — forces proxies on for every session in the run, globally.
    // Nothing else flips this: a first-pass run, an auto-retry, or a voice retarget all stay on
    // plain datacenter IPs. That default exists because proxy bandwidth is metered separately
    // ($12/GB) and unguarded swarm runs burned 640% of the plan allowance (2026-07-05).
    //
    // Read the cost before clicking: stealth retry spawns ONE metered residential session PER
    // unresolved tile, so a retry over 12 blocked tiles is 12 proxied browsers, not one.
    browserbaseSessionCreateParams: {
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      timeout: BB_SESSION_TIMEOUT_S,
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
