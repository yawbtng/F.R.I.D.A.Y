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

// Wall-clock budget for ONE attempt (agent call + extract call), split between the two below.
// /api/browser/agent and /api/browser/extract are SEPARATE function invocations, each with its
// own `maxDuration = 60` ceiling — so the attempt total is NOT capped at 60; only each individual
// call is. What 55s actually bounds is the attempt against the Browserbase session lifetime
// (300s, set in lib/browserbase.ts): the old 75s let an attempt outrun the then-~60s default
// session timeout, the session ended mid-run, the CDP socket dropped (1006), and the next
// Stagehand call crashed on a null page (`awaitActivePage`). With maxSteps capped low (below) a
// real lookup settles in ~25-35s, so 55s is generous headroom, not a guillotine.
const ATTEMPT_TIMEOUT_MS = 55_000;
// The budget is split, NOT shared: one signal across both fetches made 55s a wall clock, so an
// agent that returned at 51s having landed on exactly the right page handed the extract a ~4s
// signal, it aborted instantly, and the tile settled `error` ("operation was aborted due to
// timeout") one ~3s call short of the answer. So: carve a reserve out of the agent's share and
// give the extract whatever is left, never less than the floor.
//
// 12s reserve — a `stagehand.extract()` on a settled page is one LLM call over the DOM snapshot,
// ~2-4s measured; 12s covers a slow model without meaningfully shortening the agent (43s still
// clears the ~25-35s a real lookup takes).
const EXTRACT_RESERVE_MS = 12_000;
// 10s floor — if the agent overruns its share the extract still gets a usable window rather than
// a 0ms signal. Worst case the attempt overshoots ATTEMPT_TIMEOUT_MS by ~10s (65s), which is fine:
// the extract route has its own 60s ceiling and the session has 300s.
const EXTRACT_MIN_MS = 10_000;

/** Read a positive-integer env var, clamped to the range the consuming API schema accepts.
 *  Unguarded `Number(process.env.X)` turns a typo into NaN, which JSON.stringify emits as
 *  `null` — and a zod `.optional()` field REJECTS null (it is not undefined), so one bad env
 *  value failed EVERY target with a 400 VALIDATION_ERROR instead of one target. */
function envInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

// A business-registry lookup is "search a name, read the status" — a handful of steps, not 25.
// Fewer steps = the run finishes inside the session/route budget instead of grinding to a crash,
// and each avoided step is one fewer LLM call billed. Override via AGENT_MAX_STEPS if a portal
// genuinely needs more room — clamped to AgentSchema's `.int().min(1).max(50)` so an out-of-range
// override (AGENT_MAX_STEPS=60) is pinned to 50 instead of 400-ing the whole swarm.
const AGENT_MAX_STEPS = envInt(process.env.AGENT_MAX_STEPS, 8, 1, 50);

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
  // Per-attempt deadline, split across the two calls (see EXTRACT_RESERVE_MS): the agent may
  // spend everything up to the reserve, the extract gets the remainder. A fast agent therefore
  // leaves the extract a large budget; a slow one still leaves it EXTRACT_MIN_MS.
  const deadline = Date.now() + (target.timeoutMs ?? ATTEMPT_TIMEOUT_MS);
  const agentSignal = AbortSignal.timeout(
    Math.max(EXTRACT_MIN_MS, deadline - Date.now() - EXTRACT_RESERVE_MS),
  );

  const agentRes = await fetch(`${base}/api/browser/agent`, {
    method: "POST",
    headers,
    signal: agentSignal,
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

  // Whatever is left of the attempt budget, floored — the agent has already returned, so this
  // is measured AFTER its cost is known, not carved out up front.
  const exRes = await fetch(`${base}/api/browser/extract`, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(Math.max(EXTRACT_MIN_MS, deadline - Date.now())),
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
