// Dev-only visual harness: renders the real report (donut + rows) to an HTML file with mock
// data, so the chart can be eyeballed without spending a Browserbase run. Exercises the actual
// donutSvg + reportToPrintableHtml. Run: agent/node_modules/.bin/tsx apps/web/scripts/preview-report.ts
import { writeFileSync } from "fs";
import { buildReport, reportToPrintableHtml, donutSvg, type ReportItem } from "../lib/report";

const items: ReportItem[] = [
  { label: "Acme Corp", status: "active", result: "Active", url: "https://bizfileonline.sos.ca.gov" },
  { label: "Globex LLC", status: "active", result: "Active", url: "https://sos.state.tx.us" },
  { label: "Initech", status: "notfound", result: "No match found" },
  { label: "Umbrella Inc", status: "blocked", result: "Portal blocked" },
  { label: "Stark Industries", status: "active", result: "Active", url: "https://icis.corp.delaware.gov" },
  { label: "Wayne Enterprises", status: "error", result: "timed out" },
];
const model = buildReport("verify these companies are real & active", items, {
  headline: "3 of 6 verified active; three need attention.",
  takeaway: "Two portals blocked us and one timed out — worth a stealth retry.",
  notes: ["Umbrella Inc was walled by the state portal.", "Initech returned no registration."],
});

// Strip of donuts to sanity-check geometry across shapes (all-pass, mixed, single).
const strip = [
  donutSvg({ active: 5 }, () => "#059669", { center: "5", sub: "of 5", track: "#eee" }),
  donutSvg(model.counts.byStatus, (s) => ({ active: "#059669", notfound: "#d97706", blocked: "#ea580c", error: "#dc2626" }[s] ?? "#6b7280"), { center: String(model.counts.resolved), sub: `of ${model.counts.total}`, track: "#eee" }),
  donutSvg({ blocked: 3, error: 1 }, (s) => ({ blocked: "#ea580c", error: "#dc2626" }[s] ?? "#6b7280"), { center: "0", sub: "of 4", track: "#eee" }),
].join(" ");

const html = reportToPrintableHtml(model).replace(
  "<table>",
  `<div style="display:flex;gap:24px;margin:0 0 24px;padding:16px;background:#fafafa;border-radius:8px">${strip}</div><table>`,
);
writeFileSync("/tmp/friday-report-preview.html", html);
console.log("wrote /tmp/friday-report-preview.html");
console.log("donut byStatus:", model.counts.byStatus, "resolved:", model.counts.resolved, "of", model.counts.total);
