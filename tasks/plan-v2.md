# F.R.I.D.A.Y. v2 — Voice-Commanded Browser Swarm

> Supersedes the original 5-phase build (`tasks/todo.md`), which is ~85% done (single-browser).
> **Product thesis:** the uniquely-Browserbase capability is parallel cloud browsers on
> demand, so the SWARM is the headline and voice is the interface layered on after.

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
- [x] **`states.json` adapters + live worker (DE/CA/NY) built.** Config-first adapters (searchUrl +
      NL search/extract instructions); `makeStateWorker` drives navigate→act→extract via agentFetch;
      `mapStatus` normalizes to active/inactive/notfound. Model routed via **Browserbase Model Gateway**
      (Stagehand 3.6.0, plain `openai/gpt-4.1-mini` slug + BB key — old xai/grok+OpenRouter never worked
      for extract). ⏭ expand to 8-12 states. **BLOCKED: gateway plan usage (billing, not code).**
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
- [x] **Mission-control grid HUD built** (branch `feat/grid-hud`): `/swarm` page spawns a fleet and
      fans out one Stagehand agent + structured extract per state, lighting each browser-chrome tile
      live (Queued → Working pulse → Active/Inactive/Not found/Error + timing badge), with X/N + elapsed
      header. **Client-driven** (no backend orchestrator) so it deploys to Vercel unchanged; web-owned
      adapter copy in `apps/web/lib/sos-adapters.ts`. Per-IP rate ceiling raised on fan-out routes.
      ⏭ click-to-expand WebPreview view (Phase 2 polish); verify the grid visually + at scale.
- [x] **Focus modal + auto-close** (2026-06-23): click any tile → live/frozen `BrowserModal`; on each
      worker completing, capture a final screenshot, freeze the tile to it, then release that session.
- [x] **Session-release bug fixed (CRITICAL):** keepAlive sessions survive `stagehand.close()`, so DELETE
      was leaking RUNNING (billing) sessions — 13 found alive, which also tripped the 25-cap → spawn 429.
      `releaseBrowserSession()` (REQUEST_RELEASE) on DELETE + idle cleanup. Verified 0 RUNNING after a
      20-state run. See [[stagehand_keepalive_release]].
- [x] **Reliability + portals:** sharpened agent goal (accept terms gates, wait for results, best active
      match) + `maxSteps` 14→25; registry expanded to **20 status-public states**. Baseline (Walmart Inc.):
      **13/20 definitive** (CA FL NY CO NC PA WA MA MN OR TN AZ active; GA flagged wrong-match).
- [x] **`Blocked` status** (CAPTCHA/anti-bot/unreachable) + sharper "stop on block" goal: IL/OH/NV now
      report `blocked` honestly AND fast (NV 115s→11s) instead of a misleading `notfound`. Net 20-grid:
      ~13 verified + 3 blocked + 4 flaky (MI VA CT UT). ⏭ retry-on-notfound for the flaky 4;
      search-discovery (Exa) for true autonomy; Browserbase session **replay** in the focus modal.
- [x] **Session replay** (Phase-2 artifact, pulled early): click a completed tile → Browserbase HLS
      replay via hls.js (rrweb /recording is deprecated; proxy /replays .m3u8). Screenshot = poster.
- [x] **AI verification report** (Phase-3 artifact, pulled early): end-of-run "✦ Report" → Vercel AI SDK
      → OpenRouter synthesizes a KYB findings summary; counts pre-computed server-side. Verified live.
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


## Target UX flow (voice agent — the full agentic loop; user vision 2026-06-23)
End-state product. Expands Phase 3 from "voice triggers fleet" into a collaborative loop:
1. **User speaks the task** — LiveKit / gpt-realtime.
2. **Agent researches & plans** — LLM (+ Browserbase Search/Exa for open-ended tasks) → a structured
   plan object `{ task, targets[], perTargetAction, expectedOutput }`. Dispatch-level planning decides
   *scope* (= how many browsers); execution stays the deterministic fan-out.
3. **Speaks back + shows plan in UI** — `generateReply` narrates; a Convex-backed plan panel renders it.
4. **User accepts or edits** (voice or text) — confirmation gate; "add Texas, drop Hawaii" patches the
   plan. This is the cost/safety valve — nothing spawns until approved.
5. **Live updates as it runs** — workers write per-step status → Convex → UI subscribes + voice narrates
   milestones. (Orchestrator must STREAM progress, not just return at the end.)
6. **User watches the swarm** — mission-control grid (live-view tiles).
7. **Agent returns an artifact** — synthesize `SwarmResult` → report (findings / per-target status /
   blockers) + shareable link. The deliverable.

Rule: **plan at the dispatch layer, execute deterministically.** Convex is the spine for plan state (3),
live progress (5), and the artifact (7). Pull the plan-object + Convex progress streaming earlier (the
grid/clip use them too).

## Concurrency / scale — HARD CAP 25 (this plan)
- Browserbase plan = **25 concurrent sessions max** (not 50). `FleetSpawnSchema` already caps at 25.
- A 50-state task runs in **waves of ≤25** (orchestrator concurrency cap queues the rest). Hero clip ≈
  20 simultaneous browsers (within cap). Grid may show up to 50 tiles with ≤25 live at once.
- LLM throughput is now the **Model Gateway** (server-side on Browserbase), so OUR OpenRouter rate limit
  is no longer the bottleneck — set orchestrator concurrency ~20-25 for the demo visual (was ~5-8 when we
  used our own key). Browserbase meters gateway usage; the 25-session cap is the real bound.

## Next iteration (2026-06-23) — make a worker actually read a portal (THE long pole)
Live swarm is proven end-to-end (Model Gateway, X-of-N, parallel); the gap is the per-portal search.
1. **DIAGNOSE**: after submit, capture screenshot + full-page text on DE/CA to see why `notfound`
   (terms gate / anti-bot / SPA results not loaded / wrong field). Can't guess gov-portal quirks.
2. **FIX (pref order)**: per-worker Stagehand `agent` (autonomous, robust; needs `/api/browser/agent`)
   → per-portal act tuning (waits/observe) → curate easiest portals (some allow URL-query search).
3. Get ONE portal fully green (real active/inactive/notfound for known entities), then replicate to 8-12.
Then: grid HUD → record hero clip → shareable proof → voice agentic loop (above) → deploy.

## Demo strategy (CEO review, 2026-06-24) — STEALTH HERO-BEAT chosen
**Use case stays KYB-across-states** (no API, public, read-only, genuinely N sites) but pitch the
**capability**: "point an agent swarm at any fragmented no-API sites, get structured answers fast, in
parallel, watchable, with replay + honest provenance." Audience = a Browserbase eng/founder; the demo
must make their product look indispensable.

**Riskiest assumption tested + validated:** does Browserbase stealth clear blocked states?
- Stealth = `browserbaseSessionCreateParams: { proxies:true, browserSettings:{ solveCaptchas:true } }`.
- Results (Walmart Inc.): **OH blocked→active, MI notfound→active, NV blocked→active (probabilistic)**;
  VA/CT notfound→blocked (honest reclassification); IL stays blocked (HTTP2 broken site — DROP it); UT notfound.
- So stealth flips real walls green AND corrects misleading "notfound" → "blocked". Partial recovery is a
  BETTER story than a clean pass (credibility > magic).

**Built:** `createBrowserSession({stealth})` + `/api/fleet` stealth param + **"Retry blocked w/ stealth"**
button on `/swarm` (re-runs unresolved tiles on fresh stealth sessions; anti-bot tiles flip green live).
See [[stagehand_keepalive_release]] sibling note in [[friday_swarm_plan]] for stealth efficacy.

**The clip recipe (beats):** type "verify Walmart Inc. across 20 states" → 20 cloud browsers spawn in
parallel (the wow) → most resolve Active, a few go Blocked (anti-bot) → **"watch Browserbase stealth"** →
Retry blocked w/ stealth → tiles flip green (truly-hard one stays honestly blocked) → click a tile → full
session **replay** → **✦ Report** AI KYB summary → "~60s vs an afternoon by hand."

**Before recording (curation pass):** drop/replace IL (broken), fix GA wrong-match, optional 50-tile
finale (bump to Startup tier for one recording). Voice loop (Phase 3) = the follow-up touchpoint, not v1.
