// Friday Agent Worker — LiveKit Agent entry point
// This is a long-running Node.js process (NOT serverless).
// It connects to LiveKit Cloud and handles voice interactions.

import { defineAgent, voice, inference, type JobContext, type JobProcess } from '@livekit/agents';
import * as silero from '@livekit/agents-plugin-silero';
import { agentTools, setVoiceContext } from './tools/index.js';
import { FRIDAY_SYSTEM_PROMPT } from './friday-agent.js';

// British Lady voice ID for Cartesia
const CARTESIA_VOICE_ID = '79a125e8-cd45-4c13-8a67-188112f4dd22';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// OpenRouter LLM via OpenAI-compatible API
const openRouterLLM = new inference.LLM({
  model: 'xai/grok-4.1-fast',
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || '',
});

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    // Load VAD model once at worker startup, NOT per-session.
    // This avoids ~2s latency on each new session.
    proc.userData.vad = await silero.VAD.load();
  },

  entry: async (ctx: JobContext) => {
    await ctx.connect();

    // Create a Browserbase session via the Next.js API
    const sessionRes = await fetch(`${APP_URL}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create' }),
    });

    if (!sessionRes.ok) {
      const err = await sessionRes.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(
        `Failed to create browser session: ${(err as { error: string }).error || `HTTP ${sessionRes.status}`}`,
      );
    }

    const sessionData = (await sessionRes.json()) as { sessionId: string; token: string };
    setVoiceContext({ sessionId: sessionData.sessionId, token: sessionData.token });

    const agent = new voice.Agent({
      instructions: FRIDAY_SYSTEM_PROMPT,
      vad: ctx.proc.userData.vad as silero.VAD,
      stt: 'deepgram/nova-3',
      llm: openRouterLLM,
      tts: `cartesia/sonic-3:${CARTESIA_VOICE_ID}`,
      allowInterruptions: true,
      tools: agentTools,
    });

    const session = new voice.AgentSession({});

    await session.start({ agent, room: ctx.room });
    session.generateReply({
      instructions: 'Greet the user. Introduce yourself as Friday.',
    });
  },
});
