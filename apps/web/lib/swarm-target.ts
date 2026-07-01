// A "target" is one unit of swarm work: one browser, one page, one question. It replaces
// the state-specific StateAdapter so the grid can fan out over anything an LLM plans, not
// just Secretary-of-State portals. The KYB demo is now just one way to BUILD targets
// (buildKybTargets), reusing the exact proven registry + goal + mapStatus. The general
// path builds targets from /api/swarm/plan. Both feed the same runTarget in use-swarm.

import {
  type WorkerStatus,
  STATE_ADAPTERS,
  STATUS_EXTRACT,
  goalFor,
  mapStatus,
  isBlocked,
} from "./sos-adapters";
import type { PlanTarget } from "./schemas";

export interface SwarmTarget {
  /** Stable tile key (state code, or a label slug / index for general tasks). */
  id: string;
  /** Tile display name ("CA", "Acme Corp", "BestBuy — iPhone 16 Pro"). */
  label: string;
  /** Direct entry URL when known. Takes priority over `query`. */
  startUrl?: string;
  /** Exa search query used to discover a startUrl when none is known. */
  query?: string;
  /** Per-target autonomous agent instruction (what to do on the page). */
  goal: string;
  /** Per-target extraction instruction (the one concise question to read off the page). */
  extract: string;
  /** Execution engine. Default "stagehand"; "bb-agent" escalates to a Browserbase Agent run. */
  engine?: "stagehand" | "bb-agent";
  /** KYB-only classifier (mapStatus). Absent → generic done/blocked/error classification. */
  classify?: (data: unknown) => WorkerStatus;
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "target";

/** Map planner output (PlanTarget[]) into runnable SwarmTargets, assigning stable ids.
 *  Used by both the /swarm review UI and the verify-plan harness. */
export function planToTargets(planTargets: PlanTarget[]): SwarmTarget[] {
  return planTargets.map((pt, i) => ({
    id: `t${i}-${slug(pt.label)}`,
    label: pt.label,
    // strict-mode schema returns null (not undefined) for absent optional fields.
    startUrl: pt.startUrl ?? undefined,
    query: pt.query ?? undefined,
    goal: pt.goal,
    extract: pt.extract,
    engine: pt.engine ?? undefined,
  }));
}

/** KYB preset: the proven path, no LLM. Builds one target per state from the curated
 *  registry, reusing the tuned goal + STATUS_EXTRACT + mapStatus so the demo is identical. */
export function buildKybTargets(entity: string, states: string[]): SwarmTarget[] {
  return states
    .filter((s) => STATE_ADAPTERS[s])
    .map((s) => ({
      id: s,
      label: s,
      startUrl: STATE_ADAPTERS[s].searchUrl,
      goal: goalFor(STATE_ADAPTERS[s], entity),
      extract: STATUS_EXTRACT,
      classify: mapStatus,
    }));
}

/** Coerce stagehand.extract output (string or object) into a short display string. Mirrors
 *  the field-picking in mapStatus so an answer surfaces regardless of the extract's shape.
 *  An explicit null on the primary answer field means "no answer" -> empty string (so a tile
 *  never shows the literal "null" the agent returned when it couldn't find the value). */
export function toResultText(data: unknown): string {
  if (data == null) return "";
  if (typeof data === "string") return data.trim();
  if (typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of ["answer", "result", "value", "status", "standing", "message", "extraction"]) {
      if (k in d) {
        const v = d[k];
        if (v === null) return ""; // agent explicitly reported no value
        if (v !== undefined && typeof v !== "object") return String(v).trim();
      }
    }
    try {
      return JSON.stringify(data);
    } catch {
      return String(data);
    }
  }
  return String(data);
}

/** True when an extracted answer is effectively empty: blank, or a null/none/unknown token
 *  the agent returns when it couldn't find the value. Such a tile should read "not found",
 *  not "done", and is a candidate for the agency retry. */
export function isEmptyAnswer(s: string): boolean {
  return (
    !s.trim() ||
    /^(null|none|n\/?a|unknown|undefined|not\s?found|no\s+(result|answer|data|record|match)s?)$/i.test(
      s.trim(),
    )
  );
}

/** Generic (non-KYB) classification: the extracted value IS the answer. A target is "done"
 *  if we read a real value and weren't blocked; "blocked" if the page fought us; "notfound"
 *  if nothing usable came back. Errors/timeouts are handled by the caller (runTarget). */
export function classifyGeneric(data: unknown): { status: WorkerStatus; result: string } {
  const result = toResultText(data);
  if (isEmptyAnswer(result)) return { status: "notfound", result: "" };
  return { status: isBlocked(result) ? "blocked" : "done", result };
}
