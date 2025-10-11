# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clip Queue is a self-hosted web application with a Node.js backend that continuously monitors Twitch chat via EventSub, automatically queuing clips submitted by viewers. The Vue.js frontend connects to the backend via WebSocket for real-time synchronization across multiple devices.

## Development Commands

### Setup

```sh
# Install dependencies (uses pnpm via corepack)
corepack enable && corepack install
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with: TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_CHANNEL_NAME

# Generate bot token (opens browser for OAuth)
pnpm api setup
# Or: make api-setup
# Copy token output into .env as TWITCH_BOT_TOKEN
```

### Running Locally

```sh
# Run both backend and frontend (recommended)
pnpm dev:all
# Or: make dev-all

# Or run separately:
pnpm api dev  # Backend on port 3000 (or: make api-dev)
pnpm web dev      # Frontend on port 5173 (or: make web-dev)

# Per-package commands work from root
pnpm api <script>    # Run backend/server script
pnpm web <script>        # Run web script
pnpm platforms <script>  # Run platforms script

# Examples:
pnpm api typecheck   # Type check backend
pnpm web build           # Build frontend
pnpm platforms typecheck # Type check platforms
```

**Note**: A `Makefile` is available with aliases for common commands. Run `make help` to see all available commands.

### Common Commands

```sh
# Build and test
pnpm build              # Build all packages
pnpm typecheck          # Type check all packages
pnpm test               # Run all tests
pnpm test:coverage      # Run tests with coverage

# Linting and formatting
pnpm lint               # Check formatting and lint
pnpm lint:fix           # Auto-fix linting issues
pnpm format             # Auto-format all files

# Database operations
pnpm --filter @cq/api db:generate  # Generate migration from schema changes
pnpm --filter @cq/api db:migrate   # Apply migrations to database
pnpm --filter @cq/api db:studio    # Open Drizzle Studio GUI
```

### Changesets

After making changes:

```sh
pnpm changeset
```

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────┐
│  Twitch EventSub WebSocket API          │
│  (channel.chat.message)                 │
└─────────────┬───────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────┐
│  Backend Server (Node.js)               │
│  - Express REST API                     │
│  - Socket.io WebSocket server           │
│  - TwitchEventSubClient (eventsub.ts)   │
│  - Drizzle ORM + SQLite                 │
│  - In-memory ClipList (queue)           │
└─────────────┬───────────────────────────┘
              │
              ↓ (WebSocket sync)
┌─────────────────────────────────────────┐
│  Frontend(s) (Vue.js SPA)               │
│  - Socket.io client                     │
│  - Pinia stores (queue-server.ts)       │
│  - Real-time UI updates                 │
└─────────────────────────────────────────┘
```

**Single-channel design**: Server monitors ONE Twitch channel (configured via `TWITCH_CHANNEL_NAME`). Multiple frontend clients can connect to view/control the same queue.

### Monorepo Structure

```
apps/
  api/           Express + Socket.io + EventSub + SQLite
  web/           Vue.js frontend (WebSocket client)

packages/
  config/        Shared configurations (TypeScript, ESLint, Vitest)
  player/        Video.js clip player component
  platforms/     Clip fetching (TwitchPlatform, KickPlatform)
  services/      API clients (Twitch Helix API, Kick API)
  ui/            PrimeVue component library
```

**Important**: Packages export TypeScript source (`.ts`), not compiled JS. Vite compiles everything together in the web app.

### Key Architectural Decisions

#### 1. Server-Side Chat Monitoring (EventSub)

**Backend** (`apps/api/src/eventsub.ts`):
- Uses Twitch's official EventSub WebSocket API (not IRC/tmi.js)
- Single persistent connection to `wss://eventsub.wss.twitch.tv/ws`
- Subscribes to `channel.chat.message` event type
- Handles automatic reconnection via `session_reconnect` events
- Validates all incoming messages with Zod schemas

**Why EventSub over tmi.js**:
- Official API (IRC is legacy)
- Better reliability and structured data
- Auto-reconnect built into protocol
- Access to badge info (mod/broadcaster detection)

#### 2. Database Layer (Drizzle ORM + SQLite)

**Schema** (`apps/api/src/schema.ts`):

```typescript
// Normalized structure (no JSON blobs)
clips:
  - id: TEXT PRIMARY KEY              // UUID: "platform:clip_id"
  - platform: TEXT (twitch|kick)
  - clipId, url, embedUrl, thumbnailUrl, title, channel, creator, category
  - status: TEXT (approved|pending|rejected|played)
  - submittedAt, playedAt: TIMESTAMP

clip_submitters:                       // Many-to-many relationship
  - clipId → clips.id (cascade delete)
  - submitter: TEXT
  - UNIQUE(clipId, submitter)          // Prevents duplicate submissions

settings:                              // Single-row global settings
  - version: INTEGER                   // Schema version for migrations
  - commands, queue, logger: JSON      // Validated with Zod
```

**Database Operations** (`apps/api/src/db.ts`):
- All operations use Drizzle ORM (type-safe queries)
- `upsertClip()` uses transactions to prevent race conditions
- `getClipsByStatus()` optimized to avoid N+1 queries (bulk fetch submitters)
- Zod validates all JSON data on read/write

**Migrations**:
```sh
# 1. Modify schema.ts
# 2. Generate migration
pnpm api db:generate
# 3. Drizzle creates: drizzle/0001_random_name.sql
# 4. Add SQL comment at top to document changes:
/**
 * Migration: Add channels table
 * Date: 2025-10-07
 *
 * Adds multi-channel support...
 */
# 5. Migrations auto-apply on server startup
```

#### 3. Dual State Management

**Backend maintains TWO copies** of queue state:

1. **In-Memory** (`ClipList` in `index.ts`):
   - Fast operations
   - Popularity-based sorting (by `submitters.length`)
   - Source of truth for current session

2. **Database** (SQLite via Drizzle):
   - Persistence across restarts
   - Status tracking (approved/pending/rejected/played)
   - Historical data (playedAt timestamps)

**Sync flow**:
```
Chat message → handleClipSubmission()
  ↓
  ├─ Fetch clip metadata (TwitchPlatform.getClip())
  ├─ upsertClip(db, ...) → SQLite
  └─ queue.add(clip) → in-memory ClipList
  ↓
io.emit('clip:added', clip) → all connected clients
```

#### 4. Real-Time WebSocket Sync

**Server Events** (`apps/api/src/index.ts`):
```typescript
io.on('connection', (socket) => {
  // Initial state sync
  socket.emit('sync:state', {
    current: currentClip,
    upcoming: queue.toArray(),
    history: history.toArray(),
    isOpen: isQueueOpen
  })
})

// Broadcast events:
io.emit('clip:added', { clip })
io.emit('clip:removed', { clipId })
io.emit('queue:current', { clip })
io.emit('queue:cleared', {})
io.emit('history:cleared', {})
io.emit('queue:opened', {})
io.emit('queue:closed', {})
io.emit('settings:updated', { settings })
```

**Client Store** (`apps/web/src/stores/queue-server.ts`):
- Connects to `VITE_API_URL` (defaults to `http://localhost:3000`)
- Listens for server events and updates local Pinia state
- Sends commands via REST API (not WebSocket):
  - `GET /api/health` → server health check
  - `GET /api/queue` → get current queue state
  - `GET /api/settings` → get app settings
  - `POST /api/queue/submit` → manually add clip
  - `POST /api/queue/advance` → next clip
  - `POST /api/queue/previous` → previous clip
  - `POST /api/queue/open` → open queue
  - `POST /api/queue/close` → close queue
  - `POST /api/queue/play` → play specific clip
  - `POST /api/queue/remove` → remove specific clip
  - `DELETE /api/queue` → clear queue
  - `DELETE /api/queue/history` → clear history
  - `PUT /api/settings` → update app settings

#### 5. Platform/Service Separation

**Services** (`packages/services`): Low-level API clients
- `twitch/api.ts`: Helix API (getClips, getGames, getUsers)
- `twitch/auth.ts`: OAuth flow
- `kick/index.ts`: Kick API client

**Platforms** (`packages/platforms`): High-level clip abstraction
- `TwitchPlatform`: Fetches clip + game metadata, normalizes to `Clip` type
- `KickPlatform`: Fetches Kick clips, normalizes to `Clip` type
- `ClipList`: Priority queue implementation (sorts by submitter count)
- `toClipUUID()`: Generates unique ID (`"twitch:abc123"` or `"kick:xyz789"`)

**URL Detection** (`apps/api/src/index.ts`):
```typescript
// Twitch: https://twitch.tv/.../clip/... or https://clips.twitch.tv/...
if (url.includes('twitch.tv') && (url.includes('clip') || url.includes('/clips/')))

// Kick: https://kick.com/channel/clips/clip_ID
if (url.includes('kick.com/') && url.includes('/clips/clip_'))
```

#### 6. Chat Commands

**Detection** (`apps/api/src/index.ts`):
- Messages starting with `settings.commands.prefix` (default: `!cq`)
- Only mods/broadcasters can execute commands
- Parsed in `handleChatCommand()`

**Available Commands** (currently implemented):
- `open/close` → toggle queue submissions
- `clear` → delete all approved clips
- `next` → move current to history, shift next from queue
- `prev/previous` → move current back to queue, pop from history
- `purgehistory` → clear history

**Note**: The schema (`apps/api/src/schema.ts`) defines additional commands not yet implemented: `setlimit`, `removelimit`, `removebysubmitter`, `removebyplatform`, `enableplatform`, `disableplatform`, `enableautomod`, `disableautomod`, `purgecache`

### Environment Variables

**Required for running the server** (validated at startup in `validateEnvironment()`):
```env
TWITCH_CLIENT_ID=your_client_id
TWITCH_BOT_TOKEN=your_user_token       # Get via: pnpm api setup (or: make api-setup)
TWITCH_CHANNEL_NAME=your_channel       # Lowercase
```

**Required for setup script** (`pnpm api setup`):
```env
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret  # OAuth token exchange
```

**Optional**:
```env
FRONTEND_URL=http://localhost:5173     # CORS origin
PORT=3000                              # Server port
DB_PATH=./data/clips.db               # SQLite location
```

**Frontend** (`apps/web`):
```env
VITE_API_URL=http://localhost:3000    # Backend WebSocket URL
```

### Critical Files

**Backend**:
1. `apps/api/src/index.ts` - Main server, event handlers, API endpoints
2. `apps/api/src/eventsub.ts` - Twitch EventSub WebSocket client
3. `apps/api/src/db.ts` - Database operations (Drizzle)
4. `apps/api/src/schema.ts` - Database schema + Zod validators
5. `apps/api/src/setup.ts` - OAuth setup script for bot token generation

**Frontend**:
1. `apps/web/src/stores/queue-server.ts` - WebSocket sync, queue state
2. `apps/web/src/stores/websocket.ts` - Socket.io connection manager

**Shared**:
1. `packages/platforms/src/clip-list.ts` - Queue sorting logic
2. `packages/platforms/src/types.ts` - `Clip` interface
3. `packages/platforms/src/twitch.ts` - Twitch clip fetching
4. `packages/platforms/src/kick.ts` - Kick clip fetching

### Common Patterns

#### Adding a New Clip Platform

1. Create `packages/platforms/src/newplatform.ts`:
```typescript
export class NewPlatform extends PlatformBase {
  async getClip(url: string): Promise<Clip | null> {
    // Fetch metadata, normalize to Clip type
    return {
      platform: Platform.NEW,
      id: '...',
      url, embedUrl, thumbnailUrl, title, channel, creator,
      submitters: []
    }
  }
}
```

2. Add URL detection in `apps/api/src/index.ts`:
```typescript
if (url.includes('newplatform.com/clips/')) {
  await handleClipSubmission(url, message.username, canAutoApprove)
}
```

3. Update `schema.ts` enum: `platform: text('platform', { enum: ['twitch', 'kick', 'new'] })`

#### Adding a Database Migration

1. Modify `apps/api/src/schema.ts`
2. Run `pnpm api db:generate`
3. Add SQL comment header to generated migration file
4. Migration auto-applies on next server start (via `initDatabase()`)

#### Adding a New WebSocket Event

**Server**:
```typescript
io.emit('my:event', { data: 'value' })
```

**Client** (`queue-server.ts`):
```typescript
function initialize() {
  websocket.on('my:event', handleMyEvent as WebSocketEventHandler)
}

function handleMyEvent(event: { data: string }) {
  // Update local state
}
```

### Testing

- **Vitest** for unit tests
- Tests colocated: `__tests__/` directories
- Run single test file: `pnpm test <path/to/test.spec.ts>`
- Mocks in `apps/web/src/__tests__/mocks/`

### Common Gotchas

- **EventSub requires valid token**: Run `pnpm api setup` (or `make api-setup`) to generate `TWITCH_BOT_TOKEN`
- **Database auto-migrates**: Migrations in `drizzle/` folder apply on server startup
- **ClipList sorting**: Clips with more submitters rise to top (popularity-based)
- **Single channel only**: Server monitors ONE channel per deployment (multi-channel not supported)
- **Settings are JSON blobs**: Stored in SQLite, validated with Zod on read/write
- **Kick URL format**: `kick.com/channel/clips/clip_ID` (note: `/clips/` with `clip_` prefix)
- **toClipUUID()**: Returns `"platform:id"` (lowercase) for duplicate detection
