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
  searchInstruction: string;
  extractInstruction: string;
  /** Portal is known to use CAPTCHA / aggressive anti-bot — expect lower reliability. */
  antiBot?: boolean;
}

const EXTRACT =
  "From the business-entity search results, find the entity that best matches the searched name. " +
  "Return JSON: { entityName, status, entityType, details }. " +
  "`status` MUST be exactly one of 'active', 'inactive', or 'notfound' — use 'inactive' for " +
  "expired/dissolved/revoked/forfeited/terminated entities, and 'notfound' if no entity matches.";

export const STATE_ADAPTERS: Record<string, StateAdapter> = {
  DE: {
    state: "DE",
    name: "Delaware",
    searchUrl: "https://icis.corp.delaware.gov/ecorp/entitysearch/NameSearch.aspx",
    searchInstruction:
      "Type \"{entity}\" into the entity name search field and click the Search button.",
    extractInstruction: EXTRACT,
  },
  CA: {
    state: "CA",
    name: "California",
    searchUrl: "https://bizfileonline.sos.ca.gov/search/business",
    searchInstruction:
      "Type \"{entity}\" into the search box and start the search, then open the first matching result.",
    extractInstruction: EXTRACT,
  },
  NY: {
    state: "NY",
    name: "New York",
    searchUrl: "https://apps.dos.ny.gov/publicInquiry/",
    searchInstruction:
      "Choose to search by entity name, type \"{entity}\" into the name field, and submit the search.",
    extractInstruction: EXTRACT,
  },
};

export function getAdapter(state: string): StateAdapter | undefined {
  return STATE_ADAPTERS[state.toUpperCase()];
}

export const SUPPORTED_STATES = Object.keys(STATE_ADAPTERS);
