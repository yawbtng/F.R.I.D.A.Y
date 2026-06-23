# F.R.I.D.A.Y. v2 — Voice-Commanded Browser Swarm

> Supersedes the original 5-phase build (`tasks/todo.md`), which is ~85% done (single-browser).
> **Strategic goal:** get noticed/hired by Browserbase. The uniquely-Browserbase thing is parallel
> cloud browsers on demand, so the SWARM is the headline and voice is garnish added after.
> CEO review: `~/.gstack/projects/yawbtng-F.R.I.D.A.Y/ceo-plans/2026-06-21-friday-swarm.md`

## Locked decisions (CEO review, 2026-06-21)
- **Sequencing: SWARM-FIRST.** Prove the multi-browser headline + record the clip BEFORE adding voice.
- **Killer task:** **50-state business-entity verification across Secretary-of-State registries.**
  "FRIDAY, verify Acme Corp across all 50 states" → fan out across 50 genuinely-distinct SoS portals →
  registration status + officers + standing per state. Public, read-only, no API, real KYB/compliance
  pain. Chosen over nurse-license verification because Nursys consolidates most nursing boards into ONE
  site, which kills the "50 distinct portals" visual. SoS registries are genuinely 50 separate portals.
- **Demo scale:** Developer tier ($20, 25 concurrent). Hero clip ≈ **20 browsers**. Narration says the
  real number. Grid may show up to 50 tiles; un-built states render as "unsupported/not-found."
  (Optional later: upgrade to Startup $99 for a 50-wide finale recording, then downgrade.)
- **Voice:** gpt-realtime *inside* LiveKit (swap the model, keep WebRTC/turn/interruption/frontend).
- **Expansions in scope:** mission-control grid HUD · live plan tree (visual reveal) · graceful
  partial-failure · shareable Browserbase replay link.

## Architecture decisions (from adversarial spec review, 6/10 → fixed)
- **Navigation = config-first, LLM-fallback.** Per-state adapters in a `states.json` registry drive
  fast/reliable navigation; Stagehand LLM `act/extract` is the fallback for un-templated states. The
  "orchestrator" is a fixed fan-out over the registry, NOT free-form LLM planning.
- **Worker contract:** input `{ state, entityName }` → output
  `{ state, status: 'active'|'inactive'|'notfound'|'error', details?, raw, ms }`. Synthesis aggregates these.
- **Recorded clip is the PRIMARY deliverable** (not a guaranteed-live run). Live runs use a pinned
  set of known-good boards verified minutes before + cached last-good results so a flaking board
  degrades to a prior good state instead of showing red on camera.
- **Measure real fan-out latency on ~10 states in Phase 1** before committing to any "N seconds"
  narration. If LLM rate-limit backoff makes it slow, the time claim changes, not the demo.

## Research-grounded facts
- **Swarm:** 1 Stagehand = 1 session. N browsers = N Stagehand instances. Create via `bb.sessions.create`,
  attach `browserbaseSessionID`, per-session live view via `bb.sessions.debug(id).debuggerFullscreenUrl`
  → iframe grid. No official pool — roll a `Map<browserId,{stagehand,liveViewUrl,status}>` registry.
- **Plan prerequisite (BLOCKING):** Free = 3 concurrent / 15-min / no keepAlive (caused the prior 402).
  Developer ($20, 25 concurrent) = the floor for the ~20 demo. Startup ($99, 100) for a 50-wide finale.
- **Bottleneck is LLM rate limits**, not Browserbase. 20-50 concurrent `.act/.extract` = bursty LLM.
  Concurrency cap + backoff/retry required; measure its latency cost early.
- **gpt-realtime via LiveKit:** `@livekit/agents-plugin-openai@1.4.8` (pin core to exact 1.4.8).
  `new openai.realtime.RealtimeModel({ voice:'marin' })` as `AgentSession.llm`; drop stt/tts/vad.
  Tools transfer unchanged. `session.say()` → `session.generateReply({ instructions })`. silero VAD
  no longer needed (server-side semantic_vad). `OPENAI_API_KEY` required.

---

## Phase 0 — Re-baseline (prove the current single-browser loop works) — GATE
> Status (2026-06-23, branch `feat/swarm`): repo moved into `Browserbase/projects/F.R.I.D.A.Y`.
> Automated baseline GREEN. Remaining items are human-gated (wallet + live boot).
- [x] `pnpm install` clean · `pnpm test` green (45/45, 5 integration skipped) · `pnpm build` green.
- [x] Bitrot fixed: agent `tsc` emitted non-portable Convex `.d.ts` (TS2742) + leaked JS into
      `convex/`. Set agent build to typecheck-only (`noEmit`) — it runs via `tsx`, dist unused.
- [x] **Browserbase upgraded** (2026-06-23) — live swarm runs unblocked.
- [x] Browser plumbing verified LIVE: keepAlive create→reattach→navigate→screenshot works on the
      upgraded tier (`apps/web/scripts/smoke-browserbase.ts`, PASS 2026-06-23). ⏭ full voice loop
      (LiveKit/Convex) still needs a 3-process manual smoke — deferred to Phase 3 (voice is garnish).

## Phase 1 — The Swarm (headline, text-driven) — THE Browserbase moment
- [ ] **PRE-TASK (do first): build `states.json` adapter registry** for a committed curated subset of
      8-12 genuinely-distinct, stable, no-CAPTCHA SoS portals (e.g. CA, TX, NY, DE, FL, WA, CO, IL...).
      Each adapter: `{ state, searchUrl, inputFields, resultSelectors|extractPrompt, antiBotFlag }`.
- [x] **Kill the singleton (Lane A foundation, done):** `agent-fetch.ts` is now stateless per-worker
      (`AgentContext {sessionId, token, signal?}`, own AbortController, 30s timeout); `_browserSessionId`
      → per-process voice context. 47 tests green incl. concurrent-fetch regression. ⏭ Browser
      *registry* + `browserId` routing still to come with `/api/fleet`.
- [x] **`/api/fleet` built:** POST spawns N sessions (batched, cap 25) → `{browserId,sessionId,
      liveViewUrl,token}`; DELETE closes one. Shared `createBrowserSession()` helper — spawn flow
      verified live via the keepAlive smoke. ⏭ retry/backoff on LLM rate limits.
- [x] **Fan-out orchestrator built:** `runSwarm` over a capped worker pool → each worker returns the
      `{state,status,details?,raw,ms}` contract → aggregate `SwarmResult`. ⏭ live worker (navigate+extract).
- [x] **Graceful partial-failure done:** a throwing/timing-out worker → status `error`; swarm returns
      "X of N", flagged, never crashes (CRITICAL test #2 green). ⏭ retry + cached last-good fallback.
- [ ] **Mission-control grid HUD:** live-view iframe tiles; light up on activity, gray out on failure;
      per-tile result badge (Active/Inactive/Not found).
- [ ] **Live plan tree:** visual reveal of the states being checked (not a real planning subsystem).
- [ ] **Measure latency** on ~10 states; set the narration number from reality.
- [ ] **Verify (GATE):** one text command → ~20 browsers fan out → grid lights up → synthesized
      result. **Record the hero clip here.** Primary deliverable, even if everything after stalls.

## Phase 2 — Shareable proof
- [ ] **Shareable Browserbase replay link** of a swarm run + polished grid screen-capture to DM Browserbase.
- [ ] HUD polish: FRIDAY HUD aesthetic, counts, timing ("18/20 in Ns vs ~hours manual").

## Phase 3 — Voice (the F.R.I.D.A.Y. hook, on a proven swarm)
- [ ] Bump `@livekit/agents` + `-plugin-openai` to matched 1.4.8; add `OPENAI_API_KEY`.
- [ ] Swap cascade for `RealtimeModel` as `AgentSession.llm`; remove silero VAD.
- [ ] Migrate `session.say()` → `generateReply()`; handle always-present `abortSignal`,
      `turnHandling.turnDetection`, 20-min `maxSessionDuration` reconnect.
- [ ] Voice UX: announce plan → work while grid updates → speak synthesized result.
- [ ] **Verify:** one *spoken* command → swarm → spoken synthesis.

## Phase 4 — Deploy + demo-day
- [ ] Finish gates #21 (session history) and #28 (UI demo-quality).
- [ ] Deploy: Convex + agent worker (#30), Vercel (#31), README/.env (#32), prod rehearsal (#33-34).
- [ ] Final demo recording + write-up.

## Open prerequisites / risks
- **Browserbase Developer upgrade** — blocking for the swarm.
- **SoS portal flakiness / anti-bot:** Browserbase proxies/stealth + curated subset + cached last-good
  + recorded clip as primary deliverable. Never bet the demo on a guaranteed-live gov-portal run.
- **LLM rate limits** at fan-out — concurrency cap + backoff; measure its latency cost early.
- **Cost:** ~20 browsers + per-action LLM (+ realtime audio later). Cap it; fine for a demo.
- **Legal/ToS:** READ-ONLY lookups only. No write actions on government portals.

## NOT in scope
- Write actions on gov/third-party portals (filing, FOIA, applications) — ToS/optics risk.
- Replacing LiveKit transport (gpt-realtime is a model inside LiveKit, not a teardown).
- Making all 50 states actually resolve — diminishing returns; tile count carries the visual.
- Multi-user / full production hardening beyond the demo.
- Phase-2 bonus tools (math, github, exa-answer).


## Architecture locked (eng review, 2026-06-22)
- **Per-worker context object.** Remove the three module globals in `agent/src/lib/agent-fetch.ts`
  (`currentAbortController`, `sessionToken`, default 10s timeout) AND `_browserSessionId` in
  `shared.ts`. Thread `{ sessionId, token, abortController }` through each tool/worker. "Interrupt"
  = cancel the whole fleet (abort all controllers), not abort-the-last-fetch.
- **Per-worker timeout ~30-60s** (was 10s) so multi-step state-board lookups finish.
- **Orchestration: local-first.** Build the capped `Promise.all` orchestrator; record the hero clip
  running locally (no Vercel serverless duration cap). Defer deployed long-running-Node to Phase 4.
- **Drop `keepAlive` for fleet sessions** (`stagehand.ts:25`) — swarm workers are short-lived;
  keepAlive is a higher-tier feature and unneeded per run.
- **Concurrency cap** (~5-8 concurrent Stagehand calls, `p-limit`-style) + backoff for LLM rate limits.
- **Tests (0/14 new paths covered).** Write first, no skipping: (1) concurrent fetches don't abort
  each other [REGRESSION, CRITICAL], (2) partial failure → "X of N" no crash [CRITICAL], (3) single-
  browser path still works [REGRESSION]. Table-driven adapter parse tests. Keep all 45 existing green.
  Test plan: `~/.gstack/projects/yawbtng-F.R.I.D.A.Y/yawbt-main-eng-review-test-plan-20260622.md`.

## Parallelization (worktrees)
- Lane A: `agent-fetch.ts` + `shared.ts`/registry refactor (foundation — must land first).
- Lane B: `states.json` adapters (independent; the long pole — can start immediately in parallel).
- Lane C: grid HUD frontend (independent of A/B until wiring).
- Order: A and B and C in parallel; orchestrator + wiring after A lands.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | 8 proposals, 8 accepted, 3 deferred |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | issues fixed | 5 found, 5 fixed (Claude fallback; no codex) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 3 issues (1 P0 caught), 0 critical gaps unresolved; 14 test paths specced |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**CODEX:** unavailable on this machine; adversarial passes ran via Claude subagent.
**UNRESOLVED:** 0
**VERDICT:** CEO + ENG CLEARED — architecture locked, ready to implement (Phase 0 → Phase 1).
The HUD is real UI scope — consider /plan-design-review before building the grid.
