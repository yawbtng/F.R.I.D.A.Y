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
// heavier redirect/results page and dropped to 1/3 with 50s+ runs.
//
// A miss has to be recovered INSIDE the one attempt. There is no fallback: fact targets set
// `singlePass`, which is exactly the flag runTarget checks to skip the search-augmented retry,
// and `startUrl` is always set here so the pre-attempt search path never fires either. (The
// `query` planToTargets attaches is display/edit state for the plan-review UI, not a retry.)
// Two misses are real, so the goal below teaches the agent to recognize and escape BOTH within
// FACT_MAX_STEPS:
//   1. A common-word subject whose bare title is a disambiguation page ("Stripe", "Apple").
//   2. A label that is not a subject at all. The planner's "put the subject in the label"
//      instruction is soft, so it routinely emits "Airbnb founding year" -> /wiki/Airbnb_founding_year
//      -> Wikipedia's "does not have an article with this exact name" page. Left unhandled that
//      burns the whole step budget and settles `notfound` with no recovery. (The durable fix is
//      upstream — a dedicated subject field on PlanTarget so the article title never has to be
//      inferred from display text; the goal branch is the in-attempt safety net until then.)
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
  `• A NO-ARTICLE page (it says Wikipedia "does not have an article with this exact name", or shows ` +
  `a red create-this-page link) — the title was built from a phrase, not a subject. Do NOT give up: ` +
  `type the SUBJECT of the question into Wikipedia's search box (for "${topic}", that is the entity ` +
  `the question is about, without the question words), search, and open the best-matching article.\n` +
  `Never navigate away once you can see the requested value.`;

// Enough to confirm load + click through ONE disambiguation page ("Stripe", "Notion", "Apple"
// resolve to a bare-word disambig page that needs a click), few enough to not wander off a huge
// article. Unambiguous subjects settle in 1-2 steps; ambiguous ones use the extra budget.
export const FACT_MAX_STEPS = 5;

// Per-attempt wall clock for a fact lookup, overriding runTarget's default 55s. It bounds the
// WHOLE attempt — the /api/browser/agent call plus the /api/browser/extract call — and what it is
// measured against is the 300s Browserbase session lifetime (lib/browserbase.ts), NOT any route's
// 60s ceiling: those two routes are separate function invocations that each get their own
// `maxDuration = 60`, so an attempt was never capped at 60 in the first place.
//
// 58s over 55s buys the 3s that big Wikipedia articles occasionally need to load + settle +
// extract under parallel load. Facts are SINGLE-PASS (no retry), so this one attempt is all they
// get — hence the nudge rather than a trim. runTarget SPLITS this budget rather than sharing it
// (agent share = 58s minus the extract reserve, extract gets the remainder with a floor), which
// does not change the number: the ~55s observation was load + settle + extract, i.e. the whole
// attempt, and the split only guarantees the extract is not squeezed to nothing by a slow agent.
// (A true infra hang exceeds any sane budget and errors cleanly — that's honest, not tunable.)
export const FACT_TIMEOUT_MS = 58_000;

/** Wrap the planner's per-target question with a crisp output instruction so extraction returns a
 *  clean value (or nothing) — a verbose/unbounded extract was making attempt 1 come back empty,
 *  which then triggered the slow search-retry. Mirrors the proven probe extract. */
export const factExtract = (question: string): string =>
  `${question.trim()} Reply with just the value, as concisely as possible. If it is not on the page, reply with nothing.`;
