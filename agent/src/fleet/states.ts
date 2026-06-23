// Secretary-of-State business-entity adapters. Config-first with LLM fallback:
// each adapter is a real search URL + natural-language instructions, and the worker
// drives it through Stagehand's act/extract (the existing /api/browser/* routes).
// No brittle CSS selectors, so a portal tweak doesn't break the run.
//
// {entity} in searchInstruction is replaced with the company name at run time.
// extractInstruction MUST ask for a normalized `status` field (active/inactive/notfound).

export interface StateAdapter {
  state: string; // 2-letter code, e.g. "DE"
  name: string; // "Delaware"
  searchUrl: string;
  /** Atomic: type the entity name into the search field (no submit). */
  searchInstruction: string;
  /** Atomic: submit the search (click button / press Enter). */
  submitInstruction?: string;
  extractInstruction: string;
  /** Portal is known to use CAPTCHA / aggressive anti-bot — expect lower reliability. */
  antiBot?: boolean;
}

const EXTRACT =
  "Look at the business-entity search results and determine the registration status of the entity " +
  "that best matches the searched name. Reply with EXACTLY one word and nothing else: " +
  "'active', 'inactive', or 'notfound'. Use 'inactive' for expired/dissolved/revoked/forfeited/" +
  "terminated entities, and 'notfound' if no matching entity appears on the page.";

export const STATE_ADAPTERS: Record<string, StateAdapter> = {
  DE: {
    state: "DE",
    name: "Delaware",
    searchUrl: "https://icis.corp.delaware.gov/ecorp/entitysearch/NameSearch.aspx",
    searchInstruction: "Type \"{entity}\" into the entity name search field.",
    submitInstruction: "Click the Search button to run the search.",
    extractInstruction: EXTRACT,
  },
  CA: {
    state: "CA",
    name: "California",
    searchUrl: "https://bizfileonline.sos.ca.gov/search/business",
    searchInstruction: "Type \"{entity}\" into the business search box.",
    submitInstruction: "Press Enter to run the search, then wait for the results list to load.",
    extractInstruction: EXTRACT,
  },
  NY: {
    state: "NY",
    name: "New York",
    searchUrl: "https://apps.dos.ny.gov/publicInquiry/",
    searchInstruction: "Type \"{entity}\" into the entity name search field.",
    submitInstruction: "Click the search button to run the search.",
    extractInstruction: EXTRACT,
  },
};

export function getAdapter(state: string): StateAdapter | undefined {
  return STATE_ADAPTERS[state.toUpperCase()];
}

export const SUPPORTED_STATES = Object.keys(STATE_ADAPTERS);
