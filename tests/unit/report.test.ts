import { describe, it, expect } from "vitest";
import {
  describeOutcome,
  buildReport,
  reportToMarkdown,
  reportToPrintableHtml,
  donutSvg,
  RESOLVED_STATUSES,
  type ReportItem,
} from "../../apps/web/lib/report";

// The three exporters (modal / Markdown / printable HTML) all read through describeOutcome,
// so these constants are the contract every surface shares. Spelled out here rather than
// imported (they're module-private) so a silent copy-edit to the wording still passes but a
// change to WHICH sentence a branch picks fails loudly.
const BOT_WALL = "The site blocked automated access (anti-bot wall).";
const NOT_FOUND = "No matching record was found in this registry.";
const SESSION_LOST = "The browser session ended before the check finished.";
const TOO_SLOW = "The site was too slow to respond in time.";
const CHECK_FAILED = "The check failed before returning a result.";

const item = (o: Partial<ReportItem> & { status: string }): ReportItem => ({
  label: o.label ?? "Target",
  status: o.status,
  result: o.result,
  url: o.url,
  ms: o.ms,
  screenshotUrl: o.screenshotUrl,
});

// ---------------------------------------------------------------------------
// describeOutcome
// ---------------------------------------------------------------------------

type Case = { name: string; status: string; result?: string; expected: string };

/** Resolved statuses print the extracted answer VERBATIM — including the bare classifier
 *  token, because on a KYB row "active" IS the finding. Blanking it would leave the report's
 *  Answer column an em dash on every successful row. */
const resolvedCases: Case[] = [
  {
    name: "keeps a real extracted answer",
    status: "done",
    result: "Sales tax in Austin, TX is 8.25%",
    expected: "Sales tax in Austin, TX is 8.25%",
  },
  { name: "keeps the bare token 'active' — it is the finding", status: "active", result: "active", expected: "active" },
  { name: "keeps the bare token 'inactive'", status: "inactive", result: "inactive", expected: "inactive" },
  { name: "keeps a quoted token verbatim", status: "active", result: '"active"', expected: '"active"' },
  { name: "trims surrounding whitespace", status: "active", result: "  Active  ", expected: "Active" },
  { name: "empty when nothing was extracted", status: "done", result: undefined, expected: "" },
  { name: "empty for a whitespace-only extract", status: "done", result: "   ", expected: "" },
];

/** blocked: strip the `blocked:` prefix FIRST, then decide whether what's left is real detail. */
const blockedCases: Case[] = [
  { name: "keeps the reason after the prefix", status: "blocked", result: "blocked: captcha wall", expected: "captcha wall" },
  {
    name: "prefix match is case-insensitive",
    status: "blocked",
    result: "Blocked: Cloudflare Turnstile challenge",
    expected: "Cloudflare Turnstile challenge",
  },
  { name: "prefix with no space still strips", status: "blocked", result: "blocked:Akamai bot manager", expected: "Akamai bot manager" },
  {
    name: "detail containing the word 'blocked' survives",
    status: "blocked",
    result: "blocked: the record is blocked behind a login",
    expected: "the record is blocked behind a login",
  },
  { name: "bare token falls back", status: "blocked", result: "blocked", expected: BOT_WALL },
  { name: "prefix with nothing after it falls back", status: "blocked", result: "blocked:", expected: BOT_WALL },
  { name: "quoted token falls back", status: "blocked", result: '"blocked"', expected: BOT_WALL },
  { name: "token with a period falls back", status: "blocked", result: "Blocked.", expected: BOT_WALL },
  { name: "missing result falls back", status: "blocked", result: undefined, expected: BOT_WALL },
  { name: "whitespace-only result falls back", status: "blocked", result: "   ", expected: BOT_WALL },
];

/** notfound: the flagship demo's Stripe row. EDGAR_EXTRACT tells the agent to answer with the
 *  literal word `notfound`, so without the token rule the row read
 *  label "Stripe" / badge "Not found" / reason "notfound" — the same word three times. */
const notfoundCases: Case[] = [
  { name: "bare 'notfound' token yields the sentence (the Stripe row)", status: "notfound", result: "notfound", expected: NOT_FOUND },
  { name: "quoted 'notfound' yields the sentence", status: "notfound", result: '"notfound"', expected: NOT_FOUND },
  { name: "single-quoted token yields the sentence", status: "notfound", result: "'notfound'", expected: NOT_FOUND },
  { name: "'not found' (spaced) yields the sentence", status: "notfound", result: "not found", expected: NOT_FOUND },
  { name: "'Not found.' (punctuated) yields the sentence", status: "notfound", result: "Not found.", expected: NOT_FOUND },
  { name: "'NOTFOUND' (shouted) yields the sentence", status: "notfound", result: "NOTFOUND", expected: NOT_FOUND },
  { name: "quoted + punctuated yields the sentence", status: "notfound", result: '"notfound".', expected: NOT_FOUND },
  { name: "missing result yields the sentence", status: "notfound", result: undefined, expected: NOT_FOUND },
  { name: "whitespace-only yields the sentence", status: "notfound", result: "  \n ", expected: NOT_FOUND },
  {
    name: "real prose survives — a sentence is not a token",
    status: "notfound",
    result: "No SEC filings under that name",
    expected: "No SEC filings under that name",
  },
  {
    name: "a phrase merely containing the token is not a token",
    status: "notfound",
    result: "notfound in the 2019 register",
    expected: "notfound in the 2019 register",
  },
];

/** error: pattern-match the raw failure text into plain English; anything unrecognised passes
 *  through so a reader still sees the real message. Branch ORDER is part of the contract. */
const errorCases: Case[] = [
  { name: "session lost", status: "error", result: "Session lost while the agent was navigating", expected: SESSION_LOST },
  { name: "session is no longer available", status: "error", result: "browser session is no longer available", expected: SESSION_LOST },
  { name: "session ended", status: "error", result: "The session ended unexpectedly", expected: SESSION_LOST },
  {
    name: "awaitActivePage null (the real observed crash)",
    status: "error",
    result: "TypeError: Cannot read properties of null (reading 'awaitActivePage')",
    expected: SESSION_LOST,
  },
  { name: "CDP transport", status: "error", result: "CDP transport closed", expected: SESSION_LOST },
  { name: "socket-close", status: "error", result: "socket-close: websocket disconnected", expected: SESSION_LOST },
  { name: "navigation timeout", status: "error", result: "Navigation timeout of 30000 ms exceeded", expected: TOO_SLOW },
  { name: "'timed out' phrasing", status: "error", result: "The page timed out waiting for results", expected: TOO_SLOW },
  { name: "captcha", status: "error", result: "hCaptcha shown before results", expected: BOT_WALL },
  { name: "turnstile", status: "error", result: "Cloudflare turnstile interstitial", expected: BOT_WALL },
  { name: "are you human", status: "error", result: "Page asked: are you human?", expected: BOT_WALL },
  { name: "challenge", status: "error", result: "Security challenge page", expected: BOT_WALL },
  {
    name: "session check wins over timeout when both words appear",
    status: "error",
    result: "session ended after a 60s timeout",
    expected: SESSION_LOST,
  },
  {
    name: "timeout check wins over captcha when both words appear",
    status: "error",
    result: "timed out waiting for the captcha to clear",
    expected: TOO_SLOW,
  },
  {
    name: "unrecognised failure text passes through unchanged",
    status: "error",
    result: "Upstream registry returned HTTP 502",
    expected: "Upstream registry returned HTTP 502",
  },
  {
    // Real failure strings routinely contain the word "error"; only a string that IS the
    // bare token may be discarded.
    name: "prose containing the word 'error' still passes through",
    status: "error",
    result: "Registry returned an error page for that filing",
    expected: "Registry returned an error page for that filing",
  },
  { name: "bare 'error' token falls back", status: "error", result: "error", expected: CHECK_FAILED },
  { name: "quoted 'error' token falls back", status: "error", result: '"error"', expected: CHECK_FAILED },
  { name: "'Error.' falls back", status: "error", result: "Error.", expected: CHECK_FAILED },
  { name: "missing result falls back", status: "error", result: undefined, expected: CHECK_FAILED },
  { name: "whitespace-only falls back", status: "error", result: "   ", expected: CHECK_FAILED },
];

describe("describeOutcome", () => {
  const groups: Array<[string, Case[]]> = [
    ["resolved (done/active/inactive) — the extract IS the answer", resolvedCases],
    ["blocked", blockedCases],
    ["notfound", notfoundCases],
    ["error", errorCases],
  ];

  for (const [group, cases] of groups) {
    describe(group, () => {
      for (const c of cases) {
        it(`${c.status}: ${c.name}`, () => {
          expect(describeOutcome({ status: c.status, result: c.result })).toBe(c.expected);
        });
      }
    });
  }

  it("never echoes a bare classifier token as the reason on a failed row", () => {
    // The whole point of the token rule: on a failed row the badge already says the word, so
    // the reason column must say something a human learns from.
    for (const status of ["blocked", "notfound", "error"]) {
      for (const raw of [status, status.toUpperCase(), `"${status}"`, `${status}.`, `'${status}'`]) {
        const out = describeOutcome({ status, result: raw });
        expect(out.toLowerCase()).not.toBe(raw.toLowerCase());
        expect(out.length).toBeGreaterThan(20);
      }
    }
  });

  it("passes an unknown status through with its raw (trimmed) result", () => {
    expect(describeOutcome({ status: "running", result: "  still working  " })).toBe("still working");
    expect(describeOutcome({ status: "queued", result: undefined })).toBe("");
  });

  it("treats exactly done/active/inactive as resolved", () => {
    expect([...RESOLVED_STATUSES].sort()).toEqual(["active", "done", "inactive"]);
  });
});

// ---------------------------------------------------------------------------
// buildReport
// ---------------------------------------------------------------------------

describe("buildReport", () => {
  const items: ReportItem[] = [
    item({ label: "Tesla", status: "active", result: "active" }),
    item({ label: "Nvidia", status: "active", result: "active" }),
    item({ label: "Blockbuster", status: "inactive", result: "inactive" }),
    item({ label: "Stripe", status: "notfound", result: "notfound" }),
    item({ label: "Arizona", status: "blocked", result: "blocked" }),
    item({ label: "California", status: "error", result: "session ended" }),
    item({ label: "Weather", status: "done", result: "72F" }),
  ];

  it("counts every row exactly once", () => {
    const m = buildReport("verify these", items);
    expect(m.counts.total).toBe(items.length);
    const summed = Object.values(m.counts.byStatus).reduce((a, b) => a + b, 0);
    expect(summed).toBe(items.length);
  });

  it("buckets by status", () => {
    expect(buildReport("t", items).counts.byStatus).toEqual({
      active: 2,
      inactive: 1,
      notfound: 1,
      blocked: 1,
      error: 1,
      done: 1,
    });
  });

  it("counts done/active/inactive as resolved and nothing else", () => {
    // 2 active + 1 inactive + 1 done = 4; blocked/notfound/error are unresolved work.
    expect(buildReport("t", items).counts.resolved).toBe(4);
  });

  it("neither invents nor drops rows, and keeps their order", () => {
    const m = buildReport("t", items);
    expect(m.items).toHaveLength(items.length);
    expect(m.items.map((i) => i.label)).toEqual([
      "Tesla",
      "Nvidia",
      "Blockbuster",
      "Stripe",
      "Arizona",
      "California",
      "Weather",
    ]);
  });

  it("carries the task through", () => {
    expect(buildReport("is Stripe registered?", items).task).toBe("is Stripe registered?");
  });

  it("handles an empty run", () => {
    const m = buildReport("nothing ran", []);
    expect(m.counts).toEqual({ total: 0, resolved: 0, byStatus: {} });
  });

  it("normalises a missing narrative to null (not undefined)", () => {
    expect(buildReport("t", items).narrative).toBeNull();
    expect(buildReport("t", items, undefined).narrative).toBeNull();
  });

  it("keeps a supplied narrative", () => {
    const n = { headline: "5 of 7 verified", takeaway: "Two need a human", notes: ["AZ has a bot wall"] };
    expect(buildReport("t", items, n).narrative).toEqual(n);
  });

  it("counts an unrecognised status without crashing", () => {
    const m = buildReport("t", [item({ status: "skipped" })]);
    expect(m.counts).toEqual({ total: 1, resolved: 0, byStatus: { skipped: 1 } });
  });
});

// ---------------------------------------------------------------------------
// reportToMarkdown
// ---------------------------------------------------------------------------

/** Split one Markdown table row into its cells, respecting `\|` escapes — i.e. read the row
 *  the way a Markdown renderer would, so an unescaped pipe shows up as an extra column. */
const cellsOf = (row: string): string[] =>
  row
    .split(/(?<!\\)\|/)
    .slice(1, -1)
    .map((s) => s.trim());

const rowFor = (md: string, label: string): string => {
  const row = md.split("\n").find((l) => l.startsWith(`| ${label} `) || l.startsWith(`| ${label}|`));
  if (!row) throw new Error(`no row for ${label} in:\n${md}`);
  return row;
};

describe("reportToMarkdown", () => {
  it("renders describeOutcome in the Answer column, not the raw token", () => {
    const md = reportToMarkdown(buildReport("t", [item({ label: "Stripe", status: "notfound", result: "notfound" })]));
    const cells = cellsOf(rowFor(md, "Stripe"));
    expect(cells[1]).toBe("notfound"); // the badge column still says the status
    expect(cells[2]).toBe(NOT_FOUND); // ...and the answer column explains it
  });

  it("keeps the extracted value on a resolved row", () => {
    const md = reportToMarkdown(buildReport("t", [item({ label: "Tesla", status: "active", result: "active" })]));
    expect(cellsOf(rowFor(md, "Tesla"))[2]).toBe("active");
  });

  it("prints an em dash when there is no answer at all", () => {
    const md = reportToMarkdown(buildReport("t", [item({ label: "Ghost", status: "done", result: "" })]));
    expect(cellsOf(rowFor(md, "Ghost"))[2]).toBe("—");
  });

  it("escapes pipes so a result cannot add a column", () => {
    const md = reportToMarkdown(
      buildReport("t", [item({ label: "Acme", status: "done", result: "Active | Good standing" })]),
    );
    const header = md.split("\n").find((l) => l.startsWith("| Target "))!;
    const row = rowFor(md, "Acme");
    expect(cellsOf(row)).toHaveLength(cellsOf(header).length);
    expect(cellsOf(row)[2]).toBe("Active \\| Good standing");
  });

  it("escapes pipes in the label too", () => {
    const md = reportToMarkdown(buildReport("t", [item({ label: "A | B", status: "done", result: "ok" })]));
    const row = md.split("\n").find((l) => l.includes("A \\| B"))!;
    expect(cellsOf(row)).toHaveLength(4);
  });

  it("flattens newlines so a result cannot break the row in two", () => {
    const md = reportToMarkdown(
      buildReport("t", [item({ label: "Acme", status: "done", result: "line one\nline two" })]),
    );
    expect(md).not.toContain("line one\nline two");
    expect(cellsOf(rowFor(md, "Acme"))[2]).toBe("line one line two");
  });

  it("renders the source as a bare host link, or an em dash without a url", () => {
    const md = reportToMarkdown(
      buildReport("t", [
        item({ label: "CA", status: "done", result: "ok", url: "https://www.sos.ca.gov/search?q=1" }),
        item({ label: "None", status: "done", result: "ok" }),
      ]),
    );
    expect(cellsOf(rowFor(md, "CA"))[3]).toBe("[sos.ca.gov](https://www.sos.ca.gov/search?q=1)");
    expect(cellsOf(rowFor(md, "None"))[3]).toBe("—");
  });

  it("falls back to the raw string when the url will not parse", () => {
    const md = reportToMarkdown(buildReport("t", [item({ label: "Odd", status: "done", result: "ok", url: "not a url" })]));
    expect(cellsOf(rowFor(md, "Odd"))[3]).toBe("[not a url](not a url)");
  });

  it("includes the counts line and the task", () => {
    const md = reportToMarkdown(
      buildReport("verify 2 companies", [
        item({ label: "A", status: "active", result: "active" }),
        item({ label: "B", status: "error", result: "boom" }),
      ]),
    );
    expect(md).toContain("**Task:** verify 2 companies");
    expect(md).toContain("**Resolved:** 1 / 2");
    expect(md).toContain("active: 1");
    expect(md).toContain("error: 1");
  });

  it("includes headline, notes and takeaway when a narrative is present", () => {
    const md = reportToMarkdown(
      buildReport("t", [item({ label: "A", status: "active", result: "active" })], {
        headline: "All clear",
        takeaway: "Nothing to escalate",
        notes: ["first note", "second note"],
      }),
    );
    expect(md).toContain("All clear");
    expect(md).toContain("- first note");
    expect(md).toContain("- second note");
    expect(md).toContain("**Takeaway:** Nothing to escalate");
  });

  it("omits the Notes section entirely when there is no narrative", () => {
    const md = reportToMarkdown(buildReport("t", [item({ label: "A", status: "active", result: "active" })]));
    expect(md).not.toContain("## Notes");
    expect(md).not.toContain("**Takeaway:**");
  });

  it("renders a header and one row per item", () => {
    const items = [
      item({ label: "A", status: "active", result: "active" }),
      item({ label: "B", status: "blocked", result: "blocked" }),
      item({ label: "C", status: "error", result: "boom" }),
    ];
    const md = reportToMarkdown(buildReport("t", items));
    const body = md.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| Target") && !l.startsWith("| ---"));
    expect(body).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// reportToPrintableHtml — the export that leaves the app. Extracted text comes off a live
// page via an LLM, so every interpolation of it must be escaped.
// ---------------------------------------------------------------------------

describe("reportToPrintableHtml", () => {
  it("renders describeOutcome, not the raw token", () => {
    const html = reportToPrintableHtml(
      buildReport("t", [item({ label: "Stripe", status: "notfound", result: "notfound" })]),
    );
    expect(html).toContain(`<td class="answer">${NOT_FOUND}</td>`);
  });

  it("translates a raw failure string into the plain-English reason", () => {
    const html = reportToPrintableHtml(
      buildReport("t", [item({ label: "California", status: "error", result: "socket-close" })]),
    );
    expect(html).toContain(`<td class="answer">${SESSION_LOST}</td>`);
    expect(html).not.toContain("socket-close");
  });

  it("prints an em dash for an empty answer", () => {
    const html = reportToPrintableHtml(buildReport("t", [item({ label: "Ghost", status: "done", result: "" })]));
    expect(html).toContain(`<td class="answer">—</td>`);
  });

  it("escapes markup in an extracted result — no live tag reaches the export", () => {
    const html = reportToPrintableHtml(
      buildReport("t", [item({ label: "Acme", status: "done", result: `<script>alert('xss')</script>` })]),
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("</script>");
    expect(html).toContain("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;");
  });

  it("escapes markup in the label", () => {
    const html = reportToPrintableHtml(buildReport("t", [item({ label: `<img onerror=alert(1)>`, status: "done" })]));
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img onerror=alert(1)&gt;");
  });

  it("escapes quotes so a url cannot break out of its attribute", () => {
    const html = reportToPrintableHtml(
      buildReport("t", [
        item({ label: "Acme", status: "done", result: "ok", url: `https://x.test/" onmouseover="alert(1)` }),
      ]),
    );
    expect(html).not.toContain(`onmouseover="alert(1)"`);
    expect(html).toContain("&quot;");
  });

  it("escapes quotes in the screenshot data-url attribute", () => {
    const html = reportToPrintableHtml(
      buildReport("t", [
        item({ label: "Acme", status: "done", screenshotUrl: `data:image/png;base64,AAA" onerror="alert(1)` }),
      ]),
    );
    expect(html).not.toContain(`onerror="alert(1)"`);
  });

  it("escapes the task, headline, notes and takeaway", () => {
    const html = reportToPrintableHtml(
      buildReport("check <b>everything</b>", [item({ label: "A", status: "active", result: "active" })], {
        headline: "<i>headline</i>",
        takeaway: "<u>takeaway</u>",
        notes: ["<em>note</em>"],
      }),
    );
    for (const tag of ["<b>", "<i>", "<u>", "<em>"]) expect(html).not.toContain(tag);
    expect(html).toContain("&lt;b&gt;everything&lt;/b&gt;");
    expect(html).toContain("&lt;i&gt;headline&lt;/i&gt;");
    expect(html).toContain("&lt;em&gt;note&lt;/em&gt;");
    expect(html).toContain("&lt;u&gt;takeaway&lt;/u&gt;");
  });

  it("escapes ampersands exactly once", () => {
    const html = reportToPrintableHtml(
      buildReport("t", [item({ label: "Ben & Jerry's", status: "done", result: "R&D active" })]),
    );
    expect(html).toContain("Ben &amp; Jerry&#39;s");
    expect(html).toContain("R&amp;D active");
    expect(html).not.toContain("&amp;amp;");
  });

  it("escapes an unexpected status before it lands in the badge", () => {
    const html = reportToPrintableHtml(buildReport("t", [item({ label: "A", status: "<b>weird</b>" })]));
    expect(html).not.toContain("<b>weird</b>");
    expect(html).toContain("&lt;b&gt;weird&lt;/b&gt;");
    expect(html).toContain("background:#6b7280"); // unknown status gets the neutral badge
  });

  it("emits one row per item and the glance donut", () => {
    const html = reportToPrintableHtml(
      buildReport("t", [
        item({ label: "A", status: "active", result: "active" }),
        item({ label: "B", status: "error", result: "boom" }),
      ]),
    );
    expect(html.match(/<tr>/g)).toHaveLength(2);
    expect(html).toContain('aria-label="1 of 2 resolved"');
  });

  it("omits the notes list when there is no narrative", () => {
    const html = reportToPrintableHtml(buildReport("t", [item({ label: "A", status: "active", result: "active" })]));
    expect(html).not.toContain("<h2>Notes</h2>");
    expect(html).not.toContain("Takeaway:");
  });
});

// ---------------------------------------------------------------------------
// donutSvg
// ---------------------------------------------------------------------------

const dashLengths = (svg: string): number[] =>
  [...svg.matchAll(/stroke-dasharray="([\d.]+) ([\d.]+)"/g)].map((m) => Number(m[1]));

describe("donutSvg", () => {
  const color = (s: string) => (s === "active" ? "#0f0" : "#f00");

  it("draws one arc per non-zero status, sized in proportion", () => {
    const svg = donutSvg({ active: 3, error: 1 }, color, { size: 100, stroke: 10 });
    const lens = dashLengths(svg);
    const circumference = 2 * Math.PI * ((100 - 10) / 2);
    expect(lens).toHaveLength(2);
    expect(lens[0] / circumference).toBeCloseTo(0.75, 2);
    expect(lens[1] / circumference).toBeCloseTo(0.25, 2);
    expect(lens[0] + lens[1]).toBeCloseTo(circumference, 1);
  });

  it("lays segments end to end (each offset by the arcs before it)", () => {
    const svg = donutSvg({ active: 3, error: 1 }, color, { size: 100, stroke: 10 });
    const offsets = [...svg.matchAll(/stroke-dashoffset="(-?[\d.]+)"/g)].map((m) => Number(m[1]));
    expect(Math.abs(offsets[0])).toBe(0); // first arc starts at 12 o'clock
    expect(offsets[1]).toBeCloseTo(-dashLengths(svg)[0], 1);
  });

  it("drops zero-count statuses instead of drawing empty arcs", () => {
    const svg = donutSvg({ active: 2, blocked: 0, error: 0 }, color);
    expect(dashLengths(svg)).toHaveLength(1);
  });

  it("renders a valid, arc-free ring for an empty run (no divide-by-zero)", () => {
    const svg = donutSvg({}, color, { size: 108 });
    expect(svg).toContain('viewBox="0 0 108 108"');
    expect(dashLengths(svg)).toHaveLength(0);
    expect(svg).not.toContain("NaN");
  });

  it("prints center/sub text only when asked", () => {
    expect(donutSvg({ active: 1 }, color)).not.toContain("<text");
    const withText = donutSvg({ active: 1 }, color, { center: "1", sub: "of 1" });
    expect(withText).toContain(">1</text>");
    expect(withText).toContain(">of 1</text>");
  });

  it("omits the sub label when there is no center label to anchor it", () => {
    expect(donutSvg({ active: 1 }, color, { sub: "of 1" })).not.toContain("of 1");
  });

  it("adds aria-label only when supplied", () => {
    expect(donutSvg({ active: 1 }, color)).not.toContain("aria-label");
    expect(donutSvg({ active: 1 }, color, { label: "1 of 1 resolved" })).toContain('aria-label="1 of 1 resolved"');
  });
});
