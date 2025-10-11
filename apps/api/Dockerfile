FROM node:20-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/api ./apps/api

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build packages
RUN pnpm --filter @cq/services build
RUN pnpm --filter @cq/providers build
RUN pnpm --filter @cq/sources build
RUN pnpm --filter @cq/api build

# Create data directory for SQLite
RUN mkdir -p /app/data

WORKDIR /app/apps/api

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "dist/index.js"]
