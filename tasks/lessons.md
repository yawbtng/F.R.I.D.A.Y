# Lessons

## "Reuse the existing shell" means MOUNT into it, not rebuild (2026-07-03)

**Mistake:** The locked Phase B plan said "FridayShell becomes THE app; swarm grid is the center."
When I speced the M4 build for a subagent, I wrote "CREATE a new page" with a single-column
layout. It produced a barebones `/friday` that silently dropped the whole command-center shell —
both sidebars (SessionSidebar, MissionLog) and the nicer aura orb. The user caught it immediately.

**Why it slipped:** `tsc` and unit tests were green the entire time — a missing shell is not a
type error. The verification gate (tsc + tests) can't see a visual/structural regression.

**Rules for next time:**
- When a plan locks "reuse component/shell X", the build spec must say **"mount the new logic
  INSIDE X and name the slots to fill"**, never "create a new page".
- Prefer a **non-breaking slot prop** (e.g. `FridayShell` gained optional `center` / `headerRight`)
  so the new surface renders through the existing shell and the old consumer is untouched.
- **Verify UI changes by actually rendering** (dev server + Playwright screenshot), not just tsc.
  A green typecheck told me nothing about the dropped shell.

## The LSP diagnostics in this repo LAG badly — trust a fresh `tsc` only (2026-07-03)

After dependency swaps / big edits, the injected editor diagnostics threw false "no exported
member" and "not assignable" / implicit-any errors 3+ times, each contradicted by a clean
`tsc --noEmit`. Always `rm -f apps/web/tsconfig.tsbuildinfo && npx tsc --noEmit -p apps/web/tsconfig.json`
and trust THAT, not the red squiggles. Subagents also claimed "tsc exit 0" while leaving real
errors — re-verify their typecheck claims yourself.

## A realtime model that MINTS a token can still be REST-only (WS-refused) (2026-07-04)

**Bug:** Voice connected then died in ~1s ("mic turns off after a second"). Root cause: the AI
Gateway serves `openai/gpt-realtime` over REST but **refuses it over WebSocket** — the upgrade
returns HTTP 400 `"Model openai/gpt-realtime is not available over WebSocket"`. Only
`openai/gpt-realtime-mini` was WS-available. Fix: `REALTIME_MODEL=openai/gpt-realtime-mini` (+ the
matching default in `use-voice.ts` and `api/realtime/token/route.ts`).

**Why it hid for so long:** the "live token mint VERIFIED" check only called `getToken()` — which
succeeds for ANY model id — and never opened the socket. Mint success is a false positive for
voice working. Also the AI SDK's `ws.onclose` throws away the close code/reason, so the browser
console shows nothing useful; you MUST replay the upgrade yourself to see the 400 body.

**Rules for next time:**
- To verify realtime voice headlessly, do the **WS upgrade** (expect 101), not just `getToken`.
  `apps/web/scripts/verify-realtime-token.ts` now does this and prints the WS status per model.
- "Verified" must name what was actually exercised. "Token mints" ≠ "socket opens" ≠ "speech gets
  a response." Don't let a green sub-check stand in for the real path.
- When a socket dies silently, reproduce the handshake in Node (global `WebSocket`, subprotocols
  `["ai-gateway-realtime.v1", "ai-gateway-auth.<token>"]`) or a raw `https` upgrade to read the
  real close code / 4xx body — the SDK swallows it.

## experimental_useRealtime rebuilds the session on any new options REFERENCE (2026-07-05)

**Bug:** Voice glitched, played two overlapping voices, and never completed a tool call (browsers
never spun up) even though it "responded." Root cause: `use-voice.ts` passed `sessionConfig` (and
`api`) as **inline object literals**. The SDK's `shouldCreateRealtimeStore` compares those by
reference (`currentKey.sessionConfig !== nextOptions.sessionConfig`), so every render — and the
hook re-renders constantly via `useSyncExternalStore` on messages/isPlaying/status — tore down the
live WebSocket + AudioContext and built a new one. Overlapping audio = old context still draining
while the new one starts; tool calls die because the session resets mid-round-trip.

**Fix:** `useMemo` the `api` and `sessionConfig` objects (deps `[instructions, voice]`, which never
change) so the realtime store is created ONCE per session. Type them via
`Parameters<typeof experimental_useRealtime>[0]["sessionConfig"]` so the memoized literal keeps its
narrowing (`server-vad`, modalities) instead of widening to `string`.

**Rules for next time:**
- Any object/array/function passed into a hook that keys off reference identity (realtime stores,
  SWR, effect deps) MUST be memoized or module-constant. Inline literals silently thrash.
- Symptom pattern to recognize: "it half-works, stutters, and long/async operations never finish"
  → suspect the session/connection is being recreated under you, not the operation itself.

## Realtime on laptop speakers self-triggers (echo) — constrain the mic, offer mute (2026-07-05)

The model's audio plays through a Web Audio `AudioContext` that the browser's echo-canceller has no
reference to, so on speakers the mic re-hears FRIDAY and server-VAD fires a new turn (talks over
itself). Mitigations shipped: `getUserMedia({ audio: { echoCancellation, noiseSuppression,
autoGainControl } })` + a real mute button (toggles `track.enabled`, session stays live). Barge-in
is intentionally kept, so headphones are still the cleanest for a recorded demo.
