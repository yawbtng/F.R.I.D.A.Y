# F.R.I.D.A.Y — Phase B Backlog (deferred features)

Captured 2026-07-01. This holds the good ideas we deliberately deferred so the Phase B
**demo vertical slice** stays tight. The core slice is planned separately (see the Phase B
plan doc). Nothing here blocks the demo; everything here is a real feature we intend to add.

## Locked decisions (context for everything below)

- **Voice stack: Vercel AI SDK realtime** (`experimental_useRealtime` + AI Gateway). Drop the
  unwired LiveKit scaffolding. Rationale: the swarm is client-driven, so voice + swarm live in
  the SAME browser — progress narration is a local event injection, no server round-trip.
  LiveKit stays the escape hatch only if a later phase needs phone/PSTN or shared multi-user rooms.
- **UI: one unified voice-first command-center** (FridayShell). Swarm grid is the center/hero.
  Keep `/swarm` as a no-voice deep link.
- **Build order: demo vertical slice first.** Voice → plan → narrate → iterate → "go" →
  swarm detonates → narrated live progress → narrated report.
- **Autonomy: narrate-and-confirm by default.** Read = automatic. Write / auth / spend /
  outbound = confirm every time. This IS the safety story.
- **Demo is read-only** (verification/lookup). No write/auth actions on camera.

---

## Deferred features (document now, build later)

### Report artifact upgrades
- **Annotated screenshots** — draw arrows/highlights on the source screenshot for a claim
  ("here's where it says *dissolved*"). Needs a provenance layer first (claim → screenshot +
  region). Higher value once `queryReport` exists. Size: M.
- **Export / send the report** — download PDF/MD (builders already exist), or email/Slack it.
  Outbound → confirm-gated. Size: S (export) / M (send).
- **Talk to the artifact (`queryReport`)** — voice follow-up answered from the finished results
  (RAG over our own report), agent highlights the row/source. Genre-first closer. Size: M–L.

### Browser act/write superpowers (the "operator" jump)
- **Form fill + submit** — apply, sign up, contact, book. Confirm-gated. Size: M.
- **Multi-step transactions** — add-to-cart, checkout, wizards. Confirm-gated. Size: M–L.
- **Dynamic UI** — dropdowns, date pickers, calendars, maps. Size: M.

### Acquire (files)
- **Download** (PDF/CSV/invoice/filing) → parse in-session. Size: M.
- **Upload** (attach a doc to a portal). Confirm-gated. Size: M.
- **Save page as PDF** — archive evidence for provenance. Size: S.

### Persistent auth — Browserbase Contexts
- **Authenticated sessions** — log in once, reuse the context across runs. Unlocks gated data
  no external API can reach ("check my account", "pull my dashboard"). Big trust surface →
  strictly confirm-gated, never on the recorded demo. Size: M.

### Geo / proxies
- **Browse-as-location** — "prices as if I'm in the UK", "available in Japan". Uses stealth +
  geo proxies we already have. Slick demo beat + real utility. Size: S–M.

### Monitor + schedule (the product jump)
- **Watch-for-change** — poll a page, detect a diff (price drop, restock, status flip, new
  filing). The atom of scheduling. Size: M.
- **Deploy-as-Function (cron/loop)** ⭐ — one click turns a saved run into a Browserbase
  Function on a schedule; re-runs the swarm and pings only on change. Turns the demo into a
  product a compliance team pays for. Deploy machinery already proven on the x-ratio project.
  Gotcha: `!`-negation in `.gitignore` silently empties the Function archive; Functions don't
  bypass plan caps. Size: L. **Strongest business/hiring signal — showcases the whole platform.**

### Reliability + trust
- **Human-in-the-loop takeover** — mid-run, hand the live view to the human for 2FA/captcha/
  judgment, then resume. Pure browser-native trust moment. Size: M.
- **Provenance / cross-verification** — every claim carries source URL + screenshot + which
  session found it; N-of-M sessions confirm the same fact ("verified by 3"). Credibility wedge
  with the Browserbase crowd. Size: M–L.
- **Session recording/replay as artifact** — "watch what each browser actually did". Size: S.
- **Escalation to Browserbase Agents** — hand stubborn/blocked tiles to a native Agent run.
  Parked from Phase A (Agents runs expose no sessionId → can't iframe live view yet). Revisit
  if the Agents API exposes sessions or we get beta credits. Size: M.

### Autonomy
- **Trust dial** — per-task setting: narrate-and-confirm (default) ↔ auto-run for cheap/repeat
  tasks. Builds on the existing "just run it" toggle. Size: S–M.

### Persistence
- **Convex-backed runs + transcripts** — save/list/resume runs, store the voice transcript,
  shareable public run links + hosted (non-base64) screenshots. Convex is already wired for the
  workspace shell and graceful-degrades; this is where it earns its keep. Size: M.

---

## Guardrail (applies to every write/auth/spend/outbound feature above)

Read is automatic. Everything that changes state in the world — submit, login, checkout,
upload, download-and-send, schedule, spend — passes through narrate-and-confirm. One rule.
