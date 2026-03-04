// navigate tool — navigates browser to a URL via agentFetch

import { llm } from '@livekit/agents';
import { z } from 'zod';
import { agentFetch } from '../lib/agent-fetch.js';
import { getBrowserSessionId } from './shared.js';

interface NavigateResult {
  currentUrl: string;
  title: string;
  screenshot: string;
}

export const navigate = llm.tool({
  description: 'Navigate the browser to a specific URL. Use this when the user wants to visit a website.',
  parameters: z.object({
    url: z.string().describe('The URL to navigate to (e.g. "https://example.com")'),
  }),
  execute: async ({ url }, { ctx }) => {
    ctx.session.say('Navigating there now.', { allowInterruptions: true });

    const result = await agentFetch<NavigateResult>({
      path: '/api/browser/navigate',
      body: { url },
      sessionId: getBrowserSessionId(),
    });

    return `Navigated to ${result.currentUrl}. Page title: ${result.title}.`;
  },
});
