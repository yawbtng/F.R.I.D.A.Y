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
- [ ] P0: Commit the 5 pending voice fixes (persona/date, New Session reset,
      user turns in mission log, planTask desc) on phase-b-visuals
- [ ] P1: Headless voice truth probe (apps/web/scripts/probe-realtime.ts):
      connect like the browser, send session-update + tools, assert
      (a) config ack/error events, (b) correct today's-date answer,
      (c) "verify Tesla" → planTask tool call. No mic needed.
- [ ] P2: Fix voice per probe evidence — surface error events in use-voice;
      fix config delivery; else text-brain router architecture
- [ ] P3: Swarm reliability — fast CAPTCHA/blocked detection (no 45s grind),
      guard awaitActivePage null crash, gate Convex persistence noise
- [ ] P4: End-to-end demo dry-run (proxies ON for that run only), then record

## Review
(to fill as phases land)
