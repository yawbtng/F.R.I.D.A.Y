// screenshot tool — captures current page as compressed JPEG

import { llm } from '@livekit/agents';
import { agentFetch } from '../lib/agent-fetch.js';
import { getBrowserSessionId } from './shared.js';

interface ScreenshotResult {
  screenshot: string;
}

export const screenshot = llm.tool({
  description:
    'Take a screenshot of the current page. The screenshot is stored and displayed to the user automatically.',
  execute: async (_args, { ctx }) => {
    ctx.session.say('Taking a screenshot.', { allowInterruptions: true });

    await agentFetch<ScreenshotResult>({
      path: '/api/browser/screenshot',
      body: {},
      sessionId: getBrowserSessionId(),
    });

    return 'Screenshot captured and sent to the user.';
  },
});
