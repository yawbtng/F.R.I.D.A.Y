// The live worker: drives ONE browser through a state's SoS portal and returns a
// WorkerResult. navigate -> act (search) -> extract (status), all via agentFetch on
// the per-worker AgentContext. A thrown agentFetch (timeout/HTTP error) propagates so
// the orchestrator records it as status 'error' (graceful partial-failure).

import { agentFetch } from "../lib/agent-fetch.js";
import type { AgentContext } from "../lib/agent-fetch.js";
import type { Worker, WorkerInput, WorkerResult, WorkerStatus } from "./types.js";
import type { StateAdapter } from "./states.js";

const ACTION_TIMEOUT_MS = 45_000; // SoS portals are slow; multi-step lookup.

/** Map whatever the LLM extracted into a normalized status. Check 'inactive' before
 *  'active' because "inactive" contains "active". */
export function mapStatus(data: unknown): { status: WorkerStatus; details?: Record<string, unknown> } {
  const d = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const s = String(d.status ?? d.standing ?? "").toLowerCase();
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

    await agentFetch({
      path: "/api/browser/navigate",
      body: { url: adapter.searchUrl },
      ctx,
      timeoutMs: ACTION_TIMEOUT_MS,
    });

    await agentFetch({
      path: "/api/browser/act",
      body: { instruction: adapter.searchInstruction.replaceAll("{entity}", input.entityName) },
      ctx,
      timeoutMs: ACTION_TIMEOUT_MS,
    });

    const ex = await agentFetch<{ data: unknown }>({
      path: "/api/browser/extract",
      body: { instruction: adapter.extractInstruction },
      ctx,
      timeoutMs: ACTION_TIMEOUT_MS,
    });

    const { status, details } = mapStatus(ex.data);
    return {
      state: input.state,
      status,
      details,
      raw: typeof ex.data === "string" ? ex.data : JSON.stringify(ex.data),
      ms: Date.now() - start,
    };
  };
}
