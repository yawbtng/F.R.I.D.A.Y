# Friday - VBA: Issue Tracker

> Auto-generated from PRD. Track progress here. GitHub issues are source of truth.

## Phase 1: Scaffold + Stagehand (Due: Mar 10) ✅
- [x] #1 — Scaffold pnpm workspace + Next.js app + shadcn
- [x] #2 — Core libraries: stagehand singleton, schemas, auth, rate-limit, screenshot
- [x] #3 — POST /api/session — create/resume Browserbase sessions
- [x] #4 — Browser API routes: navigate, act, extract, observe, screenshot
- [x] #5 — POST /api/browser/search — Exa web search (changed from Google)
- [x] #6 — **GATE**: Build test page → type URL → see screenshot
- [x] #7 — Unit tests for all API routes (33 tests)
- [x] #8 — Integration test: real Browserbase flow (5 tests, skipped without INTEGRATION=true)

## Phase 2: LiveKit Agent Worker (Due: Mar 17) ✅
- [x] #9 — Scaffold agent package + defineAgent + VAD prewarm
- [x] #10 — Agent core: friday-agent, agentFetch, convex-client
- [x] #11 — Agent tools: navigate, act, extract, observe, screenshot, web_search
- [x] #12 — Voice pipeline: STT + LLM + TTS configuration
- [x] #13 — LiveKit token API + cloud setup
- [x] #14 — Frontend LiveKit: room connection + visualizer + transcript
- [x] #15 — **GATE**: Build passes, 45 tests pass — needs E2E with real keys
- [x] #16 — Agent tests: smoke + tool unit tests (12 tests)

## Phase 3: Convex Persistence (Due: Mar 21)
- [x] #17 — Convex setup + schema
- [x] #18 — Convex mutations/queries
- [x] #19 — Convex integration: provider, saving, screenshots
- [x] #20 — Session sidebar + command feed
- [ ] #21 — **GATE**: Refresh page → session history visible

## Phase 4: Polish + Browser Preview (Due: Mar 26)
- [x] #22 — Browser preview: iframe/screenshot + fake chrome
- [x] #23 — 3-column layout shell
- [x] #24 — Audio orb visualizer
- [x] #25 — Example commands + dark theme + design tokens
- [x] #26 — Framer Motion animations + responsive
- [x] #27 — Loading states, error states, session export
- [ ] #28 — **GATE**: UI is demo-quality

## Phase 5: Deploy + Demo Prep (Due: Mar 30)
- [x] #29 — Landing page
- [ ] #30 — Deploy Convex + agent worker
- [ ] #31 — Deploy Next.js to Vercel
- [ ] #32 — README + .env.example
- [ ] #33 — Production testing + demo rehearsal
- [ ] #34 — **GATE**: Ship it

## Dependency Chain (critical path)
```
#1 → #2 → #3 → #4 → #6 (Phase 1 gate)
                  ↓
#9 → #10 → #11 → #12 → #14 → #15 (Phase 2 gate)
         ↓        ↓
        #13      #16
                  ↓
#17 → #18 → #19 → #20 → #21 (Phase 3 gate)
                          ↓
#22 → #23 → #25 → #26 → #28 (Phase 4 gate)
       ↓          ↓
      #24        #27
                  ↓
#29 → #30 → #31 → #33 → #34 (Final gate)
              ↓
             #32
```

## Lessons Learned
- **Be explicit about tool limitations**: If user asks to use an external tool (like `ao`) that I can't execute, say so immediately. Don't silently substitute with a different mechanism. Explain the tradeoff and let the user decide.
- **Don't fake familiarity**: Knowing about a tool ≠ having access to it. Acknowledge the difference upfront.

---

## ⚠️ Post-merge verification — PR #43 (merged 2026-09-22, `fca8358`) — NOT DONE

**Merged deliberately without live testing.** 236 unit tests pass and `tsc` is clean,
but **nothing on this PR has been run against a real Browserbase session or a real
mic.** The four recovered commits were live-verified back on 2026-08-02 (8-company
KYB, 8/8 active in ~23-34s, twice, 18.8s proxy-free); the **six fix commits are
hand-traced only.**

Run these before recording any demo. Per the testing policy, capture output to a
file so each run leaves a repeatable artifact.

### Headless — `apps/web/scripts/verify-plan.ts` (same `runTarget` path as the grid)
- [ ] **KYB doubled legal suffix.** A target labelled `"Church & Dwight Co., Inc."`
      must come back **active**, not notfound. This was the demo-critical bug in
      `26c377f` — `entityOf` stripped one suffix, EDGAR didn't match the fragment,
      and KYB skips the retry, so the report confidently called an S&P 500 company
      unregistered. Also spot-check `Deere & Company` and
      `Brookfield Renewable Partners L.P.`
- [ ] **`subject` fallback.** A fact plan where the planner omits `subject` must
      still route off the label exactly as before (`2af1afc`). The LLM will omit it.
- [ ] **Split attempt budget** (`f61c9cd`). A target whose agent runs long must still
      get its extract — previously one `AbortSignal` covered both calls, so an agent
      returning at 51s handed the extract 4s and a found answer became an error.

### Needs a browser + dev server (UI-state timing — cannot be verified headless)
- [ ] **Second run without New Session** (`78946bc`, `621014e`). Run A (8 targets) →
      completes → run B (3 targets). Expect: full pill stream, FRIDAY *speaks* the
      result, run B appears in the sidebar with **its own** narrative. Before the fix
      run B was silent and never saved.
- [ ] **Stealth retry** (`621014e`). Finish a run with blocked tiles → click the
      shield. Expect pills + a spoken finish. Before: total silence, forever.
      ⚠️ Also confirms the proxy cost path — a retry over N blocked tiles spawns
      **N metered residential sessions** ($12/GB). Deliberate; know it before clicking.
- [ ] **Session release on tab close** (`f61c9cd`). Start a run, close the tab
      mid-flight, confirm sessions actually end rather than sitting for 300s.

### Known-open, unrelated to this PR
- [ ] Unresolved #1 — **voice never triggers execution.** Root-caused, reproduced
      twice, untouched by this PR. Needs live mic work.
- [ ] Unresolved #3 — **no proxies** is an infra/billing decision, not a code fix.
- [ ] `factGoal`'s no-article mitigation is prompt-level and **unprobed**; `subject`
      is the durable fix, the prompt is only the net when the planner omits it.
