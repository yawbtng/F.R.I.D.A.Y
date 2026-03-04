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
