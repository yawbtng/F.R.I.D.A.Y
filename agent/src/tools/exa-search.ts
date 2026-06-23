// Exa web search — fast, structured web search via Next.js API route
// Calls /api/browser/search which uses Exa under the hood

import { llm } from '@livekit/agents';
import { z } from 'zod';
import { agentFetch } from '../lib/agent-fetch.js';
import { getVoiceContext } from './shared.js';

interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
}

interface SearchResult {
  results: SearchResultItem[];
}

export const webSearch = llm.tool({
  description:
    'Search the web for current information. Use this when the user asks a question that requires up-to-date data or when you need to find a URL.',
  parameters: z.object({
    query: z.string().describe('The search query'),
  }),
  execute: async ({ query }, { ctx }) => {
    ctx.session.say('Searching the web.', { allowInterruptions: true });

    const result = await agentFetch<SearchResult>({
      path: '/api/browser/search',
      body: { query },
      ctx: getVoiceContext(),
    });

    if (result.results.length === 0) {
      return 'No results found for that query.';
    }

    const lines = result.results.map(
      (r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`,
    );
    return `Search results for "${query}":\n${lines.join('\n\n')}`;
  },
});
