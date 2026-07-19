// Riskiest-assumption probe for the demo's hero beat: does Browserbase stealth + proxies
// + CAPTCHA-solving clear the states that block a naive run? Creates a one-off Stagehand
// session (keepAlive off so close() ends it) with stealth on/off, runs the same
// agent + extract a swarm worker runs, and prints the resolved status.
//
// Usage (from apps/web):
//   node_modules/.bin/tsx scripts/test-stealth.ts NV OH IL           # stealth ON
//   node_modules/.bin/tsx scripts/test-stealth.ts NV OH IL nostealth # baseline

import { readFileSync } from "fs";
import { Stagehand } from "@browserbasehq/stagehand";
import { STATE_ADAPTERS, STATUS_EXTRACT, goalFor, mapStatus } from "../lib/sos-adapters";

// Load apps/web/.env (symlink to repo-root .env) since tsx doesn't auto-load it.
try {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const MODEL = process.env.STAGEHAND_MODEL || "openai/gpt-4.1-mini";
const ENTITY = process.env.ENTITY || "Walmart Inc.";
const stealth = !process.argv.includes("nostealth");
const states = process.argv.slice(2).filter((s) => s !== "nostealth").map((s) => s.toUpperCase());

async function runOne(state: string) {
  const adapter = STATE_ADAPTERS[state];
  if (!adapter) return console.log(`${state}: no adapter`);

  const sh = new Stagehand({
    env: "BROWSERBASE",
    apiKey: process.env.BROWSERBASE_API_KEY!,
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    keepAlive: false,
    model: MODEL,
    ...(stealth
      ? {
          browserbaseSessionCreateParams: {
            projectId: process.env.BROWSERBASE_PROJECT_ID!,
            // Proxies gated behind BB_PROXIES=1 — proxy bandwidth bills at $12/GB (off by default).
            ...(process.env.BB_PROXIES === "1" ? { proxies: true } : {}),
            browserSettings: { solveCaptchas: true },
          },
        }
      : {}),
  });

  const t0 = Date.now();
  try {
    await sh.init();
    const page = sh.context.activePage()!;
    await page.goto(adapter.searchUrl);
    await sh.agent({ model: MODEL }).execute({ instruction: goalFor(adapter, ENTITY), maxSteps: 25 });
    const data = await sh.extract(STATUS_EXTRACT);
    console.log(
      `${state.padEnd(3)} ${mapStatus(data).padEnd(9)} ${String(Date.now() - t0 + "ms").padEnd(8)} stealth=${stealth}  ${JSON.stringify(data).slice(0, 80)}`,
    );
  } catch (e) {
    console.log(
      `${state.padEnd(3)} ERROR     ${String(Date.now() - t0 + "ms").padEnd(8)} stealth=${stealth}  ${e instanceof Error ? e.message.slice(0, 110) : e}`,
    );
  } finally {
    await sh.close().catch(() => {});
  }
}

(async () => {
  console.log(`[stealth-test] "${ENTITY}" states=${states.join(",")} stealth=${stealth}\n`);
  await Promise.all(states.map(runOne));
})();
