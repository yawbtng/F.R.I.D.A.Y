// The swarm worker, isomorphic (no React, no server-only deps) so the useSwarm hook (base "")
// and the verify-plan harness (base = APP URL) run the EXACT same shipping path — no drift.
//
// Agency: attempt 1 drives the agent on the target's start URL (its own, or one discovered via
// Exa search). If a GENERAL target comes back unresolved (the answer usually isn't on the
// landing page), it does ONE search-augmented retry — web-search the answer, navigate to the
// next distinct result, re-extract with augmented context. KYB targets keep the proven single
// pass (they have a specialized classifier + the UI stealth retry). Bot-walls are detected from
// the agent's own narration and marked Blocked so the stealth retry can pick them up.

import { type SwarmTarget, toResultText, classifyGeneric, isEmptyAnswer } from "./swarm-target";
import type { WorkerStatus } from "./sos-adapters";
import { isBlocked } from "./sos-adapters";

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

// Per attempt (agent + extract). MUST stay under the /api/browser/agent route's maxDuration
// (60s on Vercel) so the client aborts just before the platform would kill the function.
// The old 75s let the agent outrun both the route AND the ~60s default session timeout — the
// session ended mid-run, the CDP socket dropped (1006), and the next Stagehand call crashed on
// a null page (`awaitActivePage`). With maxSteps capped low (below) a real lookup settles in
// ~25-35s, so 55s is generous headroom, not a guillotine.
const ATTEMPT_TIMEOUT_MS = 55_000;
// A business-registry lookup is "search a name, read the status" — a handful of steps, not 25.
// Fewer steps = the run finishes inside the session/route budget instead of grinding to a crash,
// and each avoided step is one fewer LLM call billed. Override via AGENT_MAX_STEPS if a portal
// genuinely needs more room.
const AGENT_MAX_STEPS = Number(process.env.AGENT_MAX_STEPS ?? 8);

/** A settled, useful answer — not worth retrying. */
function isResolved(status: WorkerStatus, result: string): boolean {
  return (status === "done" || status === "active" || status === "inactive") && !isEmptyAnswer(result);
}

/** Web-search a query and return candidate result URLs (best first). Best-effort. */
async function searchUrls(base: string, session: RunSession, query: string): Promise<string[]> {
  try {
    const res = await fetch(`${base}/api/browser/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({ sessionId: session.sessionId, query }),
    });
    if (!res.ok) return [];
    const { results } = (await res.json()) as { results?: Array<{ url: string }> };
    return (results ?? []).map((r) => r.url).filter(isHttpUrl);
  } catch {
    return [];
  }
}

/** One pass: navigate the agent toward `goal`, then read the answer with `extractQ`. Detects
 *  bot-walls from the agent's own message so they classify as Blocked, not Not found. */
async function attempt(
  base: string,
  session: RunSession,
  url: string | undefined,
  goal: string,
  extractQ: string,
  target: SwarmTarget,
): Promise<{ status: WorkerStatus; result: string; agentMsg: string }> {
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` };
  const signal = AbortSignal.timeout(target.timeoutMs ?? ATTEMPT_TIMEOUT_MS);

  const agentRes = await fetch(`${base}/api/browser/agent`, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      sessionId: session.sessionId,
      ...(url ? { startUrl: url } : {}),
      instruction: goal,
      maxSteps: target.maxSteps ?? AGENT_MAX_STEPS,
    }),
  });
  if (!agentRes.ok) {
    throw new Error((await agentRes.json().catch(() => ({}))).error || `agent HTTP ${agentRes.status}`);
  }
  const agentData = (await agentRes.json())?.data as
    | { message?: string; blocked?: boolean }
    | undefined;
  const agentMsg = String(agentData?.message ?? "");
  // Fast settle: the route flags nav-time CAPTCHA walls (`blocked: true`) and the agent
  // narrates ones it hit mid-run. Either way the page is a bot-wall — skip the extract
  // pass and mark Blocked now instead of grinding another LLM call against the wall.
  if (agentData?.blocked || isBlocked(agentMsg)) {
    return { status: "blocked", result: agentMsg || "blocked", agentMsg };
  }

  const exRes = await fetch(`${base}/api/browser/extract`, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({ sessionId: session.sessionId, instruction: extractQ }),
  });
  if (!exRes.ok) {
    throw new Error((await exRes.json().catch(() => ({}))).error || `extract HTTP ${exRes.status}`);
  }
  const data = (await exRes.json()).data;

  let status: WorkerStatus;
  let result: string;
  if (target.classify) {
    status = target.classify(data);
    result = toResultText(data);
  } else {
    ({ status, result } = classifyGeneric(data));
  }
  return { status, result, agentMsg };
}

export async function runTarget(
  base: string,
  session: RunSession,
  target: SwarmTarget,
  onProgress?: (note: string) => void,
): Promise<RunResult> {
  // Resolve a start URL: the target's own, else discover one via search.
  let startUrl = isHttpUrl(target.startUrl) ? target.startUrl : undefined;
  let searchResults: string[] = [];
  if (!startUrl && target.query) {
    onProgress?.("searching");
    searchResults = await searchUrls(base, session, target.query);
    startUrl = searchResults[0];
  }

  const r1 = await attempt(base, session, startUrl, target.goal, target.extract, target);
  if (isResolved(r1.status, r1.result)) return { status: r1.status, result: r1.result, url: startUrl };

  // Agency retry — GENERAL targets only. KYB (classify) and single-pass targets (facts, pinned
  // to one authoritative source) skip it: re-searching the open web can't beat their source.
  if (!target.classify && !target.singlePass && target.query && r1.status !== "blocked") {
    onProgress?.("retrying");
    if (searchResults.length === 0) searchResults = await searchUrls(base, session, target.query);
    const url2 = searchResults.find((u) => u !== startUrl);
    if (url2) {
      const augGoal =
        `${target.goal}\n\nA previous attempt did not find the answer. You are now on a page found by ` +
        `web-searching "${target.query}". Read it carefully for the answer; follow one relevant link if needed.`;
      const r2 = await attempt(base, session, url2, augGoal, target.extract, target);
      if (isResolved(r2.status, r2.result)) return { status: r2.status, result: r2.result, url: url2 };
      // Prefer the second pass only if it produced a real value the first didn't.
      if (!isEmptyAnswer(r2.result) && isEmptyAnswer(r1.result)) {
        return { status: r2.status, result: r2.result, url: url2 };
      }
    }
  }

  return { status: r1.status, result: r1.result, url: startUrl };
}
