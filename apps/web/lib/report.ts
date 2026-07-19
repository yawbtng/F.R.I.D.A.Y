// Report model + exporters. Pure (no window/DOM) so it's testable and reused by the modal.
// The per-target rows are DETERMINISTIC (built from the swarm's own tile data — always
// accurate); the narrative (headline / takeaway / notes) is the AI synthesis layered on top.

export interface ReportNarrative {
  headline: string;
  takeaway: string;
  notes: string[];
}

export interface ReportItem {
  label: string;
  status: string;
  result?: string;
  url?: string;
  ms?: number;
  screenshotUrl?: string;
}

export interface ReportModel {
  task: string;
  items: ReportItem[];
  counts: { total: number; resolved: number; byStatus: Record<string, number> };
  narrative?: ReportNarrative | null;
}

/** Settled, useful answers (as opposed to blocked / notfound / error which need work). */
export const RESOLVED_STATUSES = new Set(["done", "active", "inactive"]);

const host = (url?: string): string => {
  if (!url) return "";
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export function buildReport(
  task: string,
  items: ReportItem[],
  narrative?: ReportNarrative | null,
): ReportModel {
  const byStatus: Record<string, number> = {};
  let resolved = 0;
  for (const it of items) {
    byStatus[it.status] = (byStatus[it.status] ?? 0) + 1;
    if (RESOLVED_STATUSES.has(it.status)) resolved++;
  }
  return { task, items, counts: { total: items.length, resolved, byStatus }, narrative: narrative ?? null };
}

/** Pass/fail donut as a pure SVG markup string — no charting dependency. ONE source of truth:
 *  the report modal renders it with CSS-var colors (themes light/dark), the printable HTML export
 *  renders it with fixed hex. Segments are stroked arcs on a circle via stroke-dasharray, laid
 *  clockwise from 12 o'clock (rotate -90). `colorFor` maps each status to a fill; `center`/`sub`
 *  print inside the ring (currentColor, so it inherits the caller's text color). */
export function donutSvg(
  byStatus: Record<string, number>,
  colorFor: (status: string) => string,
  opts?: { size?: number; stroke?: number; center?: string; sub?: string; track?: string; label?: string },
): string {
  const size = opts?.size ?? 108;
  const stroke = opts?.stroke ?? 15;
  const track = opts?.track ?? "rgba(0,0,0,0.08)";
  const c = size / 2;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const entries = Object.entries(byStatus).filter(([, n]) => n > 0);
  const total = entries.reduce((s, [, n]) => s + n, 0) || 1;

  let offset = 0;
  const arcs = entries
    .map(([status, n]) => {
      const len = (n / total) * C;
      const seg = `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${colorFor(status)}" stroke-width="${stroke}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" />`;
      offset += len;
      return seg;
    })
    .join("");

  const center = opts?.center
    ? `<text x="${c}" y="${c - (opts.sub ? size * 0.06 : 0)}" text-anchor="middle" dominant-baseline="central" font-size="${(size * 0.28).toFixed(1)}" font-weight="600" fill="currentColor">${opts.center}</text>`
    : "";
  const sub = opts?.center && opts?.sub
    ? `<text x="${c}" y="${c + size * 0.15}" text-anchor="middle" dominant-baseline="central" font-size="${(size * 0.11).toFixed(1)}" fill="currentColor" opacity="0.55">${opts.sub}</text>`
    : "";

  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img"${opts?.label ? ` aria-label="${opts.label}"` : ""}><g transform="rotate(-90 ${c} ${c})"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}" />${arcs}</g>${center}${sub}</svg>`;
}

const countsLine = (m: ReportModel): string =>
  Object.entries(m.counts.byStatus)
    .map(([k, v]) => `${k}: ${v}`)
    .join("  ·  ");

export function reportToMarkdown(m: ReportModel): string {
  const out: string[] = ["# F.R.I.D.A.Y. verification report", "", `**Task:** ${m.task}`, ""];
  if (m.narrative?.headline) out.push(m.narrative.headline, "");
  out.push(`**Resolved:** ${m.counts.resolved} / ${m.counts.total}  ·  ${countsLine(m)}`, "");
  out.push("## Results", "", "| Target | Status | Answer | Source |", "| --- | --- | --- | --- |");
  for (const it of m.items) {
    const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
    const src = it.url ? `[${host(it.url)}](${it.url})` : "—";
    out.push(`| ${cell(it.label)} | ${it.status} | ${cell(it.result || "—")} | ${src} |`);
  }
  out.push("");
  if (m.narrative?.notes?.length) {
    out.push("## Notes", "");
    for (const n of m.narrative.notes) out.push(`- ${n}`);
    out.push("");
  }
  if (m.narrative?.takeaway) out.push(`**Takeaway:** ${m.narrative.takeaway}`, "");
  return out.join("\n");
}

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const BADGE: Record<string, string> = {
  done: "#0d9488",
  active: "#059669",
  inactive: "#dc2626",
  notfound: "#d97706",
  blocked: "#ea580c",
  error: "#dc2626",
};

/** Self-contained, light-theme HTML document for print / Save-as-PDF. Thumbnails are inlined
 *  (the tile screenshots are already base64 data-URLs) so the PDF renders offline. */
export function reportToPrintableHtml(m: ReportModel): string {
  const rows = m.items
    .map(
      (it) => `<tr>
      <td class="thumb">${it.screenshotUrl ? `<img src="${esc(it.screenshotUrl)}" alt="">` : ""}</td>
      <td><div class="label">${esc(it.label)}</div>${it.url ? `<a href="${esc(it.url)}">${esc(host(it.url))}</a>` : ""}</td>
      <td><span class="badge" style="background:${BADGE[it.status] ?? "#6b7280"}">${esc(it.status)}</span></td>
      <td class="answer">${esc(it.result || "—")}</td>
    </tr>`,
    )
    .join("");
  const notes = m.narrative?.notes?.length
    ? `<h2>Notes</h2><ul>${m.narrative.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`
    : "";
  const donut = donutSvg(m.counts.byStatus, (s) => BADGE[s] ?? "#6b7280", {
    size: 92,
    stroke: 13,
    center: String(m.counts.resolved),
    sub: `of ${m.counts.total}`,
    track: "#eee",
    label: `${m.counts.resolved} of ${m.counts.total} resolved`,
  });
  return `<!doctype html><html><head><meta charset="utf-8"><title>F.R.I.D.A.Y. report</title><style>
    * { box-sizing: border-box; }
    body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111; max-width: 820px; margin: 32px auto; padding: 0 24px; }
    h1 { font-size: 20px; margin: 0 0 4px; } h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: #555; margin: 24px 0 8px; }
    .task { color: #555; margin: 0 0 16px; } .headline { font-size: 15px; font-weight: 600; margin: 0 0 8px; }
    .counts { color: #555; font-size: 13px; margin: 0 0 20px; }
    table { width: 100%; border-collapse: collapse; }
    td { border-top: 1px solid #eee; padding: 10px 8px; vertical-align: top; }
    .thumb { width: 96px; } .thumb img { width: 88px; height: 55px; object-fit: cover; border-radius: 4px; border: 1px solid #eee; }
    .label { font-weight: 600; } a { color: #2563eb; text-decoration: none; font-size: 12px; }
    .badge { color: #fff; border-radius: 4px; padding: 2px 7px; font-size: 11px; text-transform: uppercase; }
    .answer { font-weight: 600; } ul { margin: 0; padding-left: 18px; } li { margin: 3px 0; }
    .takeaway { margin-top: 20px; padding-top: 12px; border-top: 2px solid #111; }
    .glance { display: flex; align-items: center; gap: 18px; margin: 0 0 20px; }
    .glance .counts { margin: 0; }
    @media print { body { margin: 0; } a { color: #111; } }
  </style></head><body>
    <h1>✦ F.R.I.D.A.Y. verification report</h1>
    <p class="task">${esc(m.task)}</p>
    ${m.narrative?.headline ? `<p class="headline">${esc(m.narrative.headline)}</p>` : ""}
    <div class="glance">${donut}<p class="counts">Resolved ${m.counts.resolved} / ${m.counts.total}  ·  ${esc(countsLine(m))}</p></div>
    <table><tbody>${rows}</tbody></table>
    ${notes}
    ${m.narrative?.takeaway ? `<p class="takeaway"><strong>Takeaway:</strong> ${esc(m.narrative.takeaway)}</p>` : ""}
  </body></html>`;
}
