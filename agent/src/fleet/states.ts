// Secretary-of-State business-entity adapters. Each worker runs Stagehand's autonomous
// agent against the portal — agent mode handles each site's quirks (terms gates, SPA
// result panels, ASP.NET postbacks) that a fixed act sequence can't. So an adapter is
// just the entry URL + a goal; {entity} is replaced with the company name at run time.

export interface StateAdapter {
  state: string; // 2-letter code, e.g. "DE"
  name: string; // "Delaware"
  searchUrl: string;
  /** Autonomous agent goal; ends by asking for a one-word status. */
  agentGoal: string;
  /** Portal is known to use CAPTCHA / aggressive anti-bot — expect lower reliability. */
  antiBot?: boolean;
}

const GOAL =
  'Search for the business entity named "{entity}" on this Secretary of State site. The record often ' +
  'differs in capitalization, punctuation, or suffix (e.g. "TESLA, INC.", "TESLA INC", ' +
  '"Tesla Incorporated"), so from the results open the detail/record page of the entry that best ' +
  'matches "{entity}" even if it is not an exact string match — do not require an exact match. ' +
  "Your goal is to navigate to and open that entity's detail page, where its registration status is " +
  "shown. If no plausible match exists at all, stop on the results page.";

export const STATE_ADAPTERS: Record<string, StateAdapter> = {
  DE: {
    state: "DE",
    name: "Delaware",
    searchUrl: "https://icis.corp.delaware.gov/ecorp/entitysearch/NameSearch.aspx",
    agentGoal: GOAL,
  },
  CA: {
    state: "CA",
    name: "California",
    searchUrl: "https://bizfileonline.sos.ca.gov/search/business",
    agentGoal: GOAL,
  },
  NY: {
    state: "NY",
    name: "New York",
    searchUrl: "https://apps.dos.ny.gov/publicInquiry/",
    agentGoal: GOAL,
  },
  FL: {
    state: "FL",
    name: "Florida",
    searchUrl: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByName",
    agentGoal: GOAL,
  },
};

// NOTE: Delaware (DE) is kept for completeness but does NOT publish entity status for
// free — its public name search paywalls the status report. Prefer status-public portals
// (FL/CA/NY/...) for the demo.

export function getAdapter(state: string): StateAdapter | undefined {
  return STATE_ADAPTERS[state.toUpperCase()];
}

export const SUPPORTED_STATES = Object.keys(STATE_ADAPTERS);
