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

export async function createBrowserSession(): Promise<CreatedSession> {
  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    apiKey: process.env.BROWSERBASE_API_KEY!,
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    keepAlive: true,
    model: {
      modelName: "xai/grok-4.1-fast",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY!,
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
