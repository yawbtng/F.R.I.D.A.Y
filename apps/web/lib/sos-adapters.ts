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
  'You are on a U.S. state Secretary of State business-entity search site. Goal: find the ' +
  'registration status of the business entity named "{entity}". ' +
  '(1) If a terms-of-use, disclaimer, or "I accept / I agree" gate appears first, accept it to continue. ' +
  '(2) Locate the business/entity NAME search field, type "{entity}", and submit the search. ' +
  '(3) Wait for the results to finish loading. The matching record often differs in capitalization, ' +
  'punctuation, or suffix (e.g. "APPLE INC.", "Apple Inc", "Apple Incorporated"), so choose the result ' +
  'that best matches "{entity}" even if it is not an exact string match; prefer an active corporation ' +
  'or LLC over reserved names, trade names, or unrelated look-alikes. ' +
  "(4) Open that result's detail/record page, where the registration status is displayed. " +
  'Do NOT stop on the results list if a plausible match exists — open it. Only stop if a CAPTCHA or ' +
  'login blocks access, or if no plausible match exists at all.';

// One-word status read off the landed page. Kept separate from the agent's chatty prose
// so we don't false-match phrases like "active or inactive".
export const STATUS_EXTRACT =
  "Extract the registration or standing status of the business entity shown on this page. " +
  "Reply with EXACTLY one word and nothing else: active, inactive, or notfound. " +
  "Use 'inactive' for expired/dissolved/revoked/forfeited entities, and 'notfound' if the page " +
  "shows no entity record (e.g. it is still a search/results page with no match).";

// Status-public, free portals only (status shown on the public record, no login/payment).
// Curated from research + live verification; pay-to-view (DE, NJ), status-not-free (TX),
// CAPTCHA (AZ), and mid-migration (NV) portals are deliberately excluded. Each URL must be
// confirmed live (apps/web/scripts/verify-states.ts) before it's trusted on camera.
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
  CO: {
    state: "CO",
    name: "Colorado",
    searchUrl: "https://www.sos.state.co.us/biz/BusinessEntityCriteriaExt.do",
    agentGoal: GOAL,
  },
  GA: {
    state: "GA",
    name: "Georgia",
    searchUrl: "https://ecorp.sos.ga.gov/BusinessSearch",
    agentGoal: GOAL,
  },
  IL: {
    state: "IL",
    name: "Illinois",
    searchUrl: "https://apps.ilsos.gov/businessentitysearch/",
    agentGoal: GOAL,
  },
  MI: {
    state: "MI",
    name: "Michigan",
    searchUrl: "https://mibusinessregistry.lara.state.mi.us/search/business",
    agentGoal: GOAL,
  },
  NC: {
    state: "NC",
    name: "North Carolina",
    searchUrl: "https://www.sosnc.gov/online_services/search/by_title/_Business_Registration",
    agentGoal: GOAL,
  },
  OH: {
    state: "OH",
    name: "Ohio",
    searchUrl: "https://businesssearch.ohiosos.gov/",
    agentGoal: GOAL,
  },
  PA: {
    state: "PA",
    name: "Pennsylvania",
    searchUrl: "https://file.dos.pa.gov/search/business",
    agentGoal: GOAL,
  },
  VA: {
    state: "VA",
    name: "Virginia",
    searchUrl: "https://cis.scc.virginia.gov/EntitySearch/Index",
    agentGoal: GOAL,
  },
  WA: {
    state: "WA",
    name: "Washington",
    searchUrl: "https://ccfs.sos.wa.gov/",
    agentGoal: GOAL,
  },
  CT: {
    state: "CT",
    name: "Connecticut",
    searchUrl: "https://service.ct.gov/business/s/onlinebusinesssearch",
    agentGoal: GOAL,
  },
  MA: {
    state: "MA",
    name: "Massachusetts",
    searchUrl: "https://corp.sec.state.ma.us/corpweb/CorpSearch/CorpSearch.aspx",
    agentGoal: GOAL,
  },
  MN: {
    state: "MN",
    name: "Minnesota",
    searchUrl: "https://mblsportal.sos.mn.gov/Business/Search",
    agentGoal: GOAL,
  },
  OR: {
    state: "OR",
    name: "Oregon",
    searchUrl: "https://sos.oregon.gov/business/Pages/find.aspx",
    agentGoal: GOAL,
  },
  TN: {
    state: "TN",
    name: "Tennessee",
    searchUrl: "https://tncab.tnsos.gov/business-entity-search",
    agentGoal: GOAL,
  },
  UT: {
    state: "UT",
    name: "Utah",
    searchUrl: "https://businessregistration.utah.gov/",
    agentGoal: GOAL,
  },
  NV: {
    state: "NV",
    name: "Nevada",
    searchUrl: "https://esos.nv.gov/EntitySearch/BusinessInformation",
    agentGoal: GOAL,
  },
  AZ: {
    state: "AZ",
    name: "Arizona",
    searchUrl: "https://ecorp.azcc.gov/EntitySearch/Index",
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
