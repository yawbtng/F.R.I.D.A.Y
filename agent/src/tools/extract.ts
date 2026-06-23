// extract tool — extracts structured data from the current page

import { llm } from '@livekit/agents';
import { z } from 'zod';
import { agentFetchWithHeartbeat } from '../lib/agent-fetch.js';
import { getVoiceContext } from './shared.js';

interface ExtractResult {
  data: unknown;
}

export const extract = llm.tool({
  description:
    'Extract structured data from the current page. Describe what information you want to pull out.',
  parameters: z.object({
    instruction: z
      .string()
      .describe('What data to extract from the page (e.g. "get all product names and prices")'),
  }),
  execute: async ({ instruction }, { ctx }) => {
    ctx.session.say('Extracting that information.', { allowInterruptions: true });

    const result = await agentFetchWithHeartbeat<ExtractResult>(
      {
        path: '/api/browser/extract',
        body: { instruction },
        ctx: getVoiceContext(),
        timeoutMs: 30_000,
      },
      ctx.session,
    );

    const data =
      typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2);
    return `Extracted data:\n${data}`;
  },
});
