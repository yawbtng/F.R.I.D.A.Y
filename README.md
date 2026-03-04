# F.R.I.D.A.Y. — Voice Browser Agent 🎙️🌐

> Speak a command. Watch a cloud browser execute it. Hear the result.

F.R.I.D.A.Y. is a voice-controlled browser agent modeled after Tony Stark's AI co-pilot. Talk to her, and she'll navigate websites, search the web, extract data, and report back — all by voice, in real time.

Built with [Browserbase](https://browserbase.com) + [Stagehand](https://stagehand.dev) + [LiveKit](https://livekit.io) + [Convex](https://convex.dev).

## At a Glance

- **Voice-controlled browser automation** powered by Stagehand v3
- **Real-time voice pipeline**: Deepgram STT → Claude LLM → Cartesia TTS
- **Live browser preview** via Browserbase debug iframe
- **Three modes**: Conversation, Web Search, and Browser Control
- **Session history** with Convex real-time database
- **F.R.I.D.A.Y. personality**: Tactical, concise, dry wit — not a generic assistant

## How It Works

```
User speaks → WebRTC → LiveKit Cloud
                          ↓
              STT (Deepgram Nova-3) → text
                          ↓
              LLM (Claude) → decides action
                          ↓
              Tool call → Next.js API → Stagehand → Browserbase
                          ↓
              Result → TTS (Cartesia Sonic-3) → voice → User hears response
```

F.R.I.D.A.Y. runs as two processes:
1. **Next.js app** (`apps/web/`) — frontend + browser API routes that drive Stagehand
2. **LiveKit Agent Worker** (`agent/`) — voice pipeline + tool execution

## Quickstart

### Prerequisites

- Node.js ≥ 20
- [pnpm](https://pnpm.io/installation)
- API keys for: [Browserbase](https://browserbase.com), [Anthropic](https://console.anthropic.com), [LiveKit](https://cloud.livekit.io), [Convex](https://convex.dev)

### Setup

```bash
# Clone
git clone https://github.com/yawbtng/F.R.I.D.A.Y.git && cd F.R.I.D.A.Y

# Install
pnpm install

# Configure
cp .env.example .env.local
# Fill in your API keys

# Start Convex
npx convex dev

# Start the agent worker (separate terminal)
cd agent && pnpm dev

# Start the app (separate terminal)
cd apps/web && pnpm dev

# Open http://localhost:3000 and start talking
```

## Demo Commands

Try these:

- `"Go to Hacker News and tell me the top 3 stories"`
- `"Search for the latest SpaceX news"`
- `"Navigate to GitHub trending and extract the top repos"`
- `"What's the difference between TCP and UDP?"` _(no tools — just conversation)_
- `"Click the top story and summarize it"`

## Architecture

```
Friday - VBA/
├── apps/web/          Next.js 14 — frontend + browser API routes
├── agent/             LiveKit Agent Worker — voice pipeline + tools
├── convex/            Real-time database schema (shared)
├── tests/             Unit, integration, and smoke tests
└── docs/PLAN.md       Comprehensive implementation plan
```

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Cloud Browser | Browserbase + Stagehand v3 | Headless Chrome in the cloud, AI-powered automation |
| Voice Pipeline | LiveKit Agents | WebRTC transport, STT/LLM/TTS orchestration |
| STT | Deepgram Nova-3 | Speech-to-text (via LiveKit inference) |
| LLM | Claude Sonnet | Intent understanding + response generation |
| TTS | Cartesia Sonic-3 | Text-to-speech (via LiveKit inference) |
| Database | Convex | Real-time session + command persistence |
| Frontend | Next.js 14 + Tailwind | Dark-mode UI with live browser preview |

## Environment Variables

See [`.env.example`](.env.example) for all required variables with descriptions.

No separate keys needed for Deepgram or Cartesia — they're bundled in LiveKit Cloud.

## Tech Stack

- [Browserbase](https://browserbase.com) — Cloud browser infrastructure
- [Stagehand](https://stagehand.dev) — AI browser automation SDK
- [LiveKit](https://livekit.io) — Real-time voice/video infrastructure
- [Convex](https://convex.dev) — Real-time backend-as-a-service
- [Next.js](https://nextjs.org) — React framework
- [Tailwind CSS](https://tailwindcss.com) — Utility-first styling

## License

MIT
