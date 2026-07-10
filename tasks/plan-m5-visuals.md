# M5 — Report visuals (branch `phase-b-visuals`, stacked on PR #41)

Report visuals for the verification artifact. Branch off `phase-b-voice` (PR #41 head) so it
builds on the redesigned report modal + `use-friday` dispatch. Rebases onto main when #41 merges.

**Scope (locked with user 2026-07-09):** pass/fail donut + agent-authored Mermaid. NOT image
generation (decorative, not evidence — kept out of the verification report) and NOT queryReport
(bigger lift, deferred). Demo sequence: main (Phase A) → PR #41 changes → these expansions.

**Principle:** report visuals are *evidence* — generated from real run data, never decorative.

## Commit 1 — Pass/fail donut (always-on, zero deps, no voice needed)
- `lib/report.ts`: pure `donutSvg(byStatus, colorFor, opts)` → SVG markup string. ONE source of
  truth (React modal + printable-HTML export both call it, different color maps).
- `artifact-modal.tsx`: replace the thin `StatusBar` with `StatusDonut` (center = `resolved/total`).
  The existing colored counts band is the legend. Colors = tone → `var(--success|warning|error|neutral)`.
- `reportToPrintableHtml`: embed the donut (BADGE hex colors) so the PDF export gets it too.
- Verify: `tsc` green; open report in light + dark; PDF export shows donut.

## Commit 2 — Agent-authored Mermaid diagram (data-driven)
- `npm i mermaid` (dynamic-imported, code-split — no initial-bundle hit).
- `components/mermaid-diagram.tsx` (`'use client'`): dynamic `import('mermaid')`, `startOnLoad:false`,
  `securityLevel:'strict'` (model writes the source → prevent injection), theme from `resolvedTheme`.
  `try/catch` render → fallback (raw source + "couldn't render" note). Stable id via ref counter.
- `app/api/swarm/diagram/route.ts`: `generateObject` (mirror `/summary`), input `{task, results, hint?}`,
  output `{title, mermaid, kind}`. The MODEL picks the diagram type for the task (user's Q1 answer:
  "should depend on the query"). `rateLimit`, clamp, log.
- `lib/schemas.ts`: `DiagramRequestSchema` + `DiagramSchema`.
- `realtime-tools.ts`: `renderDiagram({title, mermaid})` tool. `friday-persona.ts`: one line on WHEN
  to draw (flow/hierarchy/relationships clarify — not for plain lists).
- `use-friday.ts`: `diagram` state; `renderDiagram` dispatch stores it + opens report. Expose it.
- `artifact-modal.tsx`: optional `diagram` prop → "Diagram" section (renders `MermaidDiagram`); a
  "Diagram" button that calls `/api/swarm/diagram` from report data (the no-voice demo path).
- `app/friday/page.tsx`: thread `diagram` + the button handler down.
- Verify: `tsc` green; button generates + renders a diagram from a finished run in both themes;
  malformed source hits the fallback, doesn't crash.

## Deferred (not this branch)
Image generation (revisit as a separate general-capability flex, not report furniture);
queryReport / talk-to-the-artifact; mermaid-in-PDF (on-screen only for now).
