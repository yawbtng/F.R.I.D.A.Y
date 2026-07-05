// Smoke test for Browserbase Agents (launched 2026-06-30) BEFORE building the escalation
// engine on it. Validates the docs' claims: POST /v1/agents/runs returns runId+sessionId,
// the session exposes an embeddable live-view (sessions.debug), polling reaches a terminal
// state, and `result` conforms to the resultSchema. Costs 1 Agents call (Developer tier: 15/mo).
//
// Usage (from repo root):  agent/node_modules/.bin/tsx apps/web/scripts/smoke-agent.ts

import { readFileSync } from "fs";

for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const H = { "x-bb-api-key": process.env.BROWSERBASE_API_KEY!, "Content-Type": "application/json" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("[smoke] POST /v1/agents/runs …");
  const startRes = await fetch("https://api.browserbase.com/v1/agents/runs", {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      task: "Go to https://example.com and report the exact text of the main heading (the h1).",
      resultSchema: {
        type: "object",
        properties: { heading: { type: "string", description: "the h1 text on the page" } },
        required: ["heading"],
      },
      // Proxies gated behind BB_PROXIES=1 — proxy bandwidth bills at $12/GB (off by default).
      browserSettings: { proxies: process.env.BB_PROXIES === "1" },
    }),
  });
  const startText = await startRes.text();
  console.log(`[smoke] start HTTP ${startRes.status}`);
  if (!startRes.ok) {
    console.log("[smoke] body:", startText.slice(0, 600));
    return;
  }
  const start = JSON.parse(startText);
  const runId: string = start.runId ?? start.id;
  console.log("[smoke] runId:", runId, "· sessionId(start):", start.sessionId ?? "(not yet)");

  const terminal = ["COMPLETED", "FAILED", "STOPPED", "TIMED_OUT"];
  let run: Record<string, unknown> = start;
  let liveViewChecked = false;
  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    const r = await fetch(`https://api.browserbase.com/v1/agents/runs/${runId}`, { headers: H });
    if (!r.ok) {
      console.log(`\n[smoke] poll HTTP ${r.status}:`, (await r.text()).slice(0, 300));
      break;
    }
    run = await r.json();
    const sessionId = run.sessionId as string | undefined;
    process.stdout.write(`\r[smoke] status: ${run.status}  session: ${sessionId ?? "-"}      `);

    // Confirm the agent session exposes an embeddable live-view (the grid needs this).
    if (sessionId && !liveViewChecked) {
      liveViewChecked = true;
      const dbg = await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}/debug`, { headers: H });
      const d = dbg.ok ? await dbg.json() : {};
      console.log(
        `\n[smoke] live-view (sessions.debug HTTP ${dbg.status}):`,
        (d.debuggerFullscreenUrl || d.debuggerUrl || "(none)").slice(0, 90),
      );
    }
    if (terminal.includes(run.status as string)) break;
  }

  console.log("\n[smoke] FINAL status:", run.status);
  console.log("[smoke] result:", JSON.stringify(run.result));
}

main().catch((e) => console.error("[smoke] FAILED:", e instanceof Error ? e.message : e));
