// Live smoke for the Browserbase keepAlive create-then-reattach flow — the single
// assumption the whole app rests on. Isolates it from LiveKit/Convex/voice.
//
// Run from the web package (Stagehand resolves there):
//   cd apps/web && npx --yes tsx scripts/smoke-browserbase.ts
//
// Loads the repo-root .env itself (no dotenv dep). Spends ONE Browserbase session
// and requests its release at the end.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Stagehand } from "@browserbasehq/stagehand";

// Load the repo-root .env into process.env (simple KEY=VALUE lines).
// Resolve from this file's dir so cwd doesn't matter: apps/web/scripts -> repo root.
const ENV_PATH = resolve(__dirname, "../../../.env");
for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const log = (step: string, msg: string) => console.log(`[smoke] ${step}: ${msg}`);

async function main() {
  const API_KEY = process.env.BROWSERBASE_API_KEY!;
  const PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID!;
  const model = {
    modelName: "xai/grok-4.1-fast",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY!,
  };

  log(
    "env",
    `BB key ${API_KEY ? "ok" : "MISSING"}, project ${PROJECT_ID ? "ok" : "MISSING"}, OpenRouter ${process.env.OPENROUTER_API_KEY ? "ok" : "MISSING"}`,
  );

  // 1. Create with keepAlive, capture the session id, close the creating handle.
  const creator = new Stagehand({ env: "BROWSERBASE", apiKey: API_KEY, projectId: PROJECT_ID, keepAlive: true, model });
  await creator.init();
  const sessionId = creator.browserbaseSessionID!;
  log("create", `session ${sessionId} created`);
  await creator.close();
  log("create", "creating handle closed — keepAlive should keep the session alive");

  // 2. Reattach to the same session id. THIS is the keepAlive test.
  const worker = new Stagehand({
    env: "BROWSERBASE",
    browserbaseSessionID: sessionId,
    apiKey: API_KEY,
    projectId: PROJECT_ID,
    keepAlive: true,
    model,
  });
  await worker.init();
  log("reattach", "reattached to the existing session OK");

  const page = worker.context.activePage()!;
  await page.goto("https://example.com");
  const title = await page.title();
  const shot = await page.screenshot();
  log("navigate", `title="${title}", screenshot ${shot.length} bytes`);
  await worker.close();

  // 3. Clean up — request release so we don't leak a session.
  const res = await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}`, {
    method: "POST",
    headers: { "x-bb-api-key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ projectId: PROJECT_ID, status: "REQUEST_RELEASE" }),
  });
  log("cleanup", `release request -> HTTP ${res.status}`);

  log("result", "PASS — keepAlive create-then-reattach works on this tier");
}

main().catch((err) => {
  console.error("[smoke] FAIL:", err instanceof Error ? err.stack || err.message : err);
  process.exit(1);
});
