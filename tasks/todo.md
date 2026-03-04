# Friday - VBA: Issue Tracker

> Auto-generated from PRD. Track progress here. GitHub issues are source of truth.

## Phase 1: Scaffold + Stagehand (Due: Mar 10)
- [ ] #1 — Scaffold pnpm workspace + Next.js app + shadcn
- [ ] #2 — Core libraries: stagehand singleton, schemas, auth, rate-limit, screenshot
- [ ] #3 — POST /api/session — create/resume Browserbase sessions
- [ ] #4 — Browser API routes: navigate, act, extract, observe, screenshot
- [ ] #5 — POST /api/browser/search — web search via Google + Stagehand
- [ ] #6 — **GATE**: Build test page → type URL → see screenshot
- [ ] #7 — Unit tests for all API routes
- [ ] #8 — Integration test: real Browserbase flow

## Phase 2: LiveKit Agent Worker (Due: Mar 17)
- [ ] #9 — Scaffold agent package + defineAgent + VAD prewarm
- [ ] #10 — Agent core: friday-agent, agentFetch, convex-client
- [ ] #11 — Agent tools: navigate, act, extract, observe, screenshot, web_search
- [ ] #12 — Voice pipeline: STT + LLM + TTS configuration
- [ ] #13 — LiveKit token API + cloud setup
- [ ] #14 — Frontend LiveKit: room connection + visualizer + transcript
- [ ] #15 — **GATE**: Speak "go to HN" → see screenshot → hear response
- [ ] #16 — Agent tests: smoke + tool unit tests

## Phase 3: Convex Persistence (Due: Mar 21)
- [ ] #17 — Convex setup + schema
- [ ] #18 — Convex mutations/queries
- [ ] #19 — Convex integration: provider, saving, screenshots
- [ ] #20 — Session sidebar + command feed
- [ ] #21 — **GATE**: Refresh page → session history visible

## Phase 4: Polish + Browser Preview (Due: Mar 26)
- [ ] #22 — Browser preview: iframe/screenshot + fake chrome
- [ ] #23 — 3-column layout shell
- [ ] #24 — Audio orb visualizer
- [ ] #25 — Example commands + dark theme + design tokens
- [ ] #26 — Framer Motion animations + responsive
- [ ] #27 — Loading states, error states, session export
- [ ] #28 — **GATE**: UI is demo-quality

## Phase 5: Deploy + Demo Prep (Due: Mar 30)
- [ ] #29 — Landing page
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
<!-- Add entries after corrections/mistakes -->
