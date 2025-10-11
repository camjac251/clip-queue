<p align="center">
  <br />
  <img width="150" height="150" src="./apps/web/public/icon.png" alt="Logo">
  <h1 align="center"><b>Clip Queue</b></h1>
  <p align="center">
    An enhanced clip viewing experience.
    <br />
    <a href="https://clipqueue.vercel.app/"><strong>clipqueue.vercel.app »</strong></a>
    <br />
    <br />
  </p>
</p>

Clip Queue integrates into a user's chat and queues clips submitted in chat by their viewers. Clips can be easily viewed through the web interface.

## 🚀 Quick Start

**New Architecture:** Self-hosted backend + Cloudflare Pages frontend for continuous daemon operation!

### 1. Set Up Environment

```bash
cp .env.example .env
```

Edit `.env` and set:
- `TWITCH_CLIENT_ID` - Your Twitch app client ID
- `TWITCH_CLIENT_SECRET` - Your Twitch app secret
- `TWITCH_CHANNEL_NAME` - Your Twitch channel (lowercase)

### 2. Get Your Bot Token

```bash
pnpm api setup
# Or: make api-setup
```

This opens your browser to authorize the app. Copy the token it prints and paste it into `.env`:

```bash
TWITCH_BOT_TOKEN=your_token_here
```

### 3. Start the App

**Option A: Both servers in one command**
```bash
pnpm dev:all
```

**Option B: Separate terminals**
```bash
# Terminal 1 - Backend
pnpm api dev
# Or: make api-dev

# Terminal 2 - Frontend
pnpm web dev
# Or: make web-dev
```

💡 All commands work from the project root - no need to `cd`!

### 4. Test It

1. Open http://localhost:5173
2. Post a Twitch clip URL in your chat (e.g., `https://clips.twitch.tv/...`)
3. Clip appears in the queue! 🎉

**Chat Commands** (mod/broadcaster only):
- `!cq open` - Open queue for clip submissions
- `!cq close` - Close queue (mods can still submit)
- `!cq clear` - Clear all clips from queue
- `!cq next` - Skip to next clip
- `!cq prev` - Go back to previous clip
- `!cq purgehistory` - Clear history

## Architecture

**Backend:** Self-hosted Node.js server
- 🔄 Persistent Twitch EventSub chat monitoring
- 📡 WebSocket (Socket.io) for real-time sync
- 💾 SQLite database for persistence
- 🐳 Docker-ready with Traefik support

**Frontend:** Vue.js SPA (Cloudflare Pages or self-hosted)
- 🌐 WebSocket connection to backend
- 📦 Real-time queue updates across all clients
- 🎨 PrimeVue UI components

See [ADR 002](docs/adr/002-self-hosted-docker-backend.md) for architecture details.

## Features

- ✅ **Persistent chat monitoring** via Twitch EventSub (no browser needed!)
- ✅ **Multi-user support** - Share queue across multiple devices/viewers
- ✅ **Real-time synchronization** - All connected clients see updates instantly
- ✅ Automatically detect clips submitted by viewers in chat
- ✅ Duplicate clip prevention
- ✅ Popular clips rise up in the queue (sorted by submitter count)
- ✅ Support for multiple clip providers: [Twitch](https://www.twitch.tv/), [Kick](https://kick.com/)
- ✅ Automatic moderation and clip removal
- ✅ Settings customization to personalize for your needs
- ✅ UI customization to personalize your experience
- ✅ Multilingual support

## Development

This is a pnpm monorepo. You can run any package script from the project root:

### Common Commands

```bash
# Development
pnpm dev:all        # Run backend + frontend in parallel

# Frontend (apps/web)
pnpm web dev        # Start dev server
pnpm web build      # Build for production

# Backend (apps/api)
pnpm api dev          # Start dev server
pnpm api setup        # Get bot token
pnpm api build        # Build for production

# Database operations
pnpm api db:generate  # Generate migration
pnpm api db:studio    # Open Drizzle Studio GUI

# All packages
pnpm build          # Build everything
pnpm typecheck      # Type check everything
pnpm test           # Run all tests
pnpm lint           # Lint all packages
pnpm format         # Format all packages
```

### Monorepo Structure

**Apps:**
- **`server`**: Node.js backend server (Express + Socket.io + EventSub + SQLite)
- **`web`**: Vue.js SPA frontend (WebSocket client)

**Packages:**
- **`config`**: Common configurations shared between other apps and packages
- **`player`**: Clip player component (Video.js + Vue.js)
- **`providers`**: Clip fetching abstraction (Twitch, Kick)
- **`services`**: API clients for external services
- **`sources`**: ⚠️ *Deprecated* - Chat monitoring moved to backend server
- **`ui`**: UI component library (Vue.js + TailwindCSS + PrimeVue)

### Available Package Shortcuts

| Shortcut | Package | Location |
|----------|---------|----------|
| `pnpm web ...` | @cq/web | apps/web |
| `pnpm api ...` | @cq/api | apps/api |
| `pnpm player ...` | @cq/player | packages/player |
| `pnpm providers ...` | @cq/providers | packages/providers |
| `pnpm services ...` | @cq/services | packages/services |
| `pnpm ui ...` | @cq/ui | packages/ui |

### Examples

```bash
# Type check specific package
pnpm web typecheck
pnpm api typecheck

# Build specific package
pnpm api build

# Install dependency in specific package
pnpm web add socket.io-client
pnpm api add express
```

## Deployment

See `apps/api/README.md` for Docker deployment instructions.

## Contributing

Please refer to the [contributing guide](CONTRIBUTING.md) for development setup and guidelines.
