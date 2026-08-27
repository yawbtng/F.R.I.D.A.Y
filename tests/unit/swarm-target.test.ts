import { describe, it, expect } from "vitest";
import { planToTargets, type SwarmTarget } from "../../apps/web/lib/swarm-target";
import { mapStatus, edgarGoal, EDGAR_EXTRACT } from "../../apps/web/lib/sos-adapters";
import { FACT_MAX_STEPS, FACT_TIMEOUT_MS, factGoal } from "../../apps/web/lib/fact-source";
import type { PlanTarget } from "../../apps/web/lib/schemas";

// PlanTarget fields are nullable-not-optional (strict-mode structured output), so build one
// from a partial instead of hand-writing the nulls in every case.
const pt = (o: Partial<PlanTarget> & { label: string }): PlanTarget => ({
  label: o.label,
  subject: o.subject ?? null,
  startUrl: o.startUrl ?? null,
  query: o.query ?? null,
  goal: o.goal ?? "planner goal",
  extract: o.extract ?? "planner extract",
  engine: o.engine ?? null,
  kind: o.kind ?? null,
});

const one = (o: Partial<PlanTarget> & { label: string }): SwarmTarget => planToTargets([pt(o)])[0];

/** `entityOf` is module-private, so read what it produced off the EDGAR query string — the
 *  same place EDGAR itself reads it. Asserting on the URL, not internals, keeps the test
 *  honest about what actually reaches the wire. */
const edgarCompany = (t: SwarmTarget): string =>
  new URL(t.startUrl as string).searchParams.get("company") ?? "";

describe("planToTargets — KYB routing", () => {
  it("overrides the planner's portal with SEC EDGAR", () => {
    // The planner reliably picks fragile portals (paywalled DE, CAPTCHA'd AZ). The whole
    // point of kind:"kyb" is that its URL choice is discarded.
    const t = one({
      label: "Tesla",
      kind: "kyb",
      startUrl: "https://icis.corp.delaware.gov/ecorp/entitysearch",
    });
    expect(t.startUrl).not.toContain("delaware.gov");
    expect(t.startUrl).toContain("sec.gov/cgi-bin/browse-edgar");
    expect(edgarCompany(t)).toBe("Tesla");
  });

  it("uses the tuned EDGAR goal + extract, not the planner's", () => {
    const t = one({ label: "Tesla", kind: "kyb", goal: "poke around", extract: "anything?" });
    expect(t.goal).toBe(edgarGoal("Tesla"));
    expect(t.extract).toBe(EDGAR_EXTRACT);
    expect(t.goal).not.toContain("poke around");
  });

  it("attaches the mapStatus classifier (active/inactive/notfound, not free text)", () => {
    expect(one({ label: "Tesla", kind: "kyb" }).classify).toBe(mapStatus);
  });

  it("rewrites the planner's query to an EDGAR-scoped one (the review UI's editable hint)", () => {
    // NOT a retry fallback — runTarget skips the retry for any target carrying `classify`.
    // `query` is what PlanReview renders and lets a reviewer edit, and it becomes the live
    // routing hint if they clear the startUrl, so it has to stay on EDGAR and on the CLEANED
    // entity rather than keeping whatever the planner guessed.
    const t = one({ label: "Walmart Inc", kind: "kyb", query: "walmart business license" });
    expect(t.query).toContain("Walmart");
    expect(t.query).toContain("EDGAR");
    expect(t.query).not.toContain("business license");
  });

  it("caps the step budget so the agent can't navigate off the answer page", () => {
    // EDGAR answers on the landing page; extra steps only produce slow, wrong `notfound`s.
    const t = one({ label: "Tesla", kind: "kyb" });
    expect(t.maxSteps).toBeDefined();
    expect(t.maxSteps as number).toBeGreaterThan(0);
    expect(t.maxSteps as number).toBeLessThanOrEqual(FACT_MAX_STEPS);
  });

  it("preserves the planner's engine choice", () => {
    expect(one({ label: "Tesla", kind: "kyb", engine: "bb-agent" }).engine).toBe("bb-agent");
    expect(one({ label: "Tesla", kind: "kyb" }).engine).toBeUndefined();
  });

  it("routes off `subject`, not the display label", () => {
    // The whole point of the field: label is free to be a human-readable phrase, and EDGAR must
    // still receive the bare company name rather than whatever the tile happens to say.
    const t = one({ label: "Tesla — is it a registered business?", subject: "Tesla", kind: "kyb" });
    expect(edgarCompany(t)).toBe("Tesla");
    expect(t.goal).toBe(edgarGoal("Tesla"));
  });

  it("still runs entityOf on the subject (planners emit legal names there too)", () => {
    // "Put the plain company name in subject" is a soft instruction like every other one, so the
    // suffix strip has to guard the subject path, not just the label fallback.
    expect(edgarCompany(one({ label: "Walmart", subject: "Walmart Inc", kind: "kyb" }))).toBe(
      "Walmart",
    );
    expect(
      edgarCompany(one({ label: "Kroger", subject: "The Kroger Co., Inc.", kind: "kyb" })),
    ).toBe("Kroger");
  });

  it("falls back to label-derivation when subject is null or blank", () => {
    // An LLM will omit the field. That must degrade to the pre-subject behavior — never to an
    // empty `company=` param, which is a confident, wrong `notfound` on the flagship demo.
    expect(edgarCompany(one({ label: "The Home Depot, Inc.", subject: null, kind: "kyb" }))).toBe(
      "Home Depot",
    );
    // Strict mode makes `subject` required, so a model with nothing to say emits "" as readily
    // as null; blank has to take the same fallback.
    expect(edgarCompany(one({ label: "Tesla — SoS", subject: "   ", kind: "kyb" }))).toBe("Tesla");
  });

  it("leaves the label untouched no matter which key routed it", () => {
    // `subject` is routing state only; the tile keeps rendering what the planner wrote for humans.
    expect(one({ label: "Tesla, Inc. — registration", subject: "Tesla", kind: "kyb" }).label).toBe(
      "Tesla, Inc. — registration",
    );
    expect(one({ label: "Tesla, Inc.", subject: null, kind: "kyb" }).label).toBe("Tesla, Inc.");
  });
});

describe("planToTargets — entity cleaning for EDGAR (via the company query param)", () => {
  // EDGAR prefix-matches the company name, so the label has to be reduced to the bare name.
  // The first two rows are live-verified failures of the un-cleaned form.
  const cases: [label: string, company: string][] = [
    ["The Home Depot", "Home Depot"], // live: "The Home Depot" -> no results
    ["Walmart Inc", "Walmart"], // live: "Walmart Inc" -> no match
    ["Tesla", "Tesla"],
    ["Tesla — SoS", "Tesla"], // em dash portal suffix
    ["Tesla – SoS", "Tesla"], // en dash
    ["Tesla - portal", "Tesla"], // plain hyphen, spaced
    ["Tesla, Inc.", "Tesla"],
    ["NVIDIA Corporation", "NVIDIA"],
    ["The Kroger Co.", "Kroger"],
    ["Acme Holdings LLC", "Acme Holdings"],
    ["Barclays PLC", "Barclays"],
    ["Costco Wholesale Corporation — SoS", "Costco Wholesale"], // both rules, in order
    // DOUBLED suffixes. A single `.replace()` strips only the last one and leaves a fragment
    // EDGAR answers with "No matching companies" — which a KYB target reports as `notfound`
    // and never retries (runTarget skips the retry whenever `classify` is set), i.e. the report
    // claims an S&P 500 company has no registration record. The strip has to run to a fixed point.
    ["Church & Dwight Co., Inc.", "Church & Dwight"], // was "Church & Dwight Co." -> no match
    ["The Kroger Co., Inc.", "Kroger"], // leading "The" + a doubled suffix, all three rules
    // Trailing punctuation/ampersand goes with the suffix, or the query carries a dangling "&".
    ["Deere & Company", "Deere"], // was "Deere &"
    ["Procter & Gamble Co.", "Procter & Gamble"],
    // Dotted initialisms. The old alternation had `l.l.c` but a bare `lp`, so "L.P." survived.
    ["Brookfield Renewable Partners L.P.", "Brookfield Renewable Partners"],
    ["Brookfield Renewable Partners L.P", "Brookfield Renewable Partners"],
    ["Baker & Hostetler L.L.P.", "Baker & Hostetler"],
    ["Acme Holdings L.L.C.", "Acme Holdings"],
    // Guards: only a TRAILING suffix and a SPACED dash are special. A greedy regex here
    // would mangle real company names.
    ["Coca-Cola", "Coca-Cola"], // unspaced hyphen is part of the name
    ["Sony Corporation of America", "Sony Corporation of America"], // suffix is not trailing
    ["Incyte", "Incyte"], // "Inc" is not a whole trailing word
    ["Thermo Fisher Scientific", "Thermo Fisher Scientific"], // no suffix at all
    ["Jack in the Box", "Jack in the Box"], // "the" is stripped only when LEADING
    ["Ltd Commodities", "Ltd Commodities"], // suffix word, but leading
    ["LP Building Solutions", "LP Building Solutions"], // ditto
    ["Estee Lauder Companies", "Estee Lauder Companies"], // "Companies" != "Company"
    ["Marsh & McLennan Companies", "Marsh & McLennan Companies"], // and the "&" is interior
    ["AT&T Inc.", "AT&T"], // an interior "&" survives; only a DANGLING one is trimmed
    ["Amazon.com, Inc.", "Amazon.com"], // interior "." survives
    // The loop must not eat a name whole: a company literally named "Company" stays "Company".
    ["Company", "Company"],
    ["The Company", "Company"],
  ];

  it.each(cases)("cleans %j -> %j", (label, company) => {
    expect(edgarCompany(one({ label, kind: "kyb" }))).toBe(company);
  });

  it("cleans the entity in the goal too, so the agent looks for the same name", () => {
    const t = one({ label: "The Home Depot, Inc.", kind: "kyb" });
    expect(edgarCompany(t)).toBe("Home Depot");
    expect(t.goal).toBe(edgarGoal("Home Depot"));
  });
});

describe("planToTargets — fact routing", () => {
  it("lands on the direct Wikipedia article, overriding the planner's URL", () => {
    const t = one({ label: "Tokyo", kind: "fact", startUrl: "https://some-slow-spa.example/tokyo" });
    expect(t.startUrl).toBe("https://en.wikipedia.org/wiki/Tokyo");
  });

  it("turns spaces into underscores and drops a portal suffix", () => {
    expect(one({ label: "New York City — population", kind: "fact" }).startUrl).toBe(
      "https://en.wikipedia.org/wiki/New_York_City",
    );
  });

  it("does NOT strip legal suffixes (Wikipedia titles keep them)", () => {
    // The inverse of the KYB rule: "Apple Inc." is the actual article title, and cleaning it
    // to "Apple" would land on the fruit.
    expect(one({ label: "Apple Inc.", kind: "fact" }).startUrl).toBe(
      "https://en.wikipedia.org/wiki/Apple_Inc.",
    );
  });

  it("keeps the planner's own extract question — only the source is overridden", () => {
    const question = "In what year was the company founded?";
    const t = one({ label: "Airbnb", kind: "fact", extract: question });
    expect(t.extract).toContain(question); // factExtract wraps it with an output instruction
    expect(t.extract).not.toBe(EDGAR_EXTRACT);
  });

  it("is single-pass with the fact step + timeout budgets", () => {
    const t = one({ label: "Tokyo", kind: "fact" });
    expect(t.singlePass).toBe(true);
    expect(t.maxSteps).toBe(FACT_MAX_STEPS);
    expect(t.timeoutMs).toBe(FACT_TIMEOUT_MS);
  });

  it("gets no KYB classifier (a fact answer is free text, not a registration status)", () => {
    expect(one({ label: "Tokyo", kind: "fact" }).classify).toBeUndefined();
  });

  it("routes off `subject`, so a question-shaped label can't build the article title", () => {
    // The bug this field exists for: "Airbnb founding year" -> /wiki/Airbnb_founding_year, which is
    // Wikipedia's "does not have an article with this exact name" page, on a target that is
    // singlePass and never retries. With a subject the title is the planner's explicit entity.
    const t = one({ label: "Airbnb — founding year", subject: "Airbnb", kind: "fact" });
    expect(t.startUrl).toBe("https://en.wikipedia.org/wiki/Airbnb");
    expect(t.startUrl).not.toContain("founding");
    expect(t.goal).toBe(factGoal("Airbnb"));
    expect(t.query).toBe("Airbnb Wikipedia");
  });

  it("uses the subject verbatim, without the label's portal-suffix strip", () => {
    // An explicit subject is already the article title; splitting it on a spaced dash would
    // truncate real titles. (The strip belongs to the label fallback, where it guesses.)
    expect(one({ label: "the 2018 film", subject: "Mission: Impossible – Fallout", kind: "fact" })
      .startUrl).toBe("https://en.wikipedia.org/wiki/Mission%3A_Impossible_%E2%80%93_Fallout");
  });

  it("falls back to label-derivation when subject is null or blank", () => {
    // Degrade to yesterday's behavior, not to /wiki/ with an empty title.
    expect(one({ label: "New York City — population", subject: null, kind: "fact" }).startUrl).toBe(
      "https://en.wikipedia.org/wiki/New_York_City",
    );
    expect(one({ label: "Tokyo", subject: "  ", kind: "fact" }).startUrl).toBe(
      "https://en.wikipedia.org/wiki/Tokyo",
    );
  });

  it("leaves the label untouched no matter which key routed it", () => {
    const t = one({ label: "Airbnb — founding year", subject: "Airbnb", kind: "fact" });
    expect(t.label).toBe("Airbnb — founding year");
    expect(one({ label: "Tokyo — population", subject: null, kind: "fact" }).label).toBe(
      "Tokyo — population",
    );
  });

  it("keeps a Wikipedia-scoped query for the review UI (there is no retry to fall back to)", () => {
    // `singlePass` means runTarget never retries a fact target, and `startUrl` is always set so
    // the pre-attempt search never fires either — this query is display/edit state in
    // PlanReview, and it stays scoped to Wikipedia so an edited target does not drift onto the
    // open web (the slow, unreliable path Wikipedia routing exists to replace).
    const t = one({ label: "Tokyo", kind: "fact" });
    expect(t.query).toContain("Wikipedia");
    expect(t.singlePass).toBe(true); // the reason the query is not a fallback
  });
});

describe("planToTargets — general passthrough", () => {
  const planned = {
    label: "BestBuy — iPhone 16 Pro",
    startUrl: "https://www.bestbuy.com/site/searchpage.jsp?st=iphone+16+pro",
    query: "iphone 16 pro price bestbuy",
    goal: "find the listed price",
    extract: "what is the price?",
  };

  it("drives exactly what the planner chose for kind:'general'", () => {
    const t = one({ ...planned, kind: "general" });
    expect(t.startUrl).toBe(planned.startUrl);
    expect(t.query).toBe(planned.query);
    expect(t.goal).toBe(planned.goal);
    expect(t.extract).toBe(planned.extract);
    expect(t.label).toBe(planned.label);
  });

  it("treats a null kind the same as 'general'", () => {
    expect(one({ ...planned, kind: null })).toEqual(one({ ...planned, kind: "general" }));
  });

  it("does not leak source-routing fields onto general targets", () => {
    // If the kind switch regressed (e.g. everything fell into the KYB branch) this is the
    // assertion that catches it: a general target must stay retry-eligible and unclassified.
    const t = one({ ...planned, kind: "general" });
    expect(t.classify).toBeUndefined();
    expect(t.singlePass).toBeUndefined();
    expect(t.maxSteps).toBeUndefined();
    expect(t.timeoutMs).toBeUndefined();
    expect(t.startUrl).not.toContain("sec.gov");
    expect(t.startUrl).not.toContain("wikipedia.org");
  });

  it("ignores `subject` on general targets (nothing is pinned, so there is nothing to look up by)", () => {
    // A planner that fills subject in anyway must not perturb the passthrough path.
    const t = one({ ...planned, subject: "Best Buy", kind: "general" });
    expect(t).toEqual(one({ ...planned, subject: null, kind: "general" }));
    expect(t.startUrl).toBe(planned.startUrl);
    expect(t.label).toBe(planned.label);
  });

  it("normalizes strict-mode nulls to undefined", () => {
    // runTarget branches on `isHttpUrl(target.startUrl)` and truthiness of `query`; a literal
    // null would type-lie about SwarmTarget's optional fields.
    const t = one({ label: "Acme", kind: "general", startUrl: null, query: null });
    expect(t.startUrl).toBeUndefined();
    expect(t.query).toBeUndefined();
  });
});

describe("planToTargets — ids", () => {
  it("prefixes with the index and slugifies the label", () => {
    expect(one({ label: "Acme Corp!" }).id).toBe("t0-acme-corp");
  });

  it("stays unique when two targets share a label", () => {
    const ids = planToTargets([pt({ label: "Acme Corp" }), pt({ label: "Acme Corp" })]).map(
      (t) => t.id,
    );
    expect(ids).toEqual(["t0-acme-corp", "t1-acme-corp"]);
    expect(new Set(ids).size).toBe(2);
  });

  it("bounds the slug and falls back when a label has no word characters", () => {
    const long = one({ label: "Bay Area Rapid Transit District Authority" });
    expect(long.id.startsWith("t0-")).toBe(true);
    expect(long.id.slice(3).length).toBeLessThanOrEqual(24);
    expect(one({ label: "!!! ???" }).id).toBe("t0-target");
  });

  it("uses the same id scheme regardless of kind, and keeps the raw label", () => {
    const targets = planToTargets([
      pt({ label: "Tesla, Inc.", kind: "kyb" }),
      pt({ label: "Tokyo", kind: "fact" }),
      pt({ label: "Acme", kind: "general" }),
    ]);
    expect(targets.map((t) => t.id)).toEqual(["t0-tesla-inc", "t1-tokyo", "t2-acme"]);
    // The label is display text: cleaning happens only on the way to the source.
    expect(targets[0].label).toBe("Tesla, Inc.");
  });
});

describe("planToTargets — mixed plans", () => {
  it("routes each target by its own kind", () => {
    const [kyb, fact, general] = planToTargets([
      pt({ label: "Tesla", kind: "kyb", startUrl: "https://wrong.example" }),
      pt({ label: "Tokyo", kind: "fact", startUrl: "https://wrong.example" }),
      pt({ label: "Acme", kind: "general", startUrl: "https://right.example" }),
    ]);
    expect(kyb.startUrl).toContain("sec.gov");
    expect(fact.startUrl).toContain("en.wikipedia.org");
    expect(general.startUrl).toBe("https://right.example");
  });

  it("returns one target per plan target, in order", () => {
    const plan = [pt({ label: "A" }), pt({ label: "B", kind: "kyb" }), pt({ label: "C" })];
    expect(planToTargets(plan).map((t) => t.label)).toEqual(["A", "B", "C"]);
    expect(planToTargets([])).toEqual([]);
  });
});
