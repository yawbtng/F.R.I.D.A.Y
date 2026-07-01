// Headless verification for the general-purpose swarm path. Calls /api/swarm/plan for a
// free-form task, spawns a fleet, then runs each planned target through the SAME shipping
// runTarget the grid uses (importing lib/run-target), releasing each session the instant its
// lookup finishes. Use it to prove an arbitrary task resolves before trusting it on camera.
//
// Prereq: dev server running (pnpm --filter @friday/web dev).
// Usage (from repo root):
//   agent/node_modules/.bin/tsx apps/web/scripts/verify-plan.ts "<task>" [stealth]

import { planToTargets } from "../lib/swarm-target";
import { runTarget } from "../lib/run-target";
import type { PlanTarget } from "../lib/schemas";

const APP = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface Spawned {
  sessionId: string;
  token: string;
  liveViewUrl: string;
}

function releaseOne(sessionId: string) {
  return fetch(`${APP}/api/fleet`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  }).catch(() => {});
}

async function main() {
  const [task, ...rest] = process.argv.slice(2);
  if (!task) {
    console.error('usage: tsx apps/web/scripts/verify-plan.ts "<task>" [stealth]');
    process.exit(1);
  }
  const stealth = rest.some((a) => a.toLowerCase() === "stealth");

  console.log(`[plan] planning: "${task}"`);
  const planRes = await fetch(`${APP}/api/swarm/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task }),
  });
  if (!planRes.ok) throw new Error(`plan ${planRes.status}: ${(await planRes.text()).slice(0, 240)}`);
  const { title, targets: planTargets } = (await planRes.json()) as {
    title: string;
    targets: PlanTarget[];
  };
  const targets = planToTargets(planTargets);
  console.log(`[plan] "${title}" -> ${targets.length} targets:`);
  for (const t of targets) console.log(`   - ${t.label}  [${t.startUrl ?? "search: " + t.query}]`);

  console.log(`\n[verify] spawning ${targets.length} (stealth=${stealth})…`);
  const res = await fetch(`${APP}/api/fleet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count: targets.length, stealth }),
  });
  if (!res.ok) throw new Error(`fleet spawn ${res.status}: ${await res.text()}`);
  const { browsers } = (await res.json()) as { browsers: Spawned[] };

  const t0 = Date.now();
  const rows = await Promise.all(
    targets.map(async (tgt, i) => {
      const st = Date.now();
      let status: string, result: string;
      try {
        const r = await runTarget(APP, browsers[i], tgt);
        status = r.status;
        result = r.result;
      } catch (e) {
        status = "error";
        result = e instanceof Error ? e.message : String(e);
      }
      await releaseOne(browsers[i].sessionId); // close the moment this lookup is done
      return { label: tgt.label, status, result, ms: Date.now() - st };
    }),
  );
  const total = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n[verify] done in ${total}s (wall-clock, parallel)\n`);
  let resolved = 0;
  for (const r of rows) {
    if (["done", "active", "inactive"].includes(r.status)) resolved++;
    console.log(
      `  ${r.label.slice(0, 26).padEnd(28)} ${r.status.padEnd(9)} ${String(r.ms + "ms").padEnd(8)} ${String(r.result).slice(0, 70)}`,
    );
  }
  console.log(`\n[verify] ${resolved}/${targets.length} resolved (done/active/inactive); fleet released`);
}

main().catch((e) => {
  console.error("[verify] FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
