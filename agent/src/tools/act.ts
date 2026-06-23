// act tool — performs a natural language action on the current page

import { llm } from '@livekit/agents';
import { z } from 'zod';
import { agentFetchWithHeartbeat } from '../lib/agent-fetch.js';
import { getVoiceContext } from './shared.js';

interface ActResult {
  description: string;
}

export const act = llm.tool({
  description:
    'Perform an action on the current page such as clicking a button, typing text, scrolling, or interacting with any element. Describe the action in natural language.',
  parameters: z.object({
    instruction: z
      .string()
      .describe('Natural language description of the action to perform (e.g. "click the login button")'),
  }),
  execute: async ({ instruction }, { ctx }) => {
    ctx.session.say('On it.', { allowInterruptions: true });

    const result = await agentFetchWithHeartbeat<ActResult>(
      {
        path: '/api/browser/act',
        body: { instruction },
        ctx: getVoiceContext(),
        timeoutMs: 30_000,
      },
      ctx.session,
    );

    return `Done. ${result.description}`;
  },
});
