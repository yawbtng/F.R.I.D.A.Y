// The live worker for one browser / one state. Two phases:
//   1) Stagehand AGENT navigates the portal — search + open the best-matching record
//      (robust to ASP.NET / SPA / terms gates / name-format differences).
//   2) Structured EXTRACT reads the status off the landed page as one clean word.
// Splitting them avoids parsing the agent's chatty prose (which false-matches phrases
// like "active or inactive"). A thrown agentFetch propagates → orchestrator marks 'error'.

import { agentFetch } from "../lib/agent-fetch.js";
import type { AgentContext } from "../lib/agent-fetch.js";
import type { Worker, WorkerInput, WorkerResult, WorkerStatus } from "./types.js";
import type { StateAdapter } from "./states.js";

const AGENT_TIMEOUT_MS = 120_000; // an autonomous multi-step agent run is slow.
const EXTRACT_TIMEOUT_MS = 45_000;
const MAX_STEPS = 14;

const STATUS_EXTRACT =
  "Extract the registration or standing status of the business entity shown on this page. " +
  "Reply with EXACTLY one word and nothing else: active, inactive, or notfound. " +
  "Use 'inactive' for expired/dissolved/revoked/forfeited entities, and 'notfound' if the page " +
  "shows no entity record (e.g. it is still a search/results page with no match).";

/** Normalize an extracted value into a status. Check 'inactive' before 'active'
 *  because "inactive" contains "active". */
export function mapStatus(data: unknown): { status: WorkerStatus; details?: Record<string, unknown> } {
  const d = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const s = String(
    d.status ?? d.standing ?? d.extraction ?? d.message ?? (typeof data === "string" ? data : ""),
  ).toLowerCase();
  if (/inactive|expired|dissolved|revoked|forfeit|cancel|terminat|delinquent/.test(s)) {
    return { status: "inactive", details: d };
  }
  if (/active|good standing|exists|current/.test(s)) {
    return { status: "active", details: d };
  }
  return { status: "notfound", details: d };
}

export function makeStateWorker(adapters: Record<string, StateAdapter>): Worker {
  return async (input: WorkerInput, ctx: AgentContext): Promise<WorkerResult> => {
    const start = Date.now();
    const adapter = adapters[input.state.toUpperCase()];
    if (!adapter) {
      return {
        state: input.state,
        status: "notfound",
        raw: `No adapter for state ${input.state}`,
        ms: Date.now() - start,
      };
    }

    // 1) Agent navigates + searches + opens the best-matching record page.
    const ag = await agentFetch<{ data: { message?: string } }>({
      path: "/api/browser/agent",
      body: {
        startUrl: adapter.searchUrl,
        instruction: adapter.agentGoal.replaceAll("{entity}", input.entityName),
        maxSteps: MAX_STEPS,
      },
      ctx,
      timeoutMs: AGENT_TIMEOUT_MS,
    });

    // 2) Structured read of the status from the page the agent landed on.
    const ex = await agentFetch<{ data: unknown }>({
      path: "/api/browser/extract",
      body: { instruction: STATUS_EXTRACT },
      ctx,
      timeoutMs: EXTRACT_TIMEOUT_MS,
    });

    const { status } = mapStatus(ex.data);
    const exStr = typeof ex.data === "string" ? ex.data : JSON.stringify(ex.data);
    return {
      state: input.state,
      status,
      raw: `agent: ${(ag.data?.message ?? "").slice(0, 120)} | extract: ${exStr}`,
      ms: Date.now() - start,
    };
  };
}
