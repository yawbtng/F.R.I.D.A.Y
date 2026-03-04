# Friday: Voice Browser Agent — Comprehensive Implementation Plan

## 1. Context & Purpose

**What**: A voice-controlled browser agent called "Friday" — speak a command, watch a cloud browser execute it in real-time, hear the result spoken back.

**Why**: Internship showcase for Browserbase. Demonstrates deep understanding of Stagehand/Browserbase, high agency, and production-quality engineering. Designed as a reusable template suitable for PR to the Browserbase templates repo.

**Success Criteria**:
- Deployed URL where voice commands drive a cloud browser
- Browser actions visible in real-time via **Browserbase debug iframe** (live video, not just screenshots)
- Results spoken back with high-quality voice (Cartesia Sonic-3)
- Session history persists across page refreshes
- Code quality worthy of Browserbase's templates repo (clean README, .env.example, one-click deploy)

---

## 2. Architecture Overview

### 2.1 System Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                           │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ Audio        │  │ Chat         │  │ Browser Preview       │ │
│  │ Visualizer   │  │ Transcript   │  │ (screenshots/iframe)  │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────┘ │
│         │                 │                       │             │
│         └────────┬────────┘                       │             │
│                  │ WebRTC                          │ HTTP        │
│                  ▼                                 ▼             │
│  ┌───────────────────────┐         ┌──────────────────────────┐ │
│  │ LiveKit Cloud Room    │         │ Next.js API Routes       │ │
│  │ (media transport)     │         │ /api/browser/*           │ │
│  └───────────┬───────────┘         │ /api/token               │ │
│              │                     │ /api/session              │ │
└──────────────┼─────────────────────┼──────────────────────────┘ │
               │                     │
               ▼                     ▼
┌──────────────────────┐  ┌──────────────────────┐
│ LiveKit Agent Worker  │  │ Browserbase Cloud    │
│ (separate process)    │  │                      │
│                       │  │  ┌────────────────┐  │
│  STT: Deepgram Nova-3│  │  │ Stagehand v3   │  │
│  LLM: Claude Sonnet  │──┤  │ (headless      │  │
│  TTS: Cartesia Sonic  │  │  │  Chrome)       │  │
│                       │  │  └────────────────┘  │
│  Tools: HTTP calls ───┤  │                      │
│  to Next.js API       │  │  Debug iframe URL    │
└──────────────────────┘  └──────────────────────┘
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │ Convex Cloud          │
                          │ (real-time DB)        │
                          │ sessions + commands   │
                          └──────────────────────┘
```

### 2.2 Data Flow: Voice Command Lifecycle

```
1. User speaks: "Go to Hacker News and tell me the top 3 stories"
       │
       ▼
2. Browser captures audio → WebRTC → LiveKit Cloud Room
       │
       ▼
3. LiveKit routes audio → Agent Worker
       │
       ▼
4. STT (Deepgram Nova-3) converts speech → text
       │
       ▼
5. LLM (Claude) receives text + tool definitions
   Claude decides: call navigate("https://news.ycombinator.com")
       │
       ▼
6. Agent Worker calls POST /api/browser/navigate on Next.js server
       │
       ▼
7. Next.js route handler → Stagehand.navigate(url) on Browserbase
   Stagehand drives headless Chrome in the cloud
       │
       ▼
8. Returns { screenshot, currentUrl } → Agent Worker
   Screenshot saved to Convex file storage → frontend auto-updates via useQuery
       │
       ▼
9. LLM sees result, decides: call extract({ instruction: "top 3 stories" })
       │
       ▼
10. Agent Worker calls POST /api/browser/extract
    Stagehand.extract() with Zod schema → structured data
       │
       ▼
11. LLM receives extracted data, formulates spoken response
       │
       ▼
12. TTS (Cartesia Sonic-3) converts text → audio
       │
       ▼
13. Audio streams back via WebRTC → user hears Friday speak
    Convex mutation saves command + result to session history
```

### 2.3 Why Two Processes?

The LiveKit Agent Worker MUST be a separate long-running process because:
- LiveKit agents maintain persistent WebRTC connections (not compatible with serverless)
- The voice pipeline (STT→LLM→TTS) requires continuous audio streaming
- Serverless functions have cold starts that would break real-time voice

The Next.js server handles browser API routes because:
- Stagehand needs `serverExternalPackages` — only works in Node.js server context
- API routes provide a clean HTTP interface the agent worker can call
- Keeps browser automation logic separate from voice pipeline logic

---

## 3. Technology Deep Dives

### 3.1 Browserbase + Stagehand v3

**What Browserbase does**: Runs headless Chrome browsers in the cloud. You get a full browser session without managing infrastructure. Each session has a unique ID and can persist across multiple API calls.

**What Stagehand does**: An AI-powered browser automation SDK that sits on top of Browserbase (or local Playwright). Instead of writing CSS selectors, you describe actions in natural language.

**Core Stagehand v3 Methods**:

```typescript
// Initialize — creates a cloud browser session
const stagehand = new Stagehand({
  env: "BROWSERBASE",                    // Use cloud browsers (vs "LOCAL")
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
  modelName: "anthropic/claude-sonnet-4-6",  // AI model for understanding pages
  keepAlive: true,                        // ★ CRITICAL: session survives close()
  browserbaseSessionCreateParams: {
    timeout: 900,                         // 15 min session timeout
  },
});
await stagehand.init();

// navigate() — go to a URL
await stagehand.page.goto("https://news.ycombinator.com");

// act() — perform a natural language action on the page
await stagehand.act("Click on the first story link");

// extract() — pull structured data using a Zod schema
const data = await stagehand.extract({
  instruction: "Extract the top 3 story titles and their URLs",
  schema: z.object({
    stories: z.array(z.object({
      title: z.string(),
      url: z.string(),
      points: z.number(),
    })),
  }),
});

// observe() — analyze what's interactive on the page
const actions = await stagehand.observe("What can I click on this page?");

// screenshot
const screenshot = await stagehand.page.screenshot({ encoding: "base64" });
```

**Session Persistence Pattern** (critical for serverless):
```typescript
// Request 1: Create session
const stagehand = new Stagehand({ keepAlive: true, ... });
await stagehand.init();
const sessionId = stagehand.browserbaseSessionID; // Save this!
await stagehand.close(); // Session stays alive because keepAlive: true

// Request 2: Reconnect to same session
const stagehand2 = new Stagehand({
  browserbaseSessionID: sessionId,  // Reconnect!
  ...
});
await stagehand2.init(); // Resumes the existing browser
```

**Singleton Session Manager** (avoids reconnecting on every API call):

Instead of creating a new Stagehand instance per request (500ms-1s overhead each time), we keep a `Map<sessionId, Stagehand>` in-memory on the Next.js server. This means multi-step tasks (navigate → extract → screenshot) reuse the same connection.

```typescript
// lib/stagehand.ts
const instances = new Map<string, { stagehand: Stagehand; lastUsed: number; currentUrl: string; cachedScreenshot: string | null }>();

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 min

export async function getStagehand(sessionId: string): Promise<Stagehand> {
  const existing = instances.get(sessionId);
  if (existing) {
    existing.lastUsed = Date.now();
    return existing.stagehand;
  }

  const stagehand = new Stagehand({
    browserbaseSessionID: sessionId,
    env: "BROWSERBASE",
    apiKey: process.env.BROWSERBASE_API_KEY!,
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    keepAlive: true,
  });
  await stagehand.init();

  instances.set(sessionId, { stagehand, lastUsed: Date.now(), currentUrl: '', cachedScreenshot: null });
  return stagehand;
}

// URL cache: skip navigation if already on the target URL (30s TTL)
export function getCachedScreenshot(sessionId: string, url: string): string | null {
  const entry = instances.get(sessionId);
  if (!entry || entry.currentUrl !== url) return null;
  if (Date.now() - entry.lastUsed > 30_000) return null; // 30s TTL
  return entry.cachedScreenshot;
}

export function updateCache(sessionId: string, url: string, screenshot: string) {
  const entry = instances.get(sessionId);
  if (entry) {
    entry.currentUrl = url;
    entry.cachedScreenshot = screenshot;
    entry.lastUsed = Date.now();
  }
}

// Cleanup idle sessions every 60s
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of instances) {
    if (now - entry.lastUsed > IDLE_TIMEOUT_MS) {
      entry.stagehand.close().catch(() => {});
      instances.delete(id);
    }
  }
}, 60_000);
```

**Why this matters**: A "go to HN and get top 3 stories" command triggers navigate → extract (2 sequential API calls). Without the singleton, each call pays ~500ms-1s for `new Stagehand().init()`. With it, only the first call in a session pays that cost. The URL cache also means "take a screenshot" right after navigation returns instantly.

**Key Properties**:
- `stagehand.browserbaseSessionID` — unique session ID for reconnection
- `stagehand.page` — Playwright Page object for low-level control
- `stagehand.context` — Playwright BrowserContext for multi-tab

**Debug & Observability**:
- Debug URL: `https://api.browserbase.com/v1/sessions/{id}/debug` → returns live iframe URL
- Session recording: `GET /v1/sessions/{id}/recording` (rrweb format)
- Session logs: `GET /v1/sessions/{id}/logs`

### 3.2 LiveKit Agents (Node.js SDK v1.0+)

**What LiveKit does**: Real-time audio/video infrastructure. LiveKit Cloud handles WebRTC transport — you don't manage TURN servers, codecs, or audio routing. LiveKit Agents is their framework for building AI voice agents.

**The Voice Pipeline**: LiveKit Agents bundles STT, LLM, and TTS into a single pipeline:
```
Microphone → WebRTC → [STT: Deepgram Nova-3] → text
                                                  │
                                                  ▼
                                      [LLM: Claude] → response text
                                                  │
                                                  ▼
                              [TTS: Cartesia Sonic-3] → audio → WebRTC → Speaker
```

**No separate API keys needed** for Deepgram or Cartesia — they're bundled in LiveKit Cloud's `inference` module.

**Agent Definition Pattern (v1.0)**:

```typescript
import { defineAgent, voice, llm, inference, JobContext } from '@livekit/agents';
import * as silero from '@livekit/agents-plugin-silero';
import { z } from 'zod';

export default defineAgent({
  // prewarm: runs once when agent process starts (load heavy models)
  prewarm: async (proc) => {
    proc.userData.vad = await silero.VAD.load(); // Voice Activity Detection
  },

  // entry: runs for each new room/session
  entry: async (ctx: JobContext) => {
    await ctx.connect(); // Connect to LiveKit room

    // Define the agent's personality and tools
    const fridayAgent = new voice.Agent({
      instructions: FRIDAY_SYSTEM_PROMPT, // See §3.4 below
      tools: {
        // Browser automation tools
        navigate: navigateTool,
        act: actTool,
        extract: extractTool,
        observe: observeTool,
        screenshot: screenshotTool,
        // Web search tool
        web_search: webSearchTool,
      },
    });

    // Configure the voice pipeline
    const session = new voice.AgentSession({
      vad: ctx.proc.userData.vad,          // Voice Activity Detection
      stt: new inference.STT({
        model: 'deepgram/nova-3',
        language: 'en',
      }),
      llm: new inference.LLM({
        model: 'anthropic/claude-sonnet-4-6',
      }),
      tts: new inference.TTS({
        model: 'cartesia/sonic-3',
        voice: '79a125e8-cd45-4c13-8a67-188112f4dd22', // "British Lady"
      }),
    });

    // Start the agent in the room
    await session.start({ agent: fridayAgent, room: ctx.room });

    // Optional: greet the user on connect
    await session.generateReply({
      instructions: 'Greet the user. Introduce yourself as Friday.'
    });
  },
});
```

**Tool Definition Pattern (with live voice updates)**:

The key insight: `session.say()` lets Friday speak MID-tool-execution. The LLM doesn't have to wait for a tool to finish before the user hears something. This is what makes Friday feel like a co-pilot rather than a command terminal.

```typescript
// Store session reference so tools can speak mid-execution
let agentSession: voice.AgentSession;

const navigateTool = llm.tool({
  description: 'Navigate the browser to a URL',
  parameters: z.object({
    url: z.string().describe('The URL to navigate to'),
  }),
  execute: async ({ url }, { ctx }) => {
    // ★ SPEAK BEFORE the action — user hears this immediately
    await agentSession.say("Pulling that up now.", { allowInterruptions: true });

    const res = await fetch(`${WEB_URL}/api/browser/navigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, sessionId: browserSessionId }),
    });
    const data = await res.json();

    // Return text for LLM to formulate the "after" response
    return `Navigated to ${data.currentUrl}. Page title: ${data.title}.`;
  },
});

const extractTool = llm.tool({
  description: 'Extract structured data from the current page',
  parameters: z.object({
    instruction: z.string().describe('What data to extract'),
  }),
  execute: async ({ instruction }, { ctx }) => {
    // ★ Pre-announce — extraction can take a few seconds
    await agentSession.say("Extracting that data now.", { allowInterruptions: true });

    const res = await fetch(`${WEB_URL}/api/browser/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instruction, sessionId: browserSessionId }),
    });
    const data = await res.json();

    return JSON.stringify(data.data);
  },
});
```

**`session.say()` reference**:
- `session.say(text)` — queues speech immediately, independent of the LLM turn
- `{ allowInterruptions: true }` — user can interrupt the status update with a new command
- Runs in parallel with the tool execution — the fetch happens while Friday is speaking
- This is what creates the "co-pilot" feel: user hears "Pulling that up now" WHILE the browser is loading

**Anti-pattern**: Do NOT put status updates in the tool's return string and expect the LLM to speak them. By the time the LLM generates a response from the return value, seconds have passed in silence. Use `session.say()` for immediate feedback.

**Shared `agentFetch` Utility** (eliminates boilerplate across all 6+ tools):

Every tool needs the same fetch pattern: auth header, sessionId, AbortController signal, timeout, error handling, retries. Extract it once:

```typescript
// agent/src/lib/agent-fetch.ts
let sessionToken: string; // Set on session creation
let currentAbortController: AbortController | null = null;

interface AgentFetchOptions {
  path: string;           // e.g., '/api/browser/navigate'
  body: Record<string, unknown>;
  sessionId: string;
  timeoutMs?: number;     // Default: 10_000 (10s)
  retryCount?: number;    // Internal — don't set manually
}

export async function agentFetch<T>(opts: AgentFetchOptions): Promise<T> {
  const { path, body, sessionId, timeoutMs = 10_000, retryCount = 0 } = opts;

  // Max 2 retries to prevent LLM retry loops
  if (retryCount >= 2) {
    throw new Error('Operation failed after 2 retries. Try a different approach.');
  }

  // Cancel any in-flight operation (interrupt & pivot)
  currentAbortController?.abort();
  currentAbortController = new AbortController();

  // Timeout via AbortSignal
  const timeoutId = setTimeout(() => currentAbortController?.abort(), timeoutMs);

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ sessionId, ...body }),
      signal: currentAbortController.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    return await res.json() as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Operation cancelled — new command received or timeout.');
    }
    throw err;
  }
}
```

**With this, each tool becomes ~5 lines:**
```typescript
// agent/src/tools/navigate.ts
const navigateTool = llm.tool({
  description: 'Navigate the browser to a URL',
  parameters: z.object({ url: z.string() }),
  execute: async ({ url }) => {
    await agentSession.say("Pulling that up now.", { allowInterruptions: true });
    const data = await agentFetch<{ currentUrl: string; title: string }>({
      path: '/api/browser/navigate', body: { url }, sessionId,
    });
    return `Navigated to ${data.currentUrl}. Page title: ${data.title}.`;
  },
});
```

**Heartbeat for Long Operations**:

If a Stagehand call takes >5 seconds, the user hears silence after the initial `say()`. Add a 5-second heartbeat:

```typescript
// agent/src/lib/agent-fetch.ts — add to agentFetch
export async function agentFetchWithHeartbeat<T>(
  opts: AgentFetchOptions,
  session: voice.AgentSession,
): Promise<T> {
  const heartbeat = setTimeout(() => {
    session.say("Still working on it...", { allowInterruptions: true });
  }, 5_000);

  try {
    return await agentFetch<T>(opts);
  } finally {
    clearTimeout(heartbeat);
  }
}
```

Use `agentFetchWithHeartbeat` for `act()` and `extract()` (the slow operations). Use regular `agentFetch` for `navigate()` and `screenshot()` (fast operations).

**Key Concepts**:
- **VAD (Voice Activity Detection)**: Silero model detects when the user starts/stops speaking
- **Turn Detection**: Determines when the user is "done" speaking so the agent can respond
- **Preemptive Generation**: TTS can start generating audio before the LLM finishes (lower latency)
- **Room**: A LiveKit room is a virtual space where participants (user + agent) exchange media

**LiveKit Token Generation** (needed for frontend to join a room):

```typescript
import { AccessToken } from 'livekit-server-sdk';

const token = new AccessToken(
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET,
  { identity: 'user-123' }
);
token.addGrant({
  roomJoin: true,
  room: 'friday-room-abc',
  canPublish: true,      // User can send audio
  canSubscribe: true,    // User can receive agent audio
});
const jwt = await token.toJwt();
```

### 3.4 Friday's Personality & System Prompt

Friday is modeled after **F.R.I.D.A.Y.** (Female Replacement Intelligent Digital Assistant Youth) from the MCU — Tony Stark's AI after JARVIS. She's not a butler. She's a **tactical co-pilot**: concise, proactive, calm under pressure, with dry Irish wit.

**Voice & Personality Guidelines**:
- **Concise over verbose**: F.R.I.D.A.Y. speaks in short, punchy sentences. She reports status, not essays.
- **Proactive**: She volunteers relevant information before being asked. "Boss, heads up — that page has a paywall."
- **Calm under pressure**: When things break, she doesn't panic. "We lost the session. Spinning up a new one now."
- **Dry wit, not comedy**: Subtle, never forced. She earns a smile, not a laugh track.
- **"Boss"**: She addresses the user as "Boss" — sparingly, not every sentence. It's an identity marker, not a verbal tic.
- **Mission-oriented**: Every response drives toward the user's goal. No filler, no "certainly!", no "great question!"

**System Prompt**:

```typescript
const FRIDAY_SYSTEM_PROMPT = `You are Friday — a voice AI assistant with full browser control and web search capabilities. You're modeled after F.R.I.D.A.Y., Tony Stark's AI. You're sharp, tactical, and efficient. You call the user "Boss" occasionally (not every message — once every 4-5 exchanges feels natural).

## Voice
- Speak in short, direct sentences. You're talking out loud, not writing. Max 3-4 sentences per response unless asked for more.
- Lead with the answer or action, not the reasoning. Say "Pulling that up now" not "I'll use my navigation tool to access the website for you."
- Be proactive. If you notice something useful while browsing, mention it: "Found what you need, but there's also a comparison chart here — want me to grab that too?"
- When things go wrong, stay calm and state the fix: "Page timed out. Retrying now." No apologies, no drama.
- Dry humor is welcome. "That website's from 2003 and it shows. But the data's here."

## Three Modes of Operation

### 1. Conversation (default)
Just talk. You have broad knowledge — use it. Not every question needs a tool.
- "What's the difference between TCP and UDP?" → Answer directly. No tools.
- "Explain how React Server Components work" → Answer from knowledge.
- If the user is just chatting, chat back. You're a co-pilot, not a command terminal.

### 2. Web Search
For questions needing current, real-time information. Use web_search.
- "What happened with OpenAI today?" → web_search
- "What's the current price of Bitcoin?" → web_search
- "Any good conferences coming up?" → web_search
- After searching, summarize results conversationally. Offer to navigate to sources.

### 3. Browser Control
When the user wants to SEE or INTERACT with a website. Use navigate, act, extract, observe.
- "Go to Hacker News" → navigate
- "Click the top story" → act
- "Pull the top 5 story titles" → extract

## Tool Selection Logic
| User Intent | Tool | Example |
|------------|------|---------|
| General knowledge question | None (just talk) | "What is Kubernetes?" |
| Needs current/live data | web_search | "Latest SpaceX news?" |
| Wants to visit a website | navigate | "Go to github.com" |
| Wants to interact with a page | act | "Click the sign-up button" |
| Wants structured data from a page | extract | "Get all the prices on this page" |
| Wants to know what's clickable | observe | "What can I do on this page?" |
| Unclear intent | Ask | "Did you want me to search for that or pull up a specific site?" |

## Live Status Updates (Tactical Comms)
You MUST narrate your actions in real-time via voice — like a co-pilot giving status during a mission. The user should NEVER sit in silence wondering what's happening. This is your most important behavior.

### Rules
1. **Before** every tool call: announce what you're about to do in ≤8 words.
2. **During** multi-step tasks: give a progress update between each step.
3. **After** completion: report the result, then offer the next move.
4. Keep updates SHORT. One sentence max. No filler.

### Cadence Templates

**Single action:**
- Before: "Pulling up Hacker News."
- After: "Loaded. Top story's about [topic]. Want details?"

**Multi-step task** (e.g., "Go to HN and get the top 3 stories"):
- Step 1: "Loading Hacker News now."
- Step 2: "Page is up. Extracting the top stories."
- Step 3: "Got them. Number one is [title] at 340 points, number two is..."

**Search task:**
- Before: "Searching for that now."
- After: "Found a few results. [Summary]. Want me to open any of these?"

**Error/retry:**
- "Page didn't load. Retrying."
- "That element isn't on the page. Let me check what's available."

**Long operation (>5 seconds):**
- "Still working on it — this page is heavy."
- "Almost there. Extracting the data now."

### What this sounds like in practice
Think of F.R.I.D.A.Y. during a suit-up sequence or combat scene:
- "Rerouting power now." → "Navigating to the page now."
- "Target acquired." → "Found the data."
- "Structural damage detected." → "Page threw an error. Working around it."
- "All systems online." → "Everything's loaded. Ready when you are."

The user should feel like they have a co-pilot with eyes on the mission, not a silent black box.

## Guardrails
- Ambiguous command → ask a short clarifying question. "Which site, Boss?"
- Impossible command → explain what you CAN do. "Can't buy it for you, but I can pull up the checkout page."
- Public sites only. No logging into accounts or handling credentials.
- After completing a task, stay in the flow: "Done. What's next?" or "Want me to dig deeper on that?"

## Anti-Patterns (never do these)
- Never say "Certainly!", "Of course!", "Great question!", "I'd be happy to!"
- Never narrate your tool usage: "I'm going to use the extract tool to..." — just DO it.
- Never apologize for limitations. State what you CAN do instead.
- Never give long-winded responses. If you can say it in one sentence, do.
- Never break character. You are Friday. You are always Friday.`;
```

**Design Rationale**: The prompt uses **authority** (imperative language, anti-patterns as hard rules) and **commitment** (identity anchoring — "You are Friday. You are always Friday.") to maintain consistent personality even over long conversations. The tool selection table gives the LLM a **decision framework** rather than vague guidelines, reducing ambiguity about when to use tools vs. just talk.

**Why this matters for the demo**: When Jay from Browserbase sees Friday respond with "That site's from 2003 and it shows, but the data's here" instead of "I have successfully navigated to the website and extracted the requested information" — that's the difference between a toy project and something that feels *alive*.

### 3.5 Web Search Tool

Friday needs web search for questions that require current information (news, prices, real-time data) where navigating a full website would be overkill.

**Implementation** — Uses Stagehand to search Google and extract results:

```typescript
// agent/src/tools/web-search.ts
const webSearchTool = llm.tool({
  description: 'Search the web for current information. Use this for factual questions that need up-to-date data (news, prices, events). Do NOT use this if the user wants to visit a specific website — use navigate instead.',
  parameters: z.object({
    query: z.string().describe('The search query'),
  }),
  execute: async ({ query }, { ctx }) => {
    const res = await fetch(`${WEB_URL}/api/browser/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-secret': AGENT_SECRET,
      },
      body: JSON.stringify({ query, sessionId }),
    });
    return await res.json();
    // Returns: { results: [{ title, url, snippet }], screenshot }
  },
});
```

**API Route** — `POST /api/browser/search`:

```typescript
// apps/web/app/api/browser/search/route.ts
export async function POST(req: Request) {
  const { query, sessionId } = await req.json();

  const stagehand = new Stagehand({
    browserbaseSessionID: sessionId,
    keepAlive: true,
    ...
  });
  await stagehand.init();

  // Navigate to Google and search
  await stagehand.page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`);

  // Extract top results using Stagehand's AI extraction
  const results = await stagehand.extract({
    instruction: "Extract the top 5 search results with their title, URL, and snippet text",
    schema: z.object({
      results: z.array(z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string(),
      })),
    }),
  });

  const screenshot = await stagehand.page.screenshot({ encoding: "base64" });
  await stagehand.close();

  return Response.json({
    ...results,
    screenshot,
  });
}
```

**Why search via Stagehand instead of a search API?** Two reasons:
1. **Demonstrates Browserbase's power** — searching via a real browser shows Stagehand can handle any website, not just APIs
2. **No extra API key** — Google Search API costs money and requires separate credentials. Stagehand + Google.com is free and already works

**Google Anti-Bot Mitigation**: Google aggressively blocks automated browsers with CAPTCHAs. Use **Browserbase's proxy mode** for search sessions to route through residential IPs:

```typescript
// lib/stagehand.ts — when creating a session for search
const stagehand = new Stagehand({
  env: "BROWSERBASE",
  keepAlive: true,
  browserbaseSessionCreateParams: {
    timeout: 900,
    proxies: true,  // ★ Residential proxy — avoids Google CAPTCHA
  },
  // ...
});
```

**Note**: Proxy mode uses more Browserbase credits per session. Only enable it for the `search` route — navigation and other tools don't need it since they visit diverse URLs that don't have anti-bot detection. If proxy mode is insufficient, fall back to DuckDuckGo (`https://html.duckduckgo.com/html/?q=...`) which rarely blocks automated browsers.

---

### 3.6 Conversational Flow Examples (in F.R.I.D.A.Y. voice)

**Example 1: Pure conversation (no tools)**
```
User: "Hey Friday, what's the difference between React and Vue?"
Friday: "React's a UI library — you bring your own stack. Vue's a full
         framework, batteries included. React has the bigger ecosystem,
         Vue's easier to pick up. Want me to pull up a comparison?"
```

**Example 2: Web search → offer to browse**
```
User: "What's the latest news about SpaceX?"
Friday: [calls web_search("SpaceX latest news 2026")]
        "Starship completed its fifth orbital test yesterday — booster
         caught by the tower again. Want me to pull up the article?"
```

**Example 3: Seamless transition → browser**
```
User: "Yeah, show me"
Friday: [calls navigate("https://spacex-article-url.com")]
        "Got it. Article's loaded — there's launch footage and a flight
         timeline. Want me to grab the key milestones?"
```

**Example 4: Ambiguous → short clarification**
```
User: "Search for that thing we talked about"
Friday: "Which one, Boss — the SpaceX launch or something else?"
```

**Example 5: Proactive observation**
```
User: "Go to that YC startup list"
Friday: [calls navigate("https://ycombinator.com/companies")]
        "On it. Heads up — this page has filters by batch, industry, and
         stage. Want me to narrow it down or grab everything?"
```

**Example 6: Error with calm recovery**
```
User: "Click on the pricing page"
Friday: [calls act("click on pricing"), fails]
        "Page doesn't have a pricing link visible. I see Products, About,
         and Contact. Want me to try one of those?"
```

**Example 7: Impossible task → redirect**
```
User: "Log into my GitHub account"
Friday: "Can't handle logins, Boss. But I can navigate to any public
         GitHub page — repos, profiles, trending. What do you need?"
```

---

### 3.3 Convex (Real-Time Database)

**What Convex does**: A real-time backend-as-a-service. Think Firebase but with full TypeScript, ACID transactions, and reactive queries that auto-update the UI when data changes.

**Why Convex for this project**: Session history needs to persist AND update in real-time. When the agent completes a command, the sidebar should instantly show the result without polling. Convex's `useQuery` hook makes this trivial.

**Schema Definition**:

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sessions: defineTable({
    browserbaseSessionId: v.string(),
    livekitRoomName: v.optional(v.string()),
    title: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("idle"),
      v.literal("error")
    ),
    currentUrl: v.optional(v.string()),
    lastScreenshot: v.optional(v.string()),   // base64 or Convex file ID
    createdAt: v.number(),
    lastActiveAt: v.number(),
  })
    .index("by_last_active", ["lastActiveAt"])
    .index("by_browserbase_id", ["browserbaseSessionId"]),

  commands: defineTable({
    sessionId: v.id("sessions"),
    input: v.string(),                         // What the user said
    result: v.optional(v.string()),            // What Friday responded
    screenshotUrl: v.optional(v.string()),     // Screenshot after execution
    toolsUsed: v.optional(v.array(v.string())),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("done"),
      v.literal("error")
    ),
    errorMessage: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_session", ["sessionId", "createdAt"]),
});
```

**Mutations (write data)**:

```typescript
// convex/sessions.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    browserbaseSessionId: v.string(),
    livekitRoomName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sessions", {
      ...args,
      status: "active",
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });
  },
});

export const list = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_last_active")
      .order("desc")
      .take(20);
  },
});
```

**Frontend Usage (reactive)**:

```typescript
// In a React component
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

function SessionSidebar() {
  // This auto-updates when ANY session changes in the DB
  const sessions = useQuery(api.sessions.list);
  const createSession = useMutation(api.sessions.create);

  return (
    <div>
      {sessions?.map(s => <SessionCard key={s._id} session={s} />)}
    </div>
  );
}
```

**Key Convex Concepts**:
- **Queries** are read-only, cached, and reactive (UI auto-updates)
- **Mutations** are transactional writes (ACID guarantees)
- **Actions** are for side effects (calling external APIs) — NOT transactional
- All functions run on Convex's servers, not your Next.js server
- `v.id("sessions")` creates a typed foreign key reference

**Agent Worker → Convex** (how the separate process persists data):

The `convex/` directory lives at the **workspace root** (not inside `apps/web/`) so both packages can import the generated types. The agent worker uses the Convex HTTP client:

```typescript
// agent/src/lib/convex-client.ts
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api'; // Shared types!

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function saveCommand(args: {
  sessionId: string;
  input: string;
  result?: string;
  toolsUsed?: string[];
  status: 'pending' | 'running' | 'done' | 'error';
}) {
  return convex.mutation(api.commands.add, {
    ...args,
    createdAt: Date.now(),
  });
}

export async function updateSessionScreenshot(sessionId: string, screenshotFileId: string) {
  return convex.mutation(api.sessions.updateScreenshot, {
    browserbaseSessionId: sessionId,
    lastScreenshot: screenshotFileId,
  });
}
```

**Why workspace root?**: If `convex/` stays inside `apps/web/`, the agent can't import `convex/_generated/api` without complex path aliasing. Moving it to root means both `apps/web` and `agent` resolve it naturally via relative imports.

---

## 4. Project Structure

```
Friday - VBA/
├── apps/
│   └── web/                              # Next.js 14 App Router
│       ├── app/
│       │   ├── layout.tsx               # Root: ConvexProvider + metadata
│       │   ├── page.tsx                 # Main shell: sidebar + session view + browser preview
│       │   ├── globals.css              # Tailwind + custom properties
│       │   └── api/
│       │       ├── token/route.ts       # GET: Generate LiveKit room token
│       │       ├── session/route.ts     # POST: Create/resume Browserbase session
│       │       └── browser/
│       │           ├── navigate/route.ts  # POST: Navigate to URL
│       │           ├── act/route.ts       # POST: Perform action on page
│       │           ├── extract/route.ts   # POST: Extract structured data
│       │           ├── observe/route.ts   # POST: List interactive elements
│       │           ├── search/route.ts    # POST: Web search via Google + extract
│       │           └── screenshot/route.ts # POST: Capture current page
│       ├── components/
│       │   ├── ui/                      # shadcn primitives (button, card, input...)
│       │   ├── app/
│       │   │   ├── friday-shell.tsx     # Main layout: 3-column responsive grid
│       │   │   ├── command-center.tsx   # Center column: browser-preview + orb + controls
│       │   │   ├── audio-orb.tsx        # Pulsing orb visualizer (pinned to bottom)
│       │   │   ├── browser-preview.tsx  # Compact debug iframe/screenshot (above orb)
│       │   │   ├── mission-log.tsx      # Right column: transcript + inline screenshots
│       │   │   ├── session-sidebar.tsx  # Left column: Convex-powered session history
│       │   │   ├── example-commands.tsx # Clickable demo command chips (right column bottom)
│       │   │   └── export-session.tsx   # Export session as markdown or PDF
│       │   └── providers/
│       │       └── convex-provider.tsx  # "use client" Convex wrapper
│       ├── lib/
│       │   ├── stagehand.ts            # Stagehand singleton manager (Map + idle cleanup + URL cache)
│       │   ├── schemas.ts              # ★ Zod request/response schemas for all API routes
│       │   ├── rate-limit.ts           # ★ Per-IP rate limiter (30 req/min)
│       │   ├── config.ts               # Centralized env var access + defaults
│       │   └── api-auth.ts             # Session-scoped JWT validation (jose)
│       ├── convex/ → MOVED TO WORKSPACE ROOT (see below)
│       ├── hooks/
│       │   ├── use-browser-session.ts  # Manages Browserbase session lifecycle
│       │   └── use-livekit-room.ts     # LiveKit connection state
│       ├── next.config.ts
│       ├── components.json             # shadcn config
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── package.json
│
├── agent/                               # LiveKit Agent Worker
│   ├── src/
│   │   ├── index.ts                    # defineAgent entry point
│   │   ├── friday-agent.ts             # Agent class: instructions + tool registry
│   │   ├── lib/
│   │   │   ├── agent-fetch.ts          # ★ Shared fetch utility: auth, abort, timeout, retries
│   │   │   └── convex-client.ts        # ★ Convex HTTP client for persisting data
│   │   └── tools/
│   │       ├── navigate.ts             # navigate tool definition
│   │       ├── act.ts                  # act tool definition
│   │       ├── extract.ts              # extract tool definition
│   │       ├── observe.ts              # observe tool definition
│   │       ├── screenshot.ts           # screenshot tool definition
│   │       └── web-search.ts           # web search tool definition
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── package.json
│
├── convex/                              # ★ WORKSPACE ROOT — shared by web + agent
│   ├── schema.ts                       # Table definitions + indexes
│   ├── sessions.ts                     # Session CRUD mutations + queries
│   ├── commands.ts                     # Command CRUD mutations + queries
│   ├── _generated/                     # Auto-generated types (both packages import these)
│   └── convex.config.ts                # Convex project config
│
├── docs/
│   ├── PLAN.md                         # This file
│   ├── BROWSERBASE.md                  # Stagehand API reference notes
│   ├── LIVEKIT.md                      # LiveKit Agents reference notes
│   └── CONVEX.md                       # Convex patterns reference notes
│
├── tests/                               # ★ Workspace-level tests
│   ├── unit/
│   │   ├── api-routes.test.ts          # API route unit tests (mock Stagehand)
│   │   └── agent-tools.test.ts         # Agent tool unit tests (mock agentFetch)
│   ├── integration/
│   │   └── browser-flow.test.ts        # Real Browserbase integration test (INTEGRATION=true)
│   └── smoke/
│       └── agent-startup.test.ts       # Agent worker startup smoke test
│
├── vitest.config.ts                     # Vitest configuration
├── .env.example                        # All required env vars with descriptions
├── README.md                           # Browserbase template-quality README
├── package.json                        # pnpm workspace root
├── pnpm-workspace.yaml                 # Workspace definition
└── turbo.json                          # Optional: Turborepo for dev/build scripts
```

---

## 5. API Contracts

### 5.1 Browser API Routes (Next.js → Stagehand)

All browser routes accept POST with JSON body. All require `sessionId` for Stagehand reconnection. All return consistent response shapes.

**POST /api/session** — Create or resume a Browserbase session
```typescript
// Request
{ action: "create" } | { action: "resume", sessionId: string }

// Response
{
  sessionId: string,          // Browserbase session ID
  debugUrl: string,           // Live debug iframe URL
  status: "created" | "resumed"
}
```

**POST /api/browser/navigate**
```typescript
// Request
{ sessionId: string, url: string }

// Response
{
  currentUrl: string,
  title: string,
  screenshot: string,         // ★ JPEG quality 60, max 1280px width (not raw PNG)
}
```

**POST /api/browser/act**
```typescript
// Request
{ sessionId: string, instruction: string }

// Response
{
  description: string,        // What the action did
  // ★ No screenshot — act returns a description, not visuals.
  // The agent can call /screenshot separately if needed.
}
```

**POST /api/browser/extract**
```typescript
// Request
{
  sessionId: string,
  instruction: string,
  // ★ No schema param — instruction-only extraction.
  // Stagehand's AI interprets the instruction to determine what to extract.
  // Removes injection risk from accepting arbitrary schemas over the network.
}

// Response
{
  data: unknown,              // Extracted data based on instruction
  // ★ No screenshot — extract returns structured data, not visuals.
  // Use /api/browser/screenshot separately if needed.
}
```

**POST /api/browser/observe**
```typescript
// Request
{ sessionId: string, instruction: string }

// Response
{
  actions: Array<{
    description: string,
    selector: string,
    type: "click" | "input" | "select",
  }>
}
```

**POST /api/browser/search** — Web search via Google + Stagehand extraction
```typescript
// Request
{ sessionId: string, query: string }

// Response
{
  results: Array<{
    title: string,
    url: string,
    snippet: string,
  }>,
  screenshot: string,
}
```

**POST /api/browser/screenshot**
```typescript
// Request
{ sessionId: string }

// Response
{ screenshot: string }        // ★ JPEG quality 60, max 1280px width
```

**Screenshot Compression** (applied in all routes that return screenshots):
```typescript
// lib/screenshot.ts
export async function compressScreenshot(page: Page): Promise<string> {
  const buffer = await page.screenshot({
    type: 'jpeg',
    quality: 60,
    clip: { x: 0, y: 0, width: 1280, height: 800 }, // Reasonable viewport
  });
  return buffer.toString('base64');
}
// Typical size: 40-80KB (vs 200-500KB for raw PNG)
```

**Selective screenshot returns**: Only `navigate` and `screenshot` routes return screenshots. `act`, `extract`, and `observe` do NOT — they return structured data. This reduces per-tool-call payload by 60-80%.

**Screenshot persistence**: Screenshots are stored in **Convex file storage** (`ctx.storage.store()`), not inline as base64 strings in documents. Frontend uses reactive `useQuery` to display the latest screenshot — no LiveKit data channels needed.

**GET /api/token** — LiveKit room token
```typescript
// Query params: ?room=friday-room-abc
// Response
{ token: string, room: string, serverUrl: string }
```

### 5.3 Request Validation (Zod Schemas)

Every API route validates its input with Zod before touching Stagehand. This produces clean 400 errors instead of cryptic Stagehand crashes.

```typescript
// lib/schemas.ts
import { z } from 'zod';

export const SessionCreateSchema = z.object({
  action: z.enum(['create', 'resume']),
  sessionId: z.string().min(1).optional(), // Required for 'resume'
}).refine(d => d.action !== 'resume' || d.sessionId, {
  message: 'sessionId required for resume',
});

export const NavigateSchema = z.object({
  sessionId: z.string().min(1),
  url: z.string().url('Must be a valid URL'),
});

export const ActSchema = z.object({
  sessionId: z.string().min(1),
  instruction: z.string().min(1, 'Instruction cannot be empty'),
});

export const ExtractSchema = z.object({
  sessionId: z.string().min(1),
  instruction: z.string().min(1, 'Instruction cannot be empty'),
});

export const ObserveSchema = z.object({
  sessionId: z.string().min(1),
  instruction: z.string().min(1),
});

export const SearchSchema = z.object({
  sessionId: z.string().min(1),
  query: z.string().min(1, 'Search query cannot be empty'),
});

export const ScreenshotSchema = z.object({
  sessionId: z.string().min(1),
});

// Usage in each route:
// const parsed = NavigateSchema.safeParse(body);
// if (!parsed.success) {
//   return Response.json({ error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }, { status: 400 });
// }
```

### 5.2 Security: Agent → API Authentication

The agent worker calls these API routes over HTTP. We use **session-scoped JWTs** for proper isolation — each JWT is tied to a specific Browserbase session ID and expires after 1 hour.

```typescript
// lib/api-auth.ts
import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.AGENT_API_SECRET!);

// Called once when session is created — returns a JWT scoped to that session
export async function createSessionToken(sessionId: string): Promise<string> {
  return new SignJWT({ sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(secret);
}

// Called in every browser API route — validates JWT AND session scope
export async function validateAgentRequest(req: Request, expectedSessionId: string): Promise<boolean> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.sessionId === expectedSessionId;
  } catch {
    return false; // Expired, invalid, or tampered
  }
}

// In each route handler:
const { sessionId, ...rest } = await req.json();
if (!await validateAgentRequest(req, sessionId)) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Flow**: `POST /api/session` creates a Browserbase session → generates a scoped JWT → returns both to the agent worker. The agent includes `Authorization: Bearer <jwt>` in all subsequent browser API calls. Each route verifies the JWT's `sessionId` matches the request's `sessionId` — so a token for session A can't operate on session B.

**Why JWTs over a shared secret**: A static shared secret gives full access to all sessions forever. Session-scoped JWTs auto-expire, are tied to a single session, and can be revoked by rotating `AGENT_API_SECRET`.

---

## 6. Error Handling & Resilience

### 6.1 Failure Modes & Recovery

| Failure | Detection | Recovery | User Experience |
|---------|-----------|----------|-----------------|
| Browserbase session timeout | Stagehand throws on reconnect | Create new session, navigate to last known URL | "Let me reconnect..." + auto-resume |
| Stagehand `act()` fails | Returns error/throws | Retry once, then explain failure to user | "I couldn't click that. Let me try another way." |
| `extract()` returns empty | Zod validation fails | Fall back to raw text extraction via `page.textContent()` | Still provides data, just less structured |
| LiveKit disconnection | Room `disconnected` event | Auto-reconnect with exponential backoff (3 attempts) | Visualizer shows "Reconnecting..." |
| LLM rate limit / timeout | HTTP 429 or timeout | Queue response, retry after delay | "Give me a moment..." |
| Screenshot too large | Base64 > 1MB | Compress with quality: 60, resize to 1280px width | Slightly lower quality preview |
| Network blip during tool call | Fetch timeout | Return error to LLM, let it decide next step | Agent explains and asks if user wants to retry |

### 6.2 Error Response Shape

API routes use **HTTP status codes** for success/failure — no wrapper objects. This matches RESTful conventions and keeps the agent tool code simple.

```typescript
// Success — HTTP 200, raw response object
{ currentUrl: string, title: string, screenshot: string }

// Error — HTTP 4xx/5xx
{ error: string, code: "SESSION_EXPIRED" | "STAGEHAND_ERROR" | "TIMEOUT" | "UNAUTHORIZED" | "RATE_LIMITED" | "VALIDATION_ERROR" }

// Agent tools check: if (!res.ok) handle error
```

### 6.3 Rate Limiting

Simple per-IP rate limiter prevents runaway costs from bot abuse or agent retry loops.

```typescript
// lib/rate-limit.ts
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(ip: string, maxRequests = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + windowMs });
    return true; // Allowed
  }

  entry.count++;
  return entry.count <= maxRequests; // Blocked if over limit
}

// In each route handler:
const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
if (!rateLimit(ip)) {
  return Response.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
}
```

Additionally, agent tools enforce **max 2 retries** per operation to prevent LLM retry loops:
```typescript
// In agentFetch utility — see §agent/src/lib/agent-fetch.ts
if (retryCount >= 2) {
  return { error: 'Operation failed after 2 retries. Try a different approach.' };
}
```

### 6.4 Stagehand Session Lifecycle

```
CREATE ──→ ACTIVE ──→ IDLE (no commands for 5 min)
  │           │           │
  │           │           └──→ ACTIVE (new command wakes it)
  │           │
  │           └──→ ERROR (crash/timeout)
  │                   │
  │                   └──→ CREATE (auto-recover: new session)
  │
  └──→ RESUME (reconnect with browserbaseSessionID)
```

---

## 7. UI Components & Layout

### 7.1 Layout (3-Column Responsive)

**Design philosophy**: The center column is the "cockpit" — controls at the bottom (orb + mic + keyboard), live browser feed above. The right column is the "mission log" — full transcript, inline screenshots, and export. The orb lives near the user's thumb/cursor so double-clicking the keyboard puts you right at the action.

```
┌──────────────┬──────────────────────────────────┬────────────────────────────┐
│              │                                  │                            │
│  Session     │     Command Center               │    Mission Log             │
│  Sidebar     │                                  │                            │
│              │                                  │  ┌──────────────────────┐  │
│ [+ New]      │                                  │  │ Chat Transcript      │  │
│              │                                  │  │ (scrollable)         │  │
│ Session 1    │  ┌────────────────────────────┐  │  │                      │  │
│  ● active    │  │ ● ● ●  news.ycombin...  ↻  │  │  │ User: "go to HN"    │  │
│ Session 2    │  │ ┌──────────────────────┐  │  │  │ Friday: "On it."     │  │
│ Session 3    │  │ │                      │  │  │  │                      │  │
│              │  │ │  Browserbase Debug   │  │  │  │ ┌──────────────────┐  │  │
│              │  │ │  Iframe (live)       │  │  │  │ │ 📸 screenshot    │  │  │
│              │  │ │                      │  │  │  │ │ (inline thumb)   │  │  │
│              │  │ └──────────────────────┘  │  │  │ └──────────────────┘  │  │
│              │  └────────────────────────────┘  │  │                      │  │
│              │  ┌───────────────┐              │  │ Friday: "Top 3:     │  │
│              │  │  ◉ Orb        │              │  │  1. Story A         │  │
│              │  │ (pulsing,     │              │  │  2. Story B..."     │  │
│              │  │  centered)    │              │  │                      │  │
│              │  └───────────────┘              │  └──────────────────────┘  │
│              │  ┌────────────────────────────┐ │                            │
│              │  │ [🎤 Hold to speak] [⌨ Type]│ │                            │
│              │  └────────────────────────────┘ │                            │
│              │  ┌──── Example Commands ────┐   │                            │
│              │  │ [Search HN]              │   │                            │
│              │  │ [Read top story]         │   │                            │
│              │  │ [Compare prices]         │   │                            │
│              │  │ [Extract GitHub]         │   │                            │
│              │  └──────────────────────────┘   │  [📥 Export Session ▾]     │
└──────────────┴──────────────────────────────────┴────────────────────────────┘
```

**Column breakdown**:

| Column | Role | Key Behavior |
|--------|------|-------------|
| **Left — Session Sidebar** | Session history list | `+ New` at top, active session highlighted, click to switch |
| **Center — Command Center** | Live browser + controls | Browser iframe appears above orb once session starts. Orb + controls pinned to bottom. Idle state: just the orb and controls. |
| **Right — Mission Log** | Transcript + screenshots + export | Scrollable chat with inline screenshot thumbnails. Example command chips at bottom. Export button (MD/PDF) at very bottom. |

**Center column states**:

1. **Idle** (no session): Orb + controls centered vertically, subtle breathing animation. Clean, inviting.
2. **Session active**: Browser iframe slides in from above, pushing the orb down. Orb stays pinned to bottom with controls beneath it. The iframe gets ~60% of the column height, the orb gets ~25%, controls get ~15%.
3. **Friday speaking**: Orb expands slightly with waveform bars. Browser iframe stays visible above — user sees the page AND the orb simultaneously.

**Browser iframe overlay behavior**:
- The iframe appears as a compact browser preview (fake chrome + URL bar) sitting ABOVE the orb
- It overlaps the orb slightly at the bottom edge (8-16px overlap) to create visual continuity — the orb feels like a "control knob" for the browser above it
- When no browser session exists, this area is empty and the orb floats in the center

**Responsive breakpoints**:
- Desktop (≥1280px): 3 columns as shown
- Tablet (≥768px): Sidebar collapses to icons, 2 columns (center + right merge, orb stays at bottom)
- Mobile (<768px): Single column, stacked. Orb + controls fixed to bottom of viewport. Mission log scrolls above. Browser preview becomes a swipeable sheet.

### 7.2 Component Responsibilities

| Component | Data Source | Key Props/State |
|-----------|------------|-----------------|
| `friday-shell.tsx` | Layout only | Responsive 3-column grid, dark theme wrapper |
| `command-center.tsx` | LiveKit room state | Contains browser-preview (top) + orb (bottom) + controls |
| `audio-orb.tsx` | LiveKit audio track | Pulsing orb, waveform on speak, breathing on idle. Pinned to bottom of center column. |
| `browser-preview.tsx` | Convex `useQuery` + debug URL | Compact iframe/screenshot above orb. Slides in when session starts. |
| `mission-log.tsx` | Convex `useQuery(api.commands.bySession)` | Scrollable transcript with inline screenshot thumbnails |
| `session-sidebar.tsx` | `useQuery(api.sessions.list)` | Real-time session list from Convex |
| `example-commands.tsx` | Static data | Clickable chips in right column bottom |
| `export-session.tsx` | Convex session data + screenshots | Export button: markdown or PDF download with all screenshots |

### 7.2.1 Session Export

When a session is complete (or anytime during), the user can click **Export Session** in the bottom-right corner.

**Export formats**:

| Format | Contents | Implementation |
|--------|----------|---------------|
| **Markdown** | Full transcript (user + Friday), embedded screenshot URLs, timestamps, tools used per command | Generate `.md` string client-side, trigger download via `Blob` + `URL.createObjectURL` |
| **PDF** | Same as markdown but rendered with headings, inline screenshot images, monospace for data | Use `@react-pdf/renderer` or `html2pdf.js` to convert the markdown view to PDF |

**Export structure**:
```markdown
# F.R.I.D.A.Y. Session Export
**Date**: 2026-03-04 14:32 UTC
**Duration**: 12 minutes
**Commands**: 8

---

## Command 1 — 14:32:05
**User**: "Go to Hacker News and tell me the top 3 stories"
**Tools**: navigate, extract
**Duration**: 4.2s

**Friday**: "Loading Hacker News now... Got it. Top three:
1. Story A at 340 points
2. Story B at 280 points
3. Story C at 215 points.
Want me to click into any of these?"

![Screenshot](screenshot-1.png)

---

## Command 2 — 14:32:45
...
```

**Convex query for export**: `api.commands.bySession` already returns all commands with screenshots. The export component fetches the full session, formats it, and triggers a download. Screenshots stored in Convex file storage are fetched via `useQuery` and embedded as data URLs in the PDF or linked in markdown.

### 7.3 Design System — "Stark Industries Terminal"

**Aesthetic**: Vercel meets Tony Stark's workshop. Dark, precise, technical — but warm. Think the holographic interfaces from Iron Man, flattened into a 2D web UI. Pixel-sharp edges, monospace accents, subtle blue/cyan glow on interactive elements.

**Font Stack**:
```css
/* Primary: Geist (Vercel's typeface) — clean, techy, modern */
--font-sans: 'Geist', system-ui, -apple-system, sans-serif;

/* Monospace: Geist Mono — for code, status updates, URLs, data */
--font-mono: 'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace;

/* Display (optional): For the landing page hero headline */
--font-display: 'Geist', system-ui, sans-serif;
```

**Color Palette**:
```css
/* Backgrounds */
--bg-primary: #0a0a0a;        /* Near-black, Vercel style */
--bg-secondary: #111111;      /* Panels, cards */
--bg-tertiary: #1a1a1a;       /* Hover states, elevated surfaces */
--bg-surface: #0d0d0d;        /* Sidebar, subtle separation */

/* Borders */
--border-default: #222222;    /* Subtle borders */
--border-hover: #333333;      /* Interactive borders */
--border-active: #3b82f6;     /* Active/focused — blue accent */

/* Text */
--text-primary: #ededed;      /* Primary text — off-white */
--text-secondary: #888888;    /* Secondary, muted */
--text-tertiary: #555555;     /* Disabled, hints */

/* Accent — F.R.I.D.A.Y. blue (like the Arc Reactor) */
--accent-primary: #3b82f6;    /* Interactive elements, links */
--accent-glow: rgba(59, 130, 246, 0.15);  /* Glow effects */
--accent-hover: #60a5fa;      /* Hover states */

/* Status */
--status-active: #22c55e;     /* Green — session active */
--status-error: #ef4444;      /* Red — errors */
--status-pending: #f59e0b;    /* Amber — processing */

/* Special */
--visualizer-glow: rgba(59, 130, 246, 0.4);  /* Audio visualizer glow */
--friday-pulse: rgba(59, 130, 246, 0.08);     /* Breathing pulse background */
```

**Spacing Scale** (8px base):
```
4px | 8px | 12px | 16px | 24px | 32px | 48px | 64px | 96px | 128px
```

**Border Radius**:
```css
--radius-sm: 6px;     /* Buttons, badges */
--radius-md: 8px;     /* Cards, inputs */
--radius-lg: 12px;    /* Panels, modals */
--radius-xl: 16px;    /* Browser preview frame */
--radius-full: 9999px; /* Pills, avatars */
```

**Shadows** (subtle, dark-mode appropriate):
```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.5);
--shadow-glow: 0 0 20px var(--accent-glow);  /* Blue glow on active elements */
```

### 7.4 Key UI Patterns

**Audio Visualizer Orb** (bottom of center column — near controls):
- Circular orb with pulsing blue glow when Friday is listening
- Waveform bars emanate outward when Friday is speaking
- Idle state: subtle breathing animation (scale 1.0 → 1.02, opacity pulse)
- **Position**: Pinned to the bottom of the center column, directly above the mic/keyboard controls. Double-clicking the keyboard puts the orb right in view.
- When browser session is active: orb sits below the browser iframe with a slight overlap (8-16px) at the top edge of the orb, creating visual continuity between "what Friday is doing" (iframe) and "Friday herself" (orb)
- Inspired by: 21st.dev `Waveform` component + custom orb animation

**Browser Preview Frame**:
```
┌─ browser-preview.tsx ──────────────────────────────────┐
│ ┌────────────────────────────────────────────────────┐ │
│ │ ● ● ●   https://news.ycombinator.com         ↻   │ │  ← Fake browser chrome (dark)
│ ├────────────────────────────────────────────────────┤ │
│ │                                                    │ │
│ │              <iframe> or <img>                     │ │  ← Debug iframe (live) or screenshot
│ │              Browserbase debug URL                 │ │
│ │                                                    │ │
│ │                                                    │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│  [● Live]  [◻ Screenshot]           ◎ Session: abc123  │  ← Mode toggle + session ID
└────────────────────────────────────────────────────────┘
```
- Fake browser chrome with traffic light dots (macOS style, dark)
- URL bar in `--font-mono`, shows current page URL
- Rounded corners `--radius-xl`, border `--border-default`
- Blue glow `--shadow-glow` when actively loading

**Session Sidebar**:
- Dark surface `--bg-surface`, full height
- Each session: title (auto-generated from first command), timestamp in `--font-mono`, status dot
- Active session: left border accent `--accent-primary`
- Hover: `--bg-tertiary` background
- "+ New Session" button at top with blue accent

**Command Chips** (example commands — right column, bottom):
```
┌──────────────────────────────┐
│ Try saying:                  │
│ ┌──────────────────────────┐ │
│ │ 🔍 Search HN             │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ 📰 Read top story        │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ 💰 Compare iPhone prices │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ 📊 Extract GitHub data   │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```
- Stacked vertically in right column (narrower space than before)
- Rounded pill shape `--radius-full`
- `--bg-tertiary` background, `--border-default` border
- Hover: subtle blue glow, border transitions to `--border-active`
- Click: triggers the command as if the user spoke it
- Sits above the Export Session button at the very bottom

### 7.5 Landing Page Design & Copy

The app has TWO views: (1) the **landing/hero page** for first-time visitors and (2) the **agent workspace** after clicking "Try Friday."

**Landing Page Structure**:

```
┌──────────────────────────────────────────────────────────────────┐
│  NAV:  [F.R.I.D.A.Y. logo]              [GitHub] [Try Friday →] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                     ● (pulsing blue orb)                         │
│                                                                  │
│              Your AI co-pilot for the web.                       │
│                                                                  │
│         Speak. Browse. Extract. All by voice.                    │
│                                                                  │
│    F.R.I.D.A.Y. is a voice-controlled browser agent that         │
│    navigates, searches, and extracts data from any website       │
│    — just by talking to it.                                      │
│                                                                  │
│         [Try Friday →]     [View on GitHub]                      │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│            ┌──────────────────────────────────────┐              │
│            │                                      │              │
│            │     (Browser preview mockup           │              │
│            │      showing Friday navigating        │              │
│            │      a website — animated GIF          │              │
│            │      or looping video)                │              │
│            │                                      │              │
│            └──────────────────────────────────────┘              │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  "Go to Hacker News"        "Search for the best               │
│  → navigates + shows          restaurants in SF"                │
│    live browser              → searches Google                  │
│                                + extracts results               │
│  "Click the top story       "What's React?"                    │
│   and summarize it"          → answers from                    │
│  → multi-step action           knowledge, no tools              │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  POWERED BY:                                                     │
│  [Browserbase logo]  [Stagehand]  [LiveKit]  [Convex]           │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Built by [Your Name] • Open Source • Deploy Your Own            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Landing Page Copywriting**:

| Section | Copy |
|---------|------|
| **Badge** (above headline) | `Powered by Browserbase + Stagehand` |
| **Headline** | `Your AI co-pilot for the web.` |
| **Subheadline** | `Speak. Browse. Extract. All by voice.` |
| **Body** | `F.R.I.D.A.Y. is a voice-controlled browser agent that navigates, searches, and extracts data from any website — just by talking to it.` |
| **Primary CTA** | `Try Friday →` |
| **Secondary CTA** | `View on GitHub` |
| **Section 2 Header** | `See it in action.` |
| **Section 3 Header** | `Three capabilities. One voice.` |
| **Capability 1** | **Browse** · `"Go to Hacker News"` → Friday navigates and shows the live browser |
| **Capability 2** | **Search** · `"Latest SpaceX news?"` → Friday searches the web and summarizes results |
| **Capability 3** | **Converse** · `"What's Kubernetes?"` → Friday answers from knowledge, no tools needed |
| **Capability 4** | **Extract** · `"Get the top 5 story titles"` → Friday pulls structured data from any page |
| **Footer tagline** | `Built with obsessive attention to detail. Open source. Deploy your own.` |

**Copy Voice Guidelines**:
- Short. Punchy. Imperative verbs. ("Speak. Browse. Extract." not "You can speak, browse, and extract.")
- No marketing fluff. No "revolutionary" or "cutting-edge." The demo speaks for itself.
- Technical but accessible. A developer should nod. A non-developer should understand.
- The word "Friday" appears sparingly — let the product name breathe.

### 7.6 Animations & Motion

All animations use Framer Motion. Subtle, purposeful — never decorative.

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Audio visualizer (idle) | Scale 1.0→1.02, opacity pulse | 2s loop | `ease-in-out` |
| Audio visualizer (speaking) | Waveform bars, radius expansion | 150ms per frame | `spring` |
| Screenshot update | Crossfade opacity old→new | 300ms | `ease-out` |
| Browser preview loading | Subtle pulse glow on frame border | 1.5s loop | `ease-in-out` |
| Sidebar session appear | Slide in from left + fade | 200ms | `ease-out` |
| Command chip hover | Scale 1.0→1.02, border glow | 150ms | `ease-out` |
| Page transitions | Fade in | 200ms | `ease-out` |
| Landing page hero | Staggered fade-up: badge→headline→body→CTAs | 100ms stagger | `ease-out` |
| Landing page orb | Continuous gentle pulse | 3s loop | `ease-in-out` |

**Anti-patterns**:
- No bounce animations. This isn't playful — it's precise.
- No slide-from-bottom on every element. One entrance animation per section max.
- No animation longer than 500ms. If it takes longer, it's slowing the user down.

### 7.7 21st.dev Component Mapping

Components to source from 21st.dev (adapt to our design system):

| Our Component | 21st.dev Reference | Adaptation |
|---------------|-------------------|------------|
| Landing hero | `Hero 1` (HextaUI dark) | Swap purple→blue, add orb visualizer, update copy |
| Audio waveform | `Waveform` (ScrollingWaveform) | Integrate with LiveKit audio data, blue color scheme |
| Sidebar nav | `Sidebar` dark variants | Simplify to session list, add status dots |
| Command chips | `Suggestion` pill pattern | Style to our border/radius tokens |
| Browser frame | Custom (no direct match) | Build from scratch with fake chrome + iframe |

**Implementation note**: Don't install 21st.dev components directly — use them as **visual reference** and rebuild with our design tokens. This keeps the bundle clean and the design consistent.

### 7.8 AI Image Generation Prompts

Use these prompts in Midjourney, DALL-E 3, or Ideogram to generate visual assets. Each prompt is tuned for the dark/techy/Vercel aesthetic.

---

**Asset 1: F.R.I.D.A.Y. Logo / Icon**

*Use in: Navbar, favicon, open graph image, README*

> Midjourney / DALL-E 3:
> ```
> Minimal geometric logo mark for an AI assistant called "FRIDAY".
> Inspired by Tony Stark's Arc Reactor — a circular motif with
> concentric rings and a glowing blue core. Flat vector style,
> no gradients, pure white on transparent/black background.
> Techy, precise, Silicon Valley aesthetic. Similar to Vercel's
> triangle logo in simplicity. SVG-ready, single color.
> ```

> Alternate (more literal):
> ```
> Minimal AI assistant logo. A stylized letter "F" formed by
> circuit-board traces that converge into a glowing blue dot.
> Monoline weight, geometric construction. White on black.
> Clean enough to work at 16x16 favicon size.
> ```

---

**Asset 2: Landing Page Hero Background**

*Use in: Behind the hero headline, subtle and atmospheric*

> ```
> Abstract dark background texture for a developer tool landing page.
> Very subtle grid pattern fading into darkness, with a single soft
> blue light source from the center creating a gentle radial glow.
> Color palette: near-black (#0a0a0a) with hints of blue (#3b82f6)
> glow. No objects, no shapes — pure atmosphere. Similar to Vercel's
> homepage background. 4K resolution, minimal noise grain.
> ```

---

**Asset 3: Audio Visualizer Orb (Hero Illustration)**

*Use in: Landing page center piece, marketing materials*

> ```
> Futuristic AI assistant visualization. A luminous blue orb floating
> in dark space, with concentric sound wave rings emanating outward.
> Inspired by Iron Man's FRIDAY AI interface. The orb glows with
> electric blue (#3b82f6) light, surrounded by faint data streams
> and particle effects. Dark background (#0a0a0a). Photorealistic
> 3D render, cinematic lighting, shallow depth of field. No text.
> ```

> Alternate (flatter, more UI-appropriate):
> ```
> Minimal glowing orb UI element for a voice AI interface. Simple
> circle with soft blue glow and subtle pulse rings expanding outward
> like sound waves. Dark background, flat design with gentle depth
> from lighting. Think Apple's Siri orb meets Vercel's design
> language. Clean, not busy. PNG with transparency.
> ```

---

**Asset 4: Browser Preview Mockup (Demo Screenshot)**

*Use in: Landing page "See it in action" section, README, social share image*

> ```
> Screenshot mockup of a dark-themed web application showing a cloud
> browser agent. Left panel: session history sidebar with timestamps.
> Center: audio waveform visualizer with a glowing blue orb. Right
> panel: embedded browser window showing Hacker News. The browser
> has a minimal dark chrome with traffic light dots and a URL bar
> showing "news.ycombinator.com". Overall aesthetic: Vercel dashboard
> meets Iron Man HUD. Dark UI (#0a0a0a background), blue accents,
> monospace typography. High resolution, pixel-perfect.
> ```

---

**Asset 5: Open Graph / Social Share Image (og:image)**

*Use in: `<meta property="og:image">`, Twitter card, LinkedIn preview*

> ```
> Social media preview card for "FRIDAY — Voice Browser Agent".
> Dark background (#0a0a0a). Center: the FRIDAY logo (blue glowing
> orb). Below: "Your AI co-pilot for the web." in clean white
> sans-serif font. Bottom: "Speak. Browse. Extract." in smaller
> muted gray text. Subtle blue grid lines in the background.
> 1200x630 pixels, no busy elements. Vercel/GitHub aesthetic —
> minimal, dark, authoritative.
> ```

---

**Asset 6: Three Capability Icons**

*Use in: Landing page "Three capabilities" section*

> Browse icon:
> ```
> Minimal line icon of a browser window with a compass/globe inside.
> Single stroke weight, white on transparent. Geometric, 24x24 grid.
> Style: Lucide/Feather icons aesthetic.
> ```

> Search icon:
> ```
> Minimal line icon of a magnifying glass with radiating signal waves.
> Suggests both search and voice/audio. Single stroke weight, white
> on transparent. 24x24 grid.
> ```

> Converse icon:
> ```
> Minimal line icon of two speech bubbles with a sound wave inside
> one of them. Suggests AI conversation. Single stroke weight,
> white on transparent. 24x24 grid.
> ```

> Extract icon:
> ```
> Minimal line icon of a document/page with data rows being pulled
> out into structured blocks. Suggests data extraction. Single stroke
> weight, white on transparent. 24x24 grid.
> ```

**Note**: For the capability icons, prefer Lucide icons from the library (`Globe`, `Search`, `MessageSquare`, `TableProperties`) over AI-generated ones. Only generate custom icons if the stock ones don't capture the concept.

---

**Asset 7: Demo Video Thumbnail**

*Use in: README, landing page video embed*

> ```
> Cinematic thumbnail for a demo video of a voice AI browser agent.
> Dark workspace environment. Center: a browser window showing a
> website with a glowing blue audio waveform overlaid. A subtle
> play button (triangle in circle) in the center. Text overlay:
> "Friday Demo — 60 seconds". Dark, moody lighting with blue accent
> glow. 1920x1080, YouTube thumbnail style but developer-oriented.
> ```

---

**Asset 8: Background Pattern (Dot Grid)**

*Use in: Subtle page background texture, behind content sections*

> ```
> Seamless tileable dot grid pattern on dark background. Very faint
> gray dots (#1a1a1a) on near-black (#0a0a0a), 24px spacing.
> Similar to Vercel's dashboard background grid. Must be subtle
> enough that text remains highly readable on top. PNG, 200x200
> tile, transparent dots on solid background.
> ```

**Pro tip**: This one is better done in CSS than AI-generated:
```css
background-image: radial-gradient(circle, #1a1a1a 1px, transparent 1px);
background-size: 24px 24px;
```

---

**Generation Tips**:
- **Midjourney**: Add `--ar 16:9` for hero images, `--ar 1:1` for icons, `--style raw` for less artistic interpretation
- **DALL-E 3**: Be very specific about colors (include hex codes). It respects them well.
- **Ideogram**: Best for text-in-image (OG cards with text). Add `--style design` for cleaner results.
- **Recraft**: Best for icons and logos. Use "vector" style for SVG-ready outputs.
- Always generate at highest resolution and downscale. Never upscale.
- For the logo, generate 10+ variations and pick the cleanest one.

---

## 8. Environment Variables

```bash
# ═══════════════════════════════════════════════
# Browserbase / Stagehand
# Get these at: https://www.browserbase.com/settings
# ═══════════════════════════════════════════════
BROWSERBASE_API_KEY=bb_live_...
BROWSERBASE_PROJECT_ID=...

# ═══════════════════════════════════════════════
# LLM — used by both Stagehand (page understanding) and LiveKit Agent (conversation)
# ═══════════════════════════════════════════════
ANTHROPIC_API_KEY=sk-ant-...

# ═══════════════════════════════════════════════
# LiveKit — real-time voice infrastructure
# Get these at: https://cloud.livekit.io
# ═══════════════════════════════════════════════
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=API...
LIVEKIT_API_SECRET=...

# ═══════════════════════════════════════════════
# Convex — real-time database
# Auto-configured by `npx convex dev`
# ═══════════════════════════════════════════════
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud

# ═══════════════════════════════════════════════
# Internal: Agent ↔ API route authentication
# Generate with: openssl rand -hex 32
# ═══════════════════════════════════════════════
AGENT_API_SECRET=...

# ═══════════════════════════════════════════════
# Next.js public URL (for agent worker to call API routes)
# ═══════════════════════════════════════════════
NEXT_PUBLIC_APP_URL=http://localhost:3000     # or production URL
```

**No separate keys needed for**: Deepgram (STT) or Cartesia (TTS) — bundled in LiveKit Cloud.

---

## 9. Implementation Phases

### Phase 1: Scaffold + Stagehand Working ★ CRITICAL PATH

**Goal**: Type a command in a text box → cloud browser executes it → see screenshot.

| Step | Task | Verification |
|------|------|-------------|
| 1.1 | Create pnpm workspace root (`package.json` + `pnpm-workspace.yaml`) | `pnpm install` succeeds |
| 1.2 | Create Next.js 14 app in `apps/web/` with TypeScript + Tailwind | `pnpm dev` shows default page |
| 1.3 | Init shadcn, install primitives: `button`, `card`, `input`, `badge`, `scroll-area` | Components render |
| 1.4 | Install `@browserbasehq/stagehand`, `zod`, `jose`, `vitest` | No build errors |
| 1.5 | Add `serverExternalPackages: ['@browserbasehq/stagehand']` to `next.config.ts` | Build succeeds |
| 1.6 | Write `lib/stagehand.ts` — **singleton Map** with create/resume, idle cleanup, URL cache | Unit testable |
| 1.6b | Write `lib/schemas.ts` — Zod request schemas for all API routes | Schemas compile |
| 1.6c | Write `lib/api-auth.ts` — session-scoped JWT creation + validation | Token round-trips |
| 1.6d | Write `lib/rate-limit.ts` — per-IP rate limiter (30 req/min) | Blocks after threshold |
| 1.6e | Write `lib/screenshot.ts` — JPEG compression utility (quality 60, 1280px) | Outputs small JPEG |
| 1.7 | Write `POST /api/session` — creates Browserbase session, returns sessionId + debugUrl | `curl` returns valid session |
| 1.8 | Write `POST /api/browser/navigate` — reconnects to session, navigates, screenshots | Returns base64 screenshot |
| 1.9 | Write `POST /api/browser/act` — performs NL action on page | Can click elements |
| 1.10 | Write `POST /api/browser/extract` — extracts structured data with Zod | Returns typed JSON |
| 1.11 | Write `POST /api/browser/observe` — lists interactive elements | Returns action list |
| 1.12 | Write `POST /api/browser/screenshot` — captures current page | Returns base64 |
| 1.13 | Build simple test page: text input → calls session + navigate → displays screenshot | **MILESTONE: type "go to google.com" → see screenshot** |
| 1.14 | Write unit tests for all API routes (mock Stagehand) | `pnpm test` passes |
| 1.15 | Write integration test (real Browserbase) | `INTEGRATION=true pnpm test` passes |

**Key Learning**: Stagehand's `keepAlive: true` + singleton Map pattern. The singleton avoids 500ms-1s reconnection overhead per API call. The URL cache means "take a screenshot" after navigation returns instantly.

### Phase 2: LiveKit Agent Worker ★ CRITICAL PATH

**Goal**: Speak a command → agent navigates browser → speaks back the result.

| Step | Task | Verification |
|------|------|-------------|
| 2.1 | Create `agent/` package with `@livekit/agents`, `@livekit/agents-plugin-silero` | Builds cleanly |
| 2.2 | Write `src/index.ts` with `defineAgent()` — prewarm loads VAD model | Agent process starts |
| 2.3 | Write `src/friday-agent.ts` — Agent class with instructions + tool registry | Compiles |
| 2.3b | Write `src/lib/agent-fetch.ts` — shared fetch utility with auth, abort, timeout, retries, heartbeat | Unit testable |
| 2.3c | Write `src/lib/convex-client.ts` — Convex HTTP client for persisting commands | Can write to Convex |
| 2.4 | Write tool files in `src/tools/` — each uses `agentFetch`/`agentFetchWithHeartbeat` (~5 lines each) | Tools return valid responses |
| 2.5 | Configure STT (Deepgram), LLM (Claude), TTS (Cartesia) in AgentSession | Pipeline initializes |
| 2.6 | Write `GET /api/token` — generates LiveKit JWT with room grant | Returns valid token |
| 2.7 | Set up LiveKit Cloud project, get LIVEKIT_URL + API keys | Agent connects to cloud |
| 2.8 | Run agent worker locally: `npx tsx agent/src/index.ts` | Agent joins room on creation |
| 2.9 | Build basic frontend: connect to LiveKit room, show audio state | WebRTC connection established |
| 2.10 | Integrate audio visualizer + transcript display | Can see agent speaking |
| 2.11 | **MILESTONE: speak "go to hacker news" → see screenshot + hear response** | End-to-end voice works |
| 2.12 | Write agent startup smoke test (VAD loads, tools registered) | `pnpm test tests/smoke/` passes |
| 2.13 | Write agent tool unit tests (mock agentFetch) | `pnpm test tests/unit/agent-tools` passes |

**Key Learning**: LiveKit's `defineAgent` / `voice.Agent` / `voice.AgentSession` pattern. The agent worker is a long-running Node.js process, NOT a serverless function. The `agentFetch` utility + heartbeat pattern eliminates boilerplate and dead silence during tool execution.

### Phase 3: Convex Persistence

**Goal**: Session history persists across page refreshes. Real-time sidebar updates.

| Step | Task | Verification |
|------|------|-------------|
| 3.1 | `npx convex dev` at **workspace root** — initializes Convex project (shared by web + agent) | Convex dashboard accessible |
| 3.2 | Write `convex/schema.ts` with sessions + commands tables (includes file storage for screenshots) | Schema deploys without errors |
| 3.3 | Write `convex/sessions.ts` — create, update, list mutations/queries | Can create sessions via dashboard |
| 3.4 | Write `convex/commands.ts` — addCommand, updateCommand, bySession | Can query commands |
| 3.5 | Build `providers/convex-provider.tsx` — "use client" ConvexProvider wrapper | Provider wraps app |
| 3.6 | Integrate: save Browserbase session to Convex on creation (from Next.js API route) | Session appears in Convex dashboard |
| 3.7 | Integrate: agent worker saves commands via Convex HTTP client (`agent/src/lib/convex-client.ts`) | Commands appear in dashboard |
| 3.7b | Integrate: screenshots saved to Convex file storage, frontend displays via reactive `useQuery` | Screenshots update in real-time |
| 3.8 | Build `session-sidebar.tsx` — `useQuery(api.sessions.list)` with reactive updates | Sidebar shows sessions |
| 3.9 | Build `command-feed.tsx` — shows commands for active session | Commands update in real-time |
| 3.10 | **MILESTONE: refresh page → session history visible, click session → shows commands** | Persistence works |

**Key Learning**: Convex's reactive `useQuery` pattern — queries re-run automatically when underlying data changes. No polling, no WebSocket setup, no cache invalidation. Screenshots flow through Convex file storage (not LiveKit data channels), keeping the architecture simple: tools produce data → Convex stores it → frontend reactively displays it.

### Phase 4: Polish + Browser Preview

**Goal**: Demo-quality UI with smooth animations and professional feel.

| Step | Task | Verification |
|------|------|-------------|
| 4.1 | Build `browser-preview.tsx` — screenshot display with crossfade transitions | Smooth screenshot updates |
| 4.2 | Add Browserbase debug iframe toggle (live mode vs screenshot mode) | Can switch between modes |
| 4.3 | Add URL bar showing current page URL | URL updates on navigation |
| 4.4 | Build `example-commands.tsx` — 5 demo-ready clickable chips | Chips trigger commands |
| 4.5 | Dark theme with glassmorphism panels, gradient accents | Visually impressive |
| 4.6 | Framer Motion: visualizer pulse, screenshot crossfade, sidebar transitions | Smooth animations |
| 4.7 | Responsive layout: test tablet + mobile breakpoints | Usable on all screen sizes |
| 4.8 | Loading states for every async operation (skeleton, spinner, pulse) | No jarring state changes |
| 4.9 | Error states with clear messaging | Errors are informative |
| 4.10 | **MILESTONE: UI looks production-quality, all interactions feel polished** | Demo-ready |

### Phase 5: Deploy + Demo Prep

**Goal**: Live URL that anyone can visit. Clean repo suitable for Browserbase templates PR.

| Step | Task | Verification |
|------|------|-------------|
| 5.1 | Deploy Convex: `npx convex deploy` | Production Convex URL works |
| 5.2 | Deploy agent worker to LiveKit Cloud (or Railway/Fly.io Docker) | Agent auto-joins rooms |
| 5.3 | Deploy Next.js to Vercel, configure env vars | Deployed URL loads |
| 5.4 | Update `NEXT_PUBLIC_APP_URL` in agent config to Vercel URL | Agent→API calls work in prod |
| 5.5 | Write README.md following Browserbase template standards (see §10) | README is complete |
| 5.6 | Create `.env.example` with all vars documented | Copy-paste setup works |
| 5.7 | Test full flow on deployed URL (voice + text + persistence) | Everything works live |
| 5.8 | Record 45-60s demo video as backup | Video captures full flow |
| 5.9 | Prepare 5 demo commands that reliably work | Demo script rehearsed |
| 5.10 | **MILESTONE: live URL works, repo is template-quality, demo rehearsed 3x** | Ship it |

---

## 10. README Specification (Browserbase Template Standard)

Based on analysis of 60+ Browserbase templates, the README must follow this structure:

```markdown
# Friday — Voice Browser Agent 🎙️🌐

> Speak a command. Watch a cloud browser execute it. Hear the result.

Built with [Browserbase](https://browserbase.com) + [Stagehand](https://stagehand.dev) + [LiveKit](https://livekit.io).

## At a Glance
- Voice-controlled browser automation powered by Stagehand
- Real-time voice pipeline: Deepgram STT → Claude LLM → Cartesia TTS
- Live browser preview with screenshot streaming
- Session history with Convex real-time database
- [Docs: Stagehand](https://docs.stagehand.dev) | [Docs: LiveKit Agents](https://docs.livekit.io/agents)

## Quickstart
1. Clone: `git clone ... && cd friday-vba`
2. Install: `pnpm install`
3. Configure: `cp .env.example .env.local` and fill in keys
4. Run Convex: `npx convex dev`
5. Run agent: `cd agent && npx tsx src/index.ts`
6. Run app: `cd apps/web && pnpm dev`
7. Open http://localhost:3000 and start speaking

## How It Works
[Technical explanation with architecture diagram]

## Demo Commands
- "Go to Hacker News and tell me the top 3 stories"
- "Search for the best restaurants in SF on Google"
- "Navigate to GitHub trending and extract the top repos"

## Deploy
[One-click Vercel deploy badge + deployment instructions]
```

---

## 11. Key Gotchas & Warnings

### Stagehand / Browserbase
- **`serverExternalPackages`**: Stagehand MUST be listed in `next.config.ts` — webpack cannot bundle Playwright/Chrome deps
- **Server-only**: NEVER import Stagehand in client components — it requires Node.js APIs
- **`keepAlive: true`**: Essential for session persistence across serverless function calls. Without it, closing Stagehand kills the browser session
- **Session timeout**: Default is 30s. Set `timeout: 900` (15 min) for demo reliability
- **`maxDuration: 60`**: Add to all route handlers for Vercel hobby tier (default is 10s, too short for Stagehand)
- **Stagehand v3 `act()` is single-step**: It doesn't recursively loop. For multi-step workflows, chain multiple `act()` calls or use the LLM to orchestrate

### LiveKit
- **Agent worker is a separate process**: Cannot run inside Next.js — needs its own Node.js process/container
- **Room lifecycle**: Agent auto-joins when a room is created. Frontend creates room by requesting a token → LiveKit Cloud creates room → agent detects and joins
- **VAD prewarm**: Load Silero VAD model in `prewarm()`, not `entry()`. Loading per-session wastes time
- **STT/TTS model strings**: Must match exactly — `deepgram/nova-3`, `cartesia/sonic-3`

### Convex
- **`"use client"` provider**: ConvexProvider must be in a client component. Create a thin wrapper
- **Mutations are NOT instant**: They're async and eventually consistent. Use optimistic updates for snappy UI
- **No raw SQL**: Convex uses its own query builder. All queries are TypeScript functions
- **File storage for screenshots**: Use `ctx.storage.store()` for screenshots — NOT inline base64 in documents (bloats DB)
- **Workspace root**: `convex/` must be at workspace root so both `apps/web` and `agent` can import `_generated/api`

### General
- **CORS**: Agent worker on a different port/host will need CORS headers on API routes
- **Screenshots are JPEG q60**: All screenshots compressed to JPEG quality 60, max 1280px width before storing. Typical size: 40-80KB (vs 200-500KB raw PNG)
- **Google CAPTCHA**: Use Browserbase proxy mode (`proxies: true`) for search sessions. Fall back to DuckDuckGo if proxy insufficient
- **Stagehand timeouts**: All Stagehand operations wrapped with 10s `Promise.race` timeout + 5s heartbeat `say()` for slow ops

---

## 12. Verification Checklist

### Core Functionality
- [ ] Speak a command → hear response + see screenshot update
- [ ] Type a command → same result (text fallback)
- [ ] Multi-step: "Go to HN and tell me the top 3 stories" → navigates + extracts + speaks
- [ ] Refresh page → session history visible in sidebar
- [ ] Click previous session → loads its commands and last screenshot
- [ ] Click example chip → executes command successfully

### Error Handling
- [ ] Disconnect WiFi briefly → reconnects gracefully
- [ ] Navigate to non-existent URL → agent explains the error
- [ ] Give impossible command → agent explains what it can do instead
- [ ] Session expires → new session created automatically

### UI/UX
- [ ] Audio visualizer animates when agent speaks
- [ ] Screenshots crossfade smoothly on update
- [ ] Loading states shown during tool execution
- [ ] Responsive on tablet and mobile
- [ ] Dark theme looks polished

### Deployment
- [ ] Vercel deployment loads correctly
- [ ] Agent worker connects to deployed API routes
- [ ] Convex queries work in production
- [ ] Full voice flow works on deployed URL
- [ ] README is complete with quickstart + deploy instructions
- [ ] `.env.example` has all required variables documented

### Demo Readiness
- [ ] 5 demo commands tested and working reliably
- [ ] Demo script rehearsed 3x
- [ ] Backup demo video recorded
- [ ] Can explain architecture and tech choices confidently

---

## 12.5 Testing Strategy

**Framework**: Vitest (fast, TypeScript-native, Vite-powered). Installed at workspace root.

### 12.5.1 Unit Tests — API Routes (`tests/unit/api-routes.test.ts`)

Mock Stagehand, test that each route:
- Validates input with Zod (rejects bad input with 400)
- Calls the correct Stagehand method with correct params
- Returns the expected response shape
- Handles Stagehand errors gracefully (returns 500 with error code)
- Enforces auth (returns 401 without valid JWT)
- Enforces rate limits (returns 429 after threshold)

```typescript
// Example test structure
describe('POST /api/browser/navigate', () => {
  it('rejects missing sessionId', async () => { /* 400 */ });
  it('rejects invalid URL', async () => { /* 400 */ });
  it('rejects missing auth token', async () => { /* 401 */ });
  it('navigates and returns screenshot', async () => { /* mock stagehand, assert shape */ });
  it('handles Stagehand timeout', async () => { /* mock throw, assert 500 */ });
});
// Repeat for: act, extract, observe, search, screenshot, session
```

**~30 test cases** covering all 7 routes.

### 12.5.2 Unit Tests — Agent Tools (`tests/unit/agent-tools.test.ts`)

Mock `agentFetch`, test that each tool:
- Sends correct path and body params
- Returns LLM-friendly strings (not raw JSON)
- Handles abort/timeout gracefully
- Respects max 2 retries

```typescript
describe('navigate tool', () => {
  it('sends correct URL to agentFetch', async () => { /* ... */ });
  it('returns formatted string for LLM', async () => { /* ... */ });
  it('handles abort gracefully', async () => { /* ... */ });
});
```

**~15 test cases** covering all 6 tools.

### 12.5.3 Integration Test — Browser Flow (`tests/integration/browser-flow.test.ts`)

**Gated behind `INTEGRATION=true` env var** — requires real Browserbase API key.

Tests the critical path end-to-end against real Browserbase:

```typescript
describe.skipIf(!process.env.INTEGRATION)('Browser flow integration', () => {
  let sessionId: string;

  it('creates a Browserbase session', async () => {
    const res = await fetch('/api/session', { body: { action: 'create' } });
    sessionId = res.sessionId;
    expect(sessionId).toBeTruthy();
  });

  it('navigates to example.com', async () => {
    const res = await fetch('/api/browser/navigate', { body: { sessionId, url: 'https://example.com' } });
    expect(res.currentUrl).toContain('example.com');
    expect(res.screenshot).toBeTruthy();
  });

  it('extracts page title', async () => {
    const res = await fetch('/api/browser/extract', { body: { sessionId, instruction: 'Extract the page title' } });
    expect(res.data).toBeTruthy();
  });

  it('takes a screenshot', async () => {
    const res = await fetch('/api/browser/screenshot', { body: { sessionId } });
    expect(res.screenshot).toMatch(/^\/9j\//); // JPEG base64 starts with /9j/
  });
});
```

**~5 test cases**, runs in ~15 seconds, catches Stagehand version breaks and API contract mismatches.

### 12.5.4 Smoke Test — Agent Startup (`tests/smoke/agent-startup.test.ts`)

Validates the agent worker compiles and initializes without needing LiveKit credentials:

```typescript
describe('Agent startup', () => {
  it('loads Silero VAD model', async () => {
    const vad = await silero.VAD.load();
    expect(vad).toBeTruthy();
  });

  it('all tools have valid definitions', () => {
    const tools = [navigateTool, actTool, extractTool, observeTool, screenshotTool, webSearchTool];
    for (const tool of tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeTruthy();
      expect(typeof tool.execute).toBe('function');
    }
  });
});
```

### 12.5.5 Running Tests

```bash
# Unit tests (fast, no API keys needed)
pnpm test

# Integration tests (requires BROWSERBASE_API_KEY + running Next.js server)
INTEGRATION=true pnpm test tests/integration/

# All tests
INTEGRATION=true pnpm test
```

Add to `package.json` root:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

---

## 13. Demo Script (for Browserbase)

**Opening** (20s):
> "This is Friday — think F.R.I.D.A.Y. from the MCU, but with a real browser. She can talk, search the web, and control a cloud browser through Browserbase. Let me show you."

**Demo 1 — Conversation (no tools)** (15s):
> You: "Hey Friday, what's Browserbase?"
> Friday: "Cloud browser infrastructure, Boss. Headless Chrome sessions in the cloud — built for automation and agents like me. Want me to pull up the docs?"
> *Shows Friday can just talk. No tools fired. Natural.*

**Demo 2 — Web Search** (25s):
> You: "What's the latest on Stagehand v3?"
> Friday: [web_search fires, extracts Google results via Stagehand]
> Friday: "Stagehand v3 dropped recently — new agent mode, better extraction, self-healing selectors. Want me to navigate to the changelog?"
> *Shows intelligent tool selection — search for current info without full navigation.*

**Demo 3 — Seamless Transition to Browser** (20s):
> You: "Yeah, show me"
> Friday: [navigate to Stagehand docs]
> Friday: "Got it. Docs are up. I can see the API reference and a migration guide from v2."
> *Browserbase debug iframe shows live browser. Conversation flows naturally into action.*

**Demo 4 — Multi-Step Extraction** (40s):
> You: "Go to Hacker News and give me the top 3 stories"
> Friday: [navigate + extract with Zod schema]
> Friday: "On it. Loading HN now... Got it. Top three: [story 1] at 340 points, [story 2] at 280, [story 3] at 215. Want me to click into any of these?"

**Demo 5 — Deep Interaction** (30s):
> You: "Click the top one and tell me what it's about"
> Friday: [act clicks, page loads, extract pulls content]
> Friday: "It's about [summary]. Heads up — there's a discussion thread with 200 comments too. Want the highlights?"
> *Shows proactive observation — Friday noticed the comments without being asked.*

**Demo 6 — Persistence** (15s):
> [Refresh the page]
> You: "Notice the sidebar — full session history. Every command, every result. Pick up right where you left off."

**Closing** (20s):
> "Three capabilities in one agent: conversation, web search, and full browser control — all powered by Stagehand and Browserbase. Open source, one-click deploy. That's Friday."

---

## 14. Design Decisions (Confirmed)

These were explicitly chosen during planning and should NOT be revisited without good reason:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Concurrency model** | Interrupt & pivot | When user speaks a new command mid-task, abort current Stagehand operation and start the new one immediately. More responsive UX — the user's latest intent takes priority. |
| **Browser preview** | Browserbase debug iframe (live) | Show real-time live video of the cloud browser via Browserbase's debug URL iframe. Most impressive for the demo. Fall back to screenshots only if iframe fails to load. |
| **Persistence** | Convex | Full real-time persistence with reactive queries. Sessions and commands survive page refresh. Worth the setup cost for demo impressiveness. |
| **Guardrails** | Clarify + suggest | When commands are ambiguous, Friday asks a clarifying question. When commands are impossible, Friday explains what it CAN do instead. Best UX for a demo. |
| **Auth sites** | Public sites only (MVP) | No credential handling for MVP. Only navigate public websites. |
| **Input mode** | Voice-primary | Big audio visualizer, voice is the star. Text input exists as a fallback but is secondary. |
| **Stagehand lifecycle** | Singleton Map per session | `Map<sessionId, Stagehand>` in-memory. Avoids 500ms-1s reconnection overhead per API call. Idle cleanup after 5 min. |
| **API auth** | Session-scoped JWTs | Each session gets a short-lived JWT via `jose`. Scoped to sessionId — token for session A can't operate on session B. |
| **Rate limiting** | In-memory per-IP (30 req/min) | Prevents runaway costs from bot abuse or agent retry loops. Agent tools also enforce max 2 retries. |
| **Agent → Convex** | HTTP client + workspace-root convex/ | Agent worker writes to Convex directly via `ConvexHttpClient`. Shared types from workspace-root `convex/_generated/api`. |
| **Tool boilerplate** | Shared `agentFetch` utility | Single utility handles auth, abort, timeout, retries for all 6+ tools. Each tool is ~5 lines. |
| **Error responses** | Raw objects + HTTP status codes | No `{success, data}` wrapper. Success = 200 + raw JSON. Error = 4xx/5xx + `{error, code}`. RESTful and simple. |
| **Search engine** | Google via Browserbase proxy | Proxy mode (`proxies: true`) avoids Google CAPTCHA. Falls back to DuckDuckGo if insufficient. |
| **Tool timeouts** | 10s timeout + 5s heartbeat | `Promise.race` with 10s timeout. 5s heartbeat `say("Still working on it...")` for slow ops. Eliminates dead silence. |
| **Testing** | Vitest: unit + integration + smoke | Unit tests for API routes + agent tools. Real Browserbase integration test (gated). Agent startup smoke test. |
| **Input validation** | Zod schemas on all API routes | `lib/schemas.ts` — `safeParse` on every route. Clean 400 errors instead of cryptic Stagehand crashes. |
| **Screenshots** | JPEG q60, selective, Convex storage | Compressed to 40-80KB. Only navigate/screenshot routes return them. Stored in Convex file storage, frontend uses reactive `useQuery`. |
| **Extract API** | Instruction-only (no schema param) | Removes injection risk from accepting arbitrary Zod schemas over HTTP. Stagehand extracts based on instruction alone. |
| **URL caching** | 30s TTL in Stagehand singleton | Skip navigation if already on target URL. "Take a screenshot" after navigation returns instantly. |
| **Screenshot transport** | Convex reactive queries | No LiveKit data channels. Screenshots flow: API route → Convex file storage → frontend `useQuery`. Simpler architecture. |

### Interrupt & Pivot Implementation

The agent needs an `AbortController` pattern for cancelling in-flight tool calls:

```typescript
// In the agent worker
let currentAbortController: AbortController | null = null;

const navigateTool = llm.tool({
  description: 'Navigate the browser to a URL',
  parameters: z.object({ url: z.string() }),
  execute: async ({ url }, { ctx }) => {
    // Cancel any in-flight operation
    currentAbortController?.abort();
    currentAbortController = new AbortController();

    const res = await fetch(`${WEB_URL}/api/browser/navigate`, {
      method: 'POST',
      body: JSON.stringify({ url, sessionId }),
      signal: currentAbortController.signal, // Abortable!
    });

    if (currentAbortController.signal.aborted) {
      return 'Operation cancelled — new command received.';
    }

    return await res.json();
  },
});
```

### Debug Iframe Integration

```typescript
// On session creation, fetch the debug URL
const debugResponse = await fetch(
  `https://api.browserbase.com/v1/sessions/${sessionId}/debug`,
  { headers: { 'x-bb-api-key': process.env.BROWSERBASE_API_KEY } }
);
const { debuggerFullscreenUrl } = await debugResponse.json();

// In browser-preview.tsx
<iframe
  src={debuggerFullscreenUrl}
  className="w-full h-full rounded-lg border-0"
  allow="clipboard-read; clipboard-write"
  sandbox="allow-same-origin allow-scripts"
/>
```

---

## 15. Open Questions

- [ ] LiveKit Cloud vs self-hosted agent worker deployment — depends on demo latency needs
- [ ] Vercel AI Gateway vs direct Anthropic API — gateway adds routing flexibility but another dependency
- [ ] Screenshot storage: inline base64 vs Convex file storage — base64 simpler for MVP
- [ ] Browserbase region selection — `us-west-2` closest to likely demo location?
- [ ] Multi-tab support — does the demo need to open links in new tabs?
