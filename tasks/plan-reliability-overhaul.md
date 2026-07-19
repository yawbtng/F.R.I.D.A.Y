# Voice + Swarm Reliability Overhaul (2026-07-17)

Goal: voice actually drives browsers, swarm fails fast instead of all-erroring,
project becomes demo-recordable. Evidence-driven — root causes from the 07-17
test-run logs, not guesses.

## Audit evidence (from user's live test, dev log)
- Voice: no date awareness + zero tool calls from voice → instructions likely never
  reach the model. SDK sends `session-update` (camelCase) → Gateway translates
  server-side (opaque); our onEvent drops error events silently. Text path works
  because it bypasses the model.
- Swarm: 10× Cloudflare Turnstile hits on SoS registries (no proxies → blocked),
  6× `Cannot read properties of null (reading 'awaitActivePage')` crashes,
  45s act() timeouts, Convex ECONNREFUSED spam (not running locally).
- No billing errors — Browserbase plan fine.

## Decisions (user, 2026-07-17)
- Proxies: BB_PROXIES stays off by default; flip on ONLY for recorded demo runs.
- If probe proves gpt-realtime-mini can't decide when to plan even with
  instructions delivered → proceed directly to voice-I/O + text-brain architecture.

## Tasks
- [x] P0: Commit the 5 pending voice fixes (persona/date, New Session reset,
      user turns in mission log, planTask desc) on phase-b-visuals (b069e52)
- [x] P1: Headless voice truth probe (apps/web/scripts/probe-realtime.ts) —
      PROVED root cause: outputModalities ["audio","text"] is invalid →
      Gateway rejects the ENTIRE session.update atomically → model ran with
      OpenAI default persona, alloy voice, ZERO tools. With ["audio"] alone:
      config ACKed, persona + 7 tools land, and planTask fires on first ask.
      Model is capable — no text-brain rebuild needed.
- [x] P2: Fixed — use-voice.ts outputModalities → ["audio"]; error events now
      logged loudly in onEvent (they arrive post-"connected", where onError
      deliberately ignores them — that's why the rejection was invisible)
- [x] P3: Swarm reliability — DONE, live-tested (3 sessions, 0 left running):
      dead-session eviction in getStagehand + SESSION_LOST fail-fast in agent
      route (dead-session calls now settle in ~0.2-1.3s clean 500s vs endless
      null-crash 200s); nav-time BOT_WALL fingerprint + act-error sniffing →
      instant 'blocked' settle, extract pass skipped; isBlocked knows
      turnstile; Convex circuit breaker (one warning, then quiet)
- [ ] P4: End-to-end demo dry-run (proxies ON for that run only), then record

## Demo + public-repo prep (user scope, 2026-07-18)
Decisions: NO deploy (proxy + plan cost exposure); demo is recorded locally;
repo stays public; eve/Vercel integration explicitly out of scope.
- [x] README rewritten for the current product (swarm + realtime voice; old
      LiveKit-era README described an app that no longer matches)
- [x] .env.example corrected (REALTIME_MODEL=gpt-realtime-mini — old value
      400s the WS; added BB_PROXIES + model overrides; Convex marked optional)
- [x] LICENSE added (MIT, GitHub handle only — no personal name)
- [ ] Secrets/PII audit of FULL git history (repo is ALREADY public) — in flight
- [ ] Remediate audit findings (rotate keys / scrub if any)
- [ ] Merge the stack: #41 (phase-b-voice) → main, then #42 (phase-b-visuals)
- [ ] Record demo (proxies ON for that run only), embed in README, post

## Review
(to fill as phases land)
