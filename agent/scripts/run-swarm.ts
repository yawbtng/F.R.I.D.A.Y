// Local-first swarm runner (no LiveKit/Convex needed). Spawns a fleet via /api/fleet,
// fans the state worker out across it, prints "X of N", then releases the fleet.
//
// Prereq: the web app running (pnpm --filter @friday/web dev) so /api/fleet and
// /api/browser/* are reachable, with BROWSERBASE_* + AGENT_API_SECRET in env.
//
// Usage (from repo root):
//   NEXT_PUBLIC_APP_URL=http://localhost:3000 \
//   agent/node_modules/.bin/tsx agent/scripts/run-swarm.ts "Acme Corp" DE CA NY

import { runSwarm } from "../src/fleet/orchestrator.js";
import { makeStateWorker } from "../src/fleet/worker.js";
import { STATE_ADAPTERS } from "../src/fleet/states.js";
import type { AgentContext } from "../src/lib/agent-fetch.js";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface SpawnedBrowser {
  browserId: string;
  sessionId: string;
  token: string;
  liveViewUrl: string;
}

async function main() {
  const [entityName, ...states] = process.argv.slice(2);
  if (!entityName || states.length === 0) {
    console.error('Usage: tsx agent/scripts/run-swarm.ts "<entityName>" <STATE...>');
    process.exit(1);
  }
  console.log(`[swarm] verifying "${entityName}" across: ${states.join(", ")}`);

  // 1. Spawn the fleet.
  const spawnRes = await fetch(`${APP_URL}/api/fleet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count: states.length }),
  });
  if (!spawnRes.ok) {
    throw new Error(`fleet spawn failed: HTTP ${spawnRes.status} ${await spawnRes.text()}`);
  }
  const { browsers } = (await spawnRes.json()) as { browsers: SpawnedBrowser[] };
  console.log(`[swarm] spawned ${browsers.length} browser(s):`);
  browsers.forEach((b, i) => console.log(`  ${states[i]} -> ${b.liveViewUrl}`));

  // 2. Fan out: one browser per state.
  const inputs = states.map((s) => ({ state: s, entityName }));
  const contexts: AgentContext[] = browsers.map((b) => ({ sessionId: b.sessionId, token: b.token }));
  const worker = makeStateWorker(STATE_ADAPTERS);
  const t0 = Date.now();
  const result = await runSwarm(inputs, worker, { concurrency: 6, contextFor: (_in, i) => contexts[i] });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  // 3. Report.
  console.log(`\n[swarm] ${result.succeeded} of ${result.total} verified in ${elapsed}s (${result.failed} failed)`);
  for (const r of result.results) {
    console.log(`  ${r.state.padEnd(3)} ${r.status.padEnd(9)} ${r.ms}ms  ${r.raw.slice(0, 400)}`);
  }

  // 4. Clean up.
  await Promise.all(
    browsers.map((b) =>
      fetch(`${APP_URL}/api/fleet`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: b.sessionId }),
      }).catch(() => {}),
    ),
  );
  console.log("[swarm] fleet released");
}

main().catch((e) => {
  console.error("[swarm] FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
