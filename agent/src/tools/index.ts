// Agent tools barrel export
// Each tool calls the Next.js API via agentFetch

export { navigate } from './navigate.js';
export { act } from './act.js';
export { extract } from './extract.js';
export { observe } from './observe.js';
export { screenshot } from './screenshot.js';
export { webSearch } from './exa-search.js';
export { setBrowserSessionId, getBrowserSessionId } from './shared.js';

// Re-export all tools as a record for passing to voice.Agent
import { llm } from '@livekit/agents';
import { navigate } from './navigate.js';
import { act } from './act.js';
import { extract } from './extract.js';
import { observe } from './observe.js';
import { screenshot } from './screenshot.js';
import { webSearch } from './exa-search.js';

export const agentTools: llm.ToolContext = {
  navigate,
  act,
  extract,
  observe,
  screenshot,
  web_search: webSearch,
};
