// observe tool — lists interactive elements on the current page

import { llm } from '@livekit/agents';
import { z } from 'zod';
import { agentFetch } from '../lib/agent-fetch.js';
import { getBrowserSessionId } from './shared.js';

interface ObserveAction {
  description: string;
  selector: string;
  type: string;
}

interface ObserveResult {
  actions: ObserveAction[];
}

export const observe = llm.tool({
  description:
    'List interactive elements on the current page. Use this to understand what actions are available before performing one.',
  parameters: z.object({
    instruction: z
      .string()
      .describe(
        'What to look for on the page (e.g. "find all navigation links" or "locate the search box")',
      ),
  }),
  execute: async ({ instruction }, { ctx }) => {
    ctx.session.say('Scanning the page.', { allowInterruptions: true });

    const result = await agentFetch<ObserveResult>({
      path: '/api/browser/observe',
      body: { instruction },
      sessionId: getBrowserSessionId(),
    });

    if (result.actions.length === 0) {
      return 'No interactive elements found matching that description.';
    }

    const lines = result.actions.map(
      (a, i) => `${i + 1}. [${a.type}] ${a.description}`,
    );
    return `Found ${result.actions.length} element(s):\n${lines.join('\n')}`;
  },
});
