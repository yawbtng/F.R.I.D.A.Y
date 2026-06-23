// Canonical Secretary-of-State adapter registry for the deployed swarm grid.
//
// The grid is client-driven: the browser spawns a fleet, then drives each cloud
// session directly (per-state Stagehand agent navigate + structured extract). So this
// logic lives in the web app — pure, no Node deps, client-importable. The agent/ package
// keeps its own copy (agent/src/fleet/states.ts + worker.ts) for the headless CLI runner;
// keep the two in sync, or collapse into a shared package once a third consumer appears.
//
// READ-ONLY lookups only (no write actions on government portals). Avoid pay-to-view
// portals like Delaware, which paywalls entity status.

export type WorkerStatus = "active" | "inactive" | "notfound" | "error";

export interface StateAdapter {
  /** 2-letter code, e.g. "CA". */
  state: string;
  /** Full state name, e.g. "California". */
  name: string;
  /** Entry URL the agent starts from. */
  searchUrl: string;
  /** Autonomous agent goal; "{entity}" is replaced with the company name at run time. */
  agentGoal: string;
}

// One shared goal: search the entity, open the best-matching record (tolerant of
// capitalization / punctuation / suffix differences), land on its detail page.
const GOAL =
  'Search for the business entity named "{entity}" on this Secretary of State site. The record often ' +
  'differs in capitalization, punctuation, or suffix (e.g. "TESLA, INC.", "TESLA INC", ' +
  '"Tesla Incorporated"), so from the results open the detail/record page of the entry that best ' +
  'matches "{entity}" even if it is not an exact string match — do not require an exact match. ' +
  "Your goal is to navigate to and open that entity's detail page, where its registration status is " +
  "shown. If no plausible match exists at all, stop on the results page.";

// One-word status read off the landed page. Kept separate from the agent's chatty prose
// so we don't false-match phrases like "active or inactive".
export const STATUS_EXTRACT =
  "Extract the registration or standing status of the business entity shown on this page. " +
  "Reply with EXACTLY one word and nothing else: active, inactive, or notfound. " +
  "Use 'inactive' for expired/dissolved/revoked/forfeited entities, and 'notfound' if the page " +
  "shows no entity record (e.g. it is still a search/results page with no match).";

// Status-public portals only. CA + FL are verified live; NY adapter built, verify before demo.
// Expansion target: 8-12 status-public states (add each here once verified in the grid).
export const STATE_ADAPTERS: Record<string, StateAdapter> = {
  CA: {
    state: "CA",
    name: "California",
    searchUrl: "https://bizfileonline.sos.ca.gov/search/business",
    agentGoal: GOAL,
  },
  FL: {
    state: "FL",
    name: "Florida",
    searchUrl: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByName",
    agentGoal: GOAL,
  },
  NY: {
    state: "NY",
    name: "New York",
    searchUrl: "https://apps.dos.ny.gov/publicInquiry/",
    agentGoal: GOAL,
  },
};

export const SUPPORTED_STATES = Object.keys(STATE_ADAPTERS);

/** Fill the entity name into an adapter's goal. */
export function goalFor(adapter: StateAdapter, entity: string): string {
  return adapter.agentGoal.replaceAll("{entity}", entity);
}

/** Normalize an extracted value into a status. Check 'inactive' before 'active'
 *  because the word "inactive" contains "active". */
export function mapStatus(data: unknown): WorkerStatus {
  const d = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const s = String(
    d.status ?? d.standing ?? d.extraction ?? d.message ?? (typeof data === "string" ? data : ""),
  ).toLowerCase();
  if (/inactive|expired|dissolved|revoked|forfeit|cancel|terminat|delinquent/.test(s)) {
    return "inactive";
  }
  if (/active|good standing|exists|current/.test(s)) {
    return "active";
  }
  return "notfound";
}
