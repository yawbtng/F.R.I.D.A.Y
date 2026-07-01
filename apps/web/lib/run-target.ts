// The swarm worker, isomorphic (no React, no server-only deps) so the useSwarm hook (base "")
// and the verify-plan harness (base = APP URL) run the EXACT same shipping path — no drift.
// Drive one browser toward a target: resolve a start URL (its own, else discover via Exa),
// run the agent toward the goal, extract the answer, classify.

import { type SwarmTarget, toResultText, classifyGeneric } from "./swarm-target";
import type { WorkerStatus } from "./sos-adapters";

export const isHttpUrl = (u?: string): u is string => !!u && /^https?:\/\//i.test(u);

export interface RunSession {
  sessionId: string;
  token: string;
}

export interface RunResult {
  status: WorkerStatus;
  result: string;
  url?: string;
}

export async function runTarget(
  base: string,
  session: RunSession,
  target: SwarmTarget,
): Promise<RunResult> {
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` };
  const signal = AbortSignal.timeout(95_000); // don't let a stuck portal spin forever

  let startUrl = isHttpUrl(target.startUrl) ? target.startUrl : undefined;
  if (!startUrl && target.query) {
    // Discover the page when the planner only gave a search query. Best-effort.
    try {
      const sres = await fetch(`${base}/api/browser/search`, {
        method: "POST",
        headers,
        signal,
        body: JSON.stringify({ sessionId: session.sessionId, query: target.query }),
      });
      if (sres.ok) {
        const { results } = (await sres.json()) as { results?: Array<{ url: string }> };
        if (isHttpUrl(results?.[0]?.url)) startUrl = results![0].url;
      }
    } catch {
      /* discovery is best-effort; the agent still runs */
    }
  }

  const agentRes = await fetch(`${base}/api/browser/agent`, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      sessionId: session.sessionId,
      ...(startUrl ? { startUrl } : {}),
      instruction: target.goal,
      maxSteps: 25,
    }),
  });
  if (!agentRes.ok) {
    throw new Error((await agentRes.json().catch(() => ({}))).error || `agent HTTP ${agentRes.status}`);
  }

  const exRes = await fetch(`${base}/api/browser/extract`, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({ sessionId: session.sessionId, instruction: target.extract }),
  });
  if (!exRes.ok) {
    throw new Error((await exRes.json().catch(() => ({}))).error || `extract HTTP ${exRes.status}`);
  }
  const data = (await exRes.json()).data;

  // KYB targets carry a classifier (mapStatus); general targets classify generically.
  if (target.classify) return { status: target.classify(data), result: toResultText(data), url: startUrl };
  const g = classifyGeneric(data);
  return { status: g.status, result: g.result, url: startUrl };
}
