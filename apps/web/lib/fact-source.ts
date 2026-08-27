// Wikipedia is to general FACT lookups what SEC EDGAR is to KYB: a fast, server-rendered,
// bot-friendly source with structured data (the infobox) covering a huge domain — companies,
// people, places, products, films. The open web fails the general path because the planner
// sends the agent to slow SPAs or search-result chains that blow the 55s timeout (~2/3 hit
// rate, 45-99s runs). Routing entity/place/person/product fact-lookups here instead resolves
// fast and reliably (live probe: Tokyo/Lagos populations, Airbnb founding year, Stripe's CEO
// all correct in ~25s, where the open-web path timed out on half of them).
//
// Direct article URL (spaces -> underscores). This lands ON the article for the vast majority of
// subjects and is FAST — live probe hit 4/4 in ~25s this way, whereas Special:Search added a
// heavier redirect/results page and dropped to 1/3 with 50s+ runs. The rare miss is a common-word
// subject whose bare title is a disambiguation page (e.g. "Stripe", "Apple"); the goal below tells
// the agent to click the right entry, and the query fallback re-searches if the article 404s.
export const wikiArticleUrl = (topic: string): string =>
  `https://en.wikipedia.org/wiki/${encodeURIComponent(topic.trim().replace(/\s+/g, "_"))}`;

export const factGoal = (topic: string): string =>
  `You are on Wikipedia to answer a factual question about "${topic}" (the question is in the ` +
  `extraction step). FIRST decide what kind of page you are on:\n` +
  `• A normal ARTICLE (has an infobox on the right / a lead paragraph about "${topic}") — the answer ` +
  `is already here. Do NOT click anything; let the extraction read it.\n` +
  `• A DISAMBIGUATION page (titled "${topic} may refer to:" with a bulleted list of different things) ` +
  `or a search-results page — then CLICK the single link that best matches what the question is about ` +
  `(for a founding year / CEO / headquarters question, that's the company or organization named ` +
  `"${topic}"; for a population question, the city/place). Land on that article, then stop.\n` +
  `Never navigate away once you can see the requested value.`;

// Enough to confirm load + click through ONE disambiguation page ("Stripe", "Notion", "Apple"
// resolve to a bare-word disambig page that needs a click), few enough to not wander off a huge
// article. Unambiguous subjects settle in 1-2 steps; ambiguous ones use the extra budget.
export const FACT_MAX_STEPS = 5;

// Big Wikipedia articles occasionally take ~55s to load + settle + extract under parallel load,
// kissing the default 55s cap. Facts are SINGLE-PASS (no retry), so nudging the budget just under
// the route's 60s maxDuration catches those near-miss outliers while staying prod-safe. (A true
// infra hang exceeds any sane budget and errors cleanly — that's honest, not tunable.)
export const FACT_TIMEOUT_MS = 58_000;

/** Wrap the planner's per-target question with a crisp output instruction so extraction returns a
 *  clean value (or nothing) — a verbose/unbounded extract was making attempt 1 come back empty,
 *  which then triggered the slow search-retry. Mirrors the proven probe extract. */
export const factExtract = (question: string): string =>
  `${question.trim()} Reply with just the value, as concisely as possible. If it is not on the page, reply with nothing.`;
