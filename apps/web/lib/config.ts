// Centralized environment variable access with defaults
export const config = {
  browserbase: {
    apiKey: process.env.BROWSERBASE_API_KEY!,
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
  },
  convex: {
    url: process.env.NEXT_PUBLIC_CONVEX_URL!,
  },
  agentSecret: process.env.AGENT_API_SECRET!,
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
} as const;
