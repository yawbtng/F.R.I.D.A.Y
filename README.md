# F.R.I.D.A.Y. 🎙️🌐

> **Say it once. Twenty browsers go do it.**

Most web work is the same lookup repeated across a dozen sites — verifying vendors, checking registrations, comparing prices. Humans do it one tab at a time. F.R.I.D.A.Y. does it in parallel: you **speak** a task, she plans the targets, fans out up to ~20 live cloud browsers with [Browserbase](https://browserbase.com), drives each one with [Stagehand](https://stagehand.dev), narrates progress as tiles come back, and hands you a report — pass/fail chart, an AI-drawn diagram, and a printable export.

The anchor use case is verification — *"are these 15 businesses real and active?"* — but the engine is general-purpose. One voice command, twenty browsers, one report.

<!-- DEMO VIDEO: embed here -->
> 🎬 **Demo video coming here.**

## What she can do

- **Voice-to-swarm**: "Verify these are real businesses: Tesla, Apple, Stripe…" → an LLM plans one target per browser → the fleet launches on your go-ahead
- **Live grid**: every browser is a real, watchable session — click a tile for the live view
- **Talk while it runs**: F.R.I.D.A.Y. narrates progress and answers questions mid-flight
- **Change your mind mid-run**: "actually, check Costco instead of Walmart" swaps **one** browser without restarting the rest
- **Report**: pass/fail donut, per-target findings, an agent-authored Mermaid diagram, print/PDF export
- **Fail-fast honesty**: CAPTCHA-walled sites settle as `blocked` in seconds instead of grinding; nothing is invented

## How it works

```
you speak ──▶ gpt-realtime-mini (Vercel AI Gateway, WebSocket)
                    │  tool calls (planTask / runSwarm / retargetTile / …)
                    ▼
             client dispatch (use-friday) ──▶ swarm engine (use-swarm)
                    │                                │ fan-out, client-driven
                    ▼                                ▼
             /api/swarm/plan (LLM planner)    N × Browserbase sessions
                                              driven by Stagehand v3
                                                     │
                    report ◀── /api/swarm/summary ◀──┘  (+ diagram, PDF export)
```

No backend orchestrator: the browser tab **is** the orchestrator. Each target is an independent short-lived API call chain (navigate → act → extract → screenshot → release). Voice is transport-only; tools execute client-side.

| Component | Technology |
|-----------|-----------|
| Cloud browsers | Browserbase (live view + session replay) |
| Browser driving | Stagehand v3 (`agent` + structured `extract`) |
| Realtime voice | Vercel AI SDK `experimental_useRealtime` → AI Gateway → `gpt-realtime-mini` |
| Planning / report / diagram | OpenRouter (GPT-4.1 family by default) |
| Web search | Exa (when a target has no known URL) |
| Frontend | Next.js 15 + Tailwind, theme-aware design system |
| Run history | localStorage (Convex optional) |

## Quickstart

**Prerequisites:** Node ≥ 20, [pnpm](https://pnpm.io/installation), and API keys for [Browserbase](https://browserbase.com), [Vercel AI Gateway](https://vercel.com/ai-gateway), [OpenRouter](https://openrouter.ai), [Exa](https://dashboard.exa.ai).

```bash
git clone https://github.com/yawbtng/F.R.I.D.A.Y.git && cd F.R.I.D.A.Y
pnpm install

cp .env.example .env
# fill in your keys — see comments in .env.example

pnpm --filter @friday/web dev
# open http://localhost:3000/friday — tap the mic and talk
```

`/friday` is the voice command center. `/swarm` is the same engine with a text box (no mic needed).

### Try saying

- *"Verify these are real registered businesses: Tesla, Apple, Stripe."*
- *"Compare the price of AirPods Pro across Best Buy, Walmart, and Target."*
- *"Actually — check Costco instead of Walmart."* (mid-run)
- *"Show me the Tesla one."* · *"Draw me a diagram of the results."* · *"Stop."*

### Cost notes (read before big runs)

- Every target is a real Browserbase session — a 15-target run is 15 sessions. Sessions are released the moment each target settles.
- **Proxies are off by default** (`BB_PROXIES=1` to enable). Government registries and other bot-walled sites will come back `blocked` without them; proxies bill per GB, so flip them on per run, deliberately.
- Realtime voice must use a Gateway WebSocket-available model — `openai/gpt-realtime-mini` is the verified one. `apps/web/scripts/verify-realtime-token.ts` checks; `apps/web/scripts/probe-realtime.ts` is a full headless voice-loop test (no mic needed).

## Repository layout

```
apps/web/            Next.js app — UI, swarm engine (hooks/), API routes
  app/friday/        voice command center (the main surface)
  app/swarm/         text-driven swarm (same engine)
  hooks/use-swarm.ts the portable swarm engine
  hooks/use-friday.ts voice ⇄ swarm orchestrator (tool dispatch)
  scripts/           headless verify/probe harnesses
agent/               legacy v1 voice worker (LiveKit pipeline) — superseded by /friday
convex/              optional persistence schema
tests/               unit / integration / smoke
```

## License

MIT
