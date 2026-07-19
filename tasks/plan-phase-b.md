# Phase B — Voice + Unified Command-Center (demo vertical slice)

## Context

Phase A shipped a client-driven general-purpose swarm (`/swarm`): free-form task → LLM plans
targets → fleet of Browserbase sessions fan out → structured report. Phase B makes it
**Jarvis for browser agents**: you *speak* a task, F.R.I.D.A.Y plans it, you iterate by voice,
say "go", ~15 cloud browsers detonate across the screen while it narrates live, then it talks
you through the report. One voice → many hands → one answer.

This plan is the **demo vertical slice**: the full path working end-to-end for one hero task,
built well. Deferred capabilities live in `tasks/phase-b-backlog.md`.

## Locked decisions

- **Voice: Vercel AI SDK realtime** (`experimental_useRealtime` + AI Gateway, model `openai/gpt-realtime`).
  Drop the unwired LiveKit scaffolding. The swarm is client-driven, so the realtime session lives
  in the SAME browser as the swarm — live narration is a local event injection, not a server hop.
- **UI: one unified voice-first command-center.** FridayShell becomes the app; the swarm grid is
  the center/hero. `/swarm` stays as a no-voice deep link.
- **Voice mode: always-listening**, server-VAD, **barge-in** (talk over the narration to redirect).
- **Plan editing: full conversational** — add/remove/reorder targets, rewrite goals & extracts by voice.
- **Autonomy: narrate-and-confirm.** Read = automatic. Demo is **read-only** (no auth/writes on camera).
- **Report visuals: Charts + Mermaid** (both from data the swarm already extracts). Annotated
  screenshots deferred.
- **Hero task: KYB list** — "verify these ~15 businesses are real & active." Planner path
  (each company = one tile that finds its own registration record), with a seeded demo-mode run.

## Architecture

```
        ┌──────────────────────── USER'S BROWSER ────────────────────────┐
        │                                                                 │
  mic ──┼─▶ useRealtime (WebSocket ⇄ gpt-realtime via AI Gateway)         │
        │        │  speech in/out, server-VAD, barge-in                   │
        │        │                                                        │
        │        ├─ onToolCall ─▶ planTask / updatePlan / runSwarm /      │
        │        │                getReport / stopSwarm / focusTile /     │
        │        │                chartFromData / mermaidDiagram          │
        │        │                        │                               │
        │        │                        ▼                               │
        │        │                 useSwarm (Phase A engine)              │
        │        │            spawn fleet → runTarget ×15 → report        │
        │        │                        │                               │
        │        ◀── event bridge ────────┘  (tile changes → inject       │
        │        │   "Acme active, 3 left" → agent narrates proactively)  │
        │        ▼                                                        │
        │   FridayShell: swarm grid (center) · transcript/orb · scoreboard│
        └─────────────────────────────────────────────────────────────────┘
              only /api/realtime/token + /api/swarm/* hit serverless
```

Two facts drive the whole design:
1. **A realtime tool call must return in seconds; a swarm run takes minutes.** So `runSwarm`
   returns a `runId` instantly and NEVER awaits the run.
2. **The swarm state lives in the same browser as the voice session.** So progress narration is
   an event injected into the realtime session from `useSwarm`'s live tiles — no polling a server.

## Review refinements (self-applied 2026-07-03, Garry Tan pass)

- **M0 gate (NEW, front):** before any app code, validate the realtime API surface against the
  actually-installed packages. If `ai@7`/`experimental_useRealtime` don't exist as described OR
  the v7 bump breaks the Phase A swarm routes, **fall back to OpenAI Realtime direct** (WebRTC +
  ephemeral token) — no v7 required. Do not rewrite the plan; swap the transport only.
- **Orchestrator seam:** one `hooks/use-friday.ts` composes `use-voice` + `use-swarm`, owns the
  `onToolCall` dispatch table + event bridge. Pages stay thin.
- **Event bridge:** coalescing throttled queue — batch tile changes, flush only when NOT mid-user-turn.
- **`updatePlan` schema:** explicit discriminated union `add | remove | reorder | modify(id, fields)`.
- **No planner fork:** KYB-list is a system-prompt variant of `/api/swarm/plan`, not a new route.
- **LiveKit removal:** decouple orbs to a plain `VoiceState` enum; delete only transport/room/token.
- **Tests:** unit-test tool dispatch (pure args→useSwarm) + event-bridge coalescing (fake timers).
- **v7 regression gate = the FULL existing vitest suite**, not just verify-plan. All green or fall back.

## Build (milestones — each independently verifiable + committable)

### M1 — Voice plumbing, isolated (de-risk the beta first)
- Bump AI SDK **v6 → v7 beta**; pin exact versions. `npm i ai@7 @ai-sdk/react @ai-sdk/gateway`.
- **REGRESSION GATE:** immediately re-verify `/api/swarm/plan` + `/api/swarm/summary` still return
  structured output (`generateText` + `Output.object` may shift in v7). Run `verify-plan.ts`.
- CREATE `app/api/realtime/token/route.ts` — `gateway.experimental_realtime.getToken({ model })`,
  returns `{ token, url }`; key stays server-side. Env: `AI_GATEWAY_API_KEY`.
- CREATE `hooks/use-voice.ts` — thin wrapper over `experimental_useRealtime`: connect,
  `startAudioCapture`, status, messages, and an `onToolCall` dispatch table (empty for now).
- Verify: mic → talk → it talks back. Delete unwired LiveKit files (`voice-session.tsx`,
  `/api/token`, LiveKit deps). Commit.

### M2 — Tool loop on the existing `/swarm` engine (functional hero, no merge yet)
- Wire `onToolCall` handlers → `useSwarm`:
  - `planTask({task})` → POST `/api/swarm/plan`; return plan; agent narrates it.
  - `updatePlan({operations})` → mutate the in-memory plan (add/remove/reorder/rewrite goal+extract).
    **Full conversational editing** — operations are structured so voice edits map cleanly.
  - `runSwarm({stealth?})` → `useSwarm.run(targets)`; return `{runId}` immediately.
  - `getReport()` → return the structured report for discussion.
  - `stopSwarm()` → real abort (see M2b).
  - `focusTile({id|label})` → open the browser modal (voice points at the screen).
- KYB-list planner tuning: system prompt handles "verify these companies" (each company → one
  target: search for its official registration → extract active/inactive/not-found).
- Verify (headless-ish + live): speak companies → plan → edit by voice → "go" → runs → "what did
  you find" → narrates report. Commit.

### M2b — Real abort in `useSwarm`
- Today `useSwarm` has `reset()` (releases browsers) but no graceful mid-run cancel. Add
  `cancel()`: `AbortController` per target + fleet release, phase→`idle`, tiles marked stopped.
  `stopSwarm` tool calls it. Needed for barge-in "stop." Commit.

### M3 — Live narration event bridge (the "alive" beat)
- As `useSwarm` tiles change, push compact status events into the realtime session (inject a
  client event / conversation item) so the agent proactively says "Nevada came back clean, three
  left." Throttle to avoid chatter; respect turn-taking (don't talk over the user).
- Verify: run a swarm, confirm spoken progress updates track the grid. Commit.

### M4 — Unified command-center (the merge)
- Make `FridayShell` the app: center pane = the swarm grid (hero); overlay the voice orb +
  transcript; right panel (MissionLog) shows the live plan + scoreboard (running/done/failed,
  elapsed, "human-time saved"). Landing CTA → the shell. Keep `/swarm` as a no-voice deep link.
- Reuse: `useSwarm`, grid components, `friday-*`/`.glass` tokens, the AI Voice Elements avatar
  states (or existing shader orbs) for listening/thinking/speaking/working.
- Verify: full loop inside the unified shell, visually (Playwright). Commit.

### M5 — Report visuals
- `chartFromData` tool → a pass/fail donut + per-company status bars from the report data.
- `mermaidDiagram` tool → renders the plan/flow as a diagram in the artifact.
- Both feed the existing `ReportModel` / artifact modal. Verify visually. Commit.

### M6 — KYB-list hero + demo mode
- Curate ~15 companies that verify reliably; a seeded **demo-mode** run for deterministic camera
  takes (plus a real mode for skeptics). Wire the graceful-failure beat (a tile blocks → narrated
  as routine → optional stealth retry). Rehearse the 60–90s arc. Commit.

### Cross-cutting — agent persona / system prompt
- Instructions: KYB-verification-anchored but general; concise spoken style; always narrate the
  plan before running; confirm before any non-read action; know it can spin ~20 browsers.

## Verification

1. **Post-bump regression (M1):** `/api/swarm/plan` + `/summary` structured output intact.
2. **Headless loop where possible:** extend `verify-plan.ts` for the KYB-list task; confirm 15
   targets resolve + 0 session leaks (Browserbase shows 0 RUNNING after).
3. **Voice loop (manual):** speak → plan → voice-edit → go → live narration → report → follow-up.
4. **Barge-in:** talk over narration mid-run → it stops/redirects; "stop" aborts the fleet.
5. **Unified shell (Playwright):** the full loop renders in FridayShell; grid is the hero.
6. **Demo-mode determinism:** the seeded run lands the hero frame repeatably.

## Risks & mitigations

- **v7 beta churn** — pin versions; M1 regression gate; the bump is isolated on a branch.
- **Always-listening false triggers** — visible mic toggle + a "F.R.I.D.A.Y" address convention;
  demo-mode + rehearsal; fall back to hybrid PTT if it misfires on camera.
- **Narration turn-taking** — throttle event-bridge updates; suppress while the user is speaking.
- **KYB-list variance on camera** — seeded demo mode with vetted companies; graceful-failure is a
  *feature* beat, not a bug.
- **Realtime audio cost** — AI Gateway budgets/spend caps; keep sessions short.
- **The runId rule** — `runSwarm` must never await the run; progress comes from the client event
  bridge, not a blocked tool call.

## Out of scope (see `tasks/phase-b-backlog.md`)
Act/write, Contexts/auth, download/upload, geo, monitor, deploy-as-Function, human-takeover,
provenance/annotated screenshots, talk-to-artifact (queryReport), persistence/shareable runs,
export/send, escalation to Browserbase Agents, trust dial.

## Branch & commit cadence
New branch off `main` (e.g. `phase-b-voice`). Commit + push after each green milestone. Never
push broken state. `main` stays the merged Phase A demo until Phase B is proven.
```
