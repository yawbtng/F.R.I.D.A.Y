# Friday — Voice Browser Agent

## What This Is
Voice-controlled browser agent (F.R.I.D.A.Y. from MCU). Speak a command, watch a cloud browser execute it, hear the result. A showcase of the Browserbase platform.

## Stack
- **Frontend**: Next.js 14 (App Router) + Tailwind + shadcn + Framer Motion
- **Browser**: Stagehand v3 + Browserbase (cloud Chromium)
- **Voice**: LiveKit Agents (Deepgram STT → Claude LLM → Cartesia TTS)
- **Database**: Convex (real-time, reactive)
- **Monorepo**: pnpm workspaces + Turborepo

## Project Structure
```
apps/web/           → Next.js frontend + API routes
  app/api/session/  → Create/resume Browserbase sessions
  app/api/browser/  → navigate, act, extract, observe, screenshot, search
  app/api/token/    → LiveKit room tokens
  lib/              → stagehand.ts, schemas.ts, api-auth.ts, rate-limit.ts, screenshot.ts
agent/              → LiveKit agent worker (separate long-running process)
  src/index.ts      → defineAgent entry point
  src/tools/        → 6 tools: navigate, act, extract, observe, screenshot, web-search
  src/lib/          → agent-fetch.ts, convex-client.ts
convex/             → Schema + mutations/queries (workspace root, shared by web + agent)
tests/              → unit/, integration/, smoke/
docs/PRD.md         → Full spec (2400 lines) — source of truth for all requirements
tasks/todo.md       → Issue tracker with dependency graph
```

## Commands
```bash
pnpm install          # Install all deps
pnpm dev              # Run Next.js + Turbo
npx convex dev        # Run Convex dev server
npx tsx agent/src/index.ts  # Run agent worker
pnpm test             # Unit tests (Vitest)
INTEGRATION=true pnpm test tests/integration/  # Real Browserbase tests
```

## Architecture (Two-Process Model)
```
User → WebRTC → LiveKit → Agent Worker → HTTP → Next.js API → Stagehand → Browserbase
                                      ↕                                    ↕
                                    Convex ←────────────────────────── Screenshots
```
- Agent worker calls Next.js API routes over HTTP with session-scoped JWTs
- Screenshots flow through Convex file storage (NOT LiveKit data channels)
- Convex is at workspace root so both web + agent import `_generated/api`

## Key Design Decisions (DO NOT change without good reason)
- **Stagehand singleton**: `Map<sessionId, Stagehand>` in memory, 5min idle cleanup
- **Auth**: Session-scoped JWTs via `jose` (HS256, 1h expiry)
- **Screenshots**: JPEG q60, max 1280px → Convex file storage → reactive `useQuery`
- **Agent tools**: All use shared `agentFetch` utility (~5 lines per tool)
- **Interrupt & pivot**: AbortController cancels in-flight ops on new user command
- **Voice**: Deepgram Nova-3 → Claude Sonnet → Cartesia Sonic-3 ("British Lady")
- **Search**: Google via Browserbase proxy (`proxies: true`), DuckDuckGo fallback

## GitHub Issues
34 issues across 5 milestones on [github.com/yawbtng/F.R.I.D.A.Y](https://github.com/yawbtng/F.R.I.D.A.Y/issues). Each issue is self-contained with inline code patterns. Check `tasks/todo.md` for the dependency graph.

### Milestone Gates (verify before moving on)
- **#6**: Type URL → see screenshot (Phase 1)
- **#15**: Speak command → see screenshot → hear response (Phase 2)
- **#21**: Refresh page → session history visible (Phase 3)
- **#28**: UI is demo-quality (Phase 4)
- **#34**: Live URL works, repo is template-quality (Phase 5)

## Gotchas
- `serverExternalPackages: ['@browserbasehq/stagehand']` in next.config — Stagehand can't be bundled by webpack
- `keepAlive: true` on Stagehand — without it, `close()` kills the browser session
- `maxDuration: 60` on all API route handlers — Vercel default (10s) is too short
- VAD loads in `prewarm()`, NOT `entry()` — loading per-session wastes time
- Agent worker is a separate process — cannot run inside Next.js
- Google search needs `proxies: true` on Browserbase sessions
- All `session.say()` calls need `{ allowInterruptions: true }`

## Agent Workflow
When working on an issue:
1. Read the issue body — it contains implementation code and verification criteria
2. Create a feature branch: `git checkout -b issue-N-short-description`
3. Implement, referencing `docs/PRD.md` only if the issue body is insufficient
4. Run `pnpm test` before marking done
5. Verify against the issue's "Verification" section
6. Open a PR linking the issue

## Code Style
- TypeScript strict mode, no `any` unless unavoidable
- Zod validation on all API route inputs
- Error responses: `{ error: string, code: string }` with proper HTTP status codes
- No wrapper objects — success returns raw JSON
- Keep it simple — no over-engineering, no premature abstractions
