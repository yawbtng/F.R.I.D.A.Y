FROM node:22-slim

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY agent/package.json agent/
COPY convex/ convex/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @friday/agent

# Copy agent source
COPY agent/ agent/

# Run agent worker
CMD ["pnpm", "--filter", "@friday/agent", "start"]
