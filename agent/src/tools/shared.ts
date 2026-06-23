// Per-process voice session context.
//
// The voice agent drives exactly ONE browser, so a single holder is correct here.
// Swarm workers do NOT use this — the orchestrator builds an explicit AgentContext
// per browser and passes it to agentFetch (see lib/agent-fetch.ts). Keeping the two
// paths separate is what lets N workers run in parallel without cancelling each other.

import type { AgentContext } from '../lib/agent-fetch.js';

let _voiceContext: AgentContext | null = null;

export function setVoiceContext(ctx: AgentContext): void {
  _voiceContext = ctx;
}

export function getVoiceContext(): AgentContext {
  if (!_voiceContext) throw new Error('Voice session context not set');
  return _voiceContext;
}
