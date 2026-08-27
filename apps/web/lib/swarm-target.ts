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
  edgarSearchUrl,
  edgarGoal,
  EDGAR_EXTRACT,
} from "./sos-adapters";
import { wikiArticleUrl, factGoal, factExtract, FACT_MAX_STEPS, FACT_TIMEOUT_MS } from "./fact-source";
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
  /** Per-target agent step budget. Absent → the global AGENT_MAX_STEPS. KYB/EDGAR targets set
   *  this low (the answer is on the landing page; extra steps only let the agent wander off it). */
  maxSteps?: number;
  /** Per-target attempt timeout (ms). Absent → the global ATTEMPT_TIMEOUT_MS. Fact lookups bump
   *  this to catch slow-page outliers (a huge Wikipedia article can take ~55s to settle). */
  timeoutMs?: number;
  /** Skip the search-augmented retry: re-searching the open web can't beat a target already
   *  pinned to ONE authoritative source, so the retry only wastes time. Set on fact targets
   *  (pinned to Wikipedia). KYB targets get the same skip implicitly — runTarget also bails
   *  out of the retry whenever `classify` is present, which covers BOTH KYB producers
   *  (planToTargets and buildKybTargets), so they don't need to set this too. */
  singlePass?: boolean;
  /** KYB-only classifier (mapStatus). Absent → generic done/blocked/error classification. */
  classify?: (data: unknown) => WorkerStatus;
}

/** EDGAR answers on the landing page — a tight step budget keeps the agent from navigating
 *  away before the extract reads it (the cause of slow, wrong `notfound`s). */
const KYB_MAX_STEPS = 4;

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "target";

/** ONE trailing legal-entity suffix, in every shape a planner actually emits: bare ("Inc"),
 *  dotted ("Inc."), comma'd (", Inc."), and the dotted initialisms ("L.P.", "L.L.C.", "L.L.P.",
 *  "P.L.C.") — the old alternation handled `l.l.c` but not `l.p`, so "Brookfield Renewable
 *  Partners L.P." reached EDGAR with its suffix intact. Anchored to the END and required to
 *  follow whitespace, which is what keeps the guards intact: "Incyte" keeps its "Inc",
 *  "Sony Corporation of America" keeps its non-trailing "Corporation", and "Ltd Commodities" /
 *  "LP Building Solutions" keep their LEADING suffix words. */
const LEGAL_SUFFIX =
  /[,.\s]*\s(incorporated|inc|corporation|corp|company|co|l\.?l\.?c|llc|l\.?l\.?p|llp|l\.?p|limited|ltd|p\.?l\.?c|plc)\.?$/i;

/** The company name to verify. Planner labels vary ("Tesla", "Tesla — SoS", "Tesla, Inc.",
 *  "NVIDIA Corporation"): drop any " — portal" suffix, then EVERY trailing legal suffix, so
 *  EDGAR gets a clean, consistent query (a bare name matches EDGAR's search far more reliably
 *  than a full legal name with commas). */
const entityOf = (label: string): string => {
  const base = label.split(/\s[—–-]\s/)[0].trim() || label.trim();
  // Leading "The" breaks EDGAR's prefix match ("The Home Depot" -> no results, "Home Depot" -> found).
  let cleaned = base.replace(/^the\s+/i, "").trim();
  // LOOP, because one `.replace()` strips ONE suffix and doubled suffixes are common in the
  // legal names LLMs emit: "Church & Dwight Co., Inc." used to reduce to "Church & Dwight Co.",
  // which EDGAR answers with "No matching companies". That lands as `notfound` and STAYS there —
  // runTarget skips the agency retry for any target carrying `classify` (see `singlePass` above),
  // so the report would tell a viewer an S&P 500 company has no registration record, confidently
  // and wrongly, on the flagship KYB demo.
  for (;;) {
    // Trailing punctuation and ampersands go with it: stripping "Company" off "Deere & Company"
    // otherwise reaches EDGAR as "Deere &", which only matched by luck.
    const next = cleaned.replace(LEGAL_SUFFIX, "").replace(/[,&.\s]+$/, "").trim();
    // Stop at a fixed point — and never let the strip eat the name whole: a company literally
    // named "Company" must stay "Company", not become "" (the `|| base` below is the last net).
    if (!next || next === cleaned) break;
    cleaned = next;
  }
  return cleaned || base;
};

/** Map planner output (PlanTarget[]) into runnable SwarmTargets, assigning stable ids.
 *  Used by both the /swarm review UI and the verify-plan harness.
 *
 *  KYB override: a target the planner tagged `kind:"kyb"` is a company-registration check. We
 *  do NOT trust the LLM's portal choice for these (it picks paywalled DE / slow SPAs / CAPTCHA
 *  sites) — instead every KYB target is routed deterministically to SEC EDGAR with the tuned
 *  goal + extract + the mapStatus classifier, which resolves fast and reliably (see sos-adapters). */
export function planToTargets(planTargets: PlanTarget[]): SwarmTarget[] {
  return planTargets.map((pt, i) => {
    const base = {
      id: `t${i}-${slug(pt.label)}`,
      label: pt.label,
      engine: pt.engine ?? undefined,
    };
    if (pt.kind === "kyb") {
      const entity = entityOf(pt.label);
      return {
        ...base,
        startUrl: edgarSearchUrl(entity),
        // NOT a retry fallback — runTarget skips the retry whenever `classify` is set (see the
        // `singlePass` doc above). It earns its place in the UI: PlanReview renders and edits
        // `query` per target, and it becomes the live routing hint the moment a reviewer clears
        // the startUrl field — EDGAR-scoped, so even that path stays off the open web.
        query: `${entity} SEC EDGAR company filings`,
        goal: edgarGoal(entity),
        extract: EDGAR_EXTRACT,
        maxSteps: KYB_MAX_STEPS,
        classify: mapStatus,
      };
    }
    if (pt.kind === "fact") {
      // Route to Wikipedia but KEEP the planner's own extract question (that's the per-target
      // ask — "founding year?", "population?", "CEO?"); only the source + goal are overridden.
      const topic = pt.label.split(/\s[—–-]\s/)[0].trim() || pt.label.trim();
      return {
        ...base,
        startUrl: wikiArticleUrl(topic),
        query: `${topic} Wikipedia`,
        goal: factGoal(topic),
        extract: factExtract(pt.extract),
        maxSteps: FACT_MAX_STEPS,
        timeoutMs: FACT_TIMEOUT_MS,
        singlePass: true, // Wikipedia is the source; re-searching the open web won't beat it
      };
    }
    return {
      ...base,
      // strict-mode schema returns null (not undefined) for absent optional fields.
      startUrl: pt.startUrl ?? undefined,
      query: pt.query ?? undefined,
      goal: pt.goal,
      extract: pt.extract,
    };
  });
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
