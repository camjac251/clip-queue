<p align="center">
  <br />
  <img width="150" height="150" src="./apps/web/public/icon.png" alt="Logo">
  <h1 align="center"><b>Clip Queue</b></h1>
  <p align="center">
    Self-hosted clip queue for Twitch streamers.
  </p>
</p>

Monitors your Twitch chat via EventSub and automatically queues clips submitted by viewers.

> **Note:** This is a fork of the [original Clip Queue project](https://github.com/jordanshatford/clip-queue) by [Jordan Shatford](https://github.com/jordanshatford) with additional features and enhancements.

## Quick Start

**Prerequisites:**
- Node.js 20+
- [Twitch Developer Application](https://dev.twitch.tv/console/apps) (Client ID & Secret)

**Setup:**

```bash
# Install dependencies
corepack enable && pnpm install

# Configure environment
cp .env.example .env
# Edit .env with: TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_CHANNEL_NAME, SESSION_SECRET

# Get bot token (opens browser)
pnpm api setup

# Start servers
pnpm dev:all
```

Open http://localhost:5173 and post a clip URL in your Twitch chat to test.

## Supported Platforms

- **Twitch** — Clips
- **Kick** — Clips

## Chat Commands

Moderators and broadcasters can control the queue via chat:

```
!cq open/close        Open/close queue for submissions
!cq next/prev         Navigate clips
!cq clear             Clear all clips
!cq setlimit <n>      Set max queue size
!cq enableautomod     Require manual approval
!cq disableautomod    Auto-approve clips
```

See [CLAUDE.md](./CLAUDE.md) for full command list.

## Architecture

**Backend:** Node.js + Express + SQLite
- Twitch EventSub WebSocket client for persistent chat monitoring
- REST API with ETag-optimized HTTP polling for state sync
- Drizzle ORM for database operations

**Frontend:** Vue.js + PrimeVue
- HTTP polling client (2-second intervals)
- Twitch OAuth for authentication
- Multi-device sync via shared backend state

**Features:** Duplicate detection, popularity-based sorting, batch operations, manual moderation, history tracking, 13 languages.

## Development

pnpm monorepo with Turborepo. All commands run from project root.

```bash
# Development
pnpm dev:all           # Run backend + frontend
pnpm api dev           # Backend only
pnpm web dev           # Frontend only

# Build & test
pnpm build             # Build all packages
pnpm typecheck         # Type check all packages
pnpm test              # Run all tests
pnpm lint              # Lint all packages

# Makefile shortcuts
make help              # List all available commands
make api-setup         # Get bot token
make dev-all           # Run both servers
```

**Structure:**
- `apps/api` - Backend server
- `apps/web` - Frontend SPA
- `packages/` - Shared libraries (platforms, services, ui, etc)

See [CLAUDE.md](./CLAUDE.md) for architecture details.

## Deployment

**Docker:**
```bash
docker-compose up -d clip-queue-backend
```

**Manual:**
```bash
pnpm build
pnpm --filter @cq/api start
```

Frontend can be deployed to Cloudflare Pages, Vercel, or served statically.

## Troubleshooting

| Issue                      | Solution                                           |
| -------------------------- | -------------------------------------------------- |
| EventSub won't connect     | Re-run `pnpm api setup` to refresh token           |
| Clips not being added      | Check queue is open (`!cq open`) and server logs   |
| Token expired              | Tokens expire after 60 days, re-run setup          |
