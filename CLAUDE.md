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
  constants/     Shared constants (events, commands, platforms)
  player/        Video.js clip player component
  platforms/     Clip fetching (TwitchPlatform, KickPlatform)
  queue-ops/     Queue operations (advance, previous, clear, play)
  schemas/       Zod schemas (auth, settings, Twitch types)
  services/      API clients (Twitch Helix API, Kick API)
  ui/            PrimeVue component library
  utils/         Shared utilities (HTTP, cache, URL parsing)
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
io.on("connection", (socket) => {
  // Initial state sync
  socket.emit("sync:state", {
    current: currentClip,
    upcoming: queue.toArray(),
    history: history.toArray(),
    isOpen: isQueueOpen,
  });
});

// Broadcast events:
io.emit("clip:added", { clip });
io.emit("clip:removed", { clipId });
io.emit("queue:current", { clip });
io.emit("queue:cleared", {});
io.emit("history:cleared", {});
io.emit("queue:opened", {});
io.emit("queue:closed", {});
io.emit("settings:updated", { settings });
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

#### 7. Authentication & Authorization

**Backend** (`apps/api/src/auth.ts`, `apps/api/src/index.ts`):

- Middleware: `authenticate()`, `requireModerator()`, `requireBroadcaster()`
- Token validation with Twitch API (`/oauth2/validate`) - 5-minute cache
- Role checking via Twitch Helix API - 2-minute cache (faster mod changes)
- Rate limiting: 100 req/15min (general), 20 req/15min (auth failures)
- Security headers: CSP, HSTS (1-year), Referrer-Policy
- Input validation: Zod schemas on all POST endpoints
- JSON body size limit: 1MB (DoS prevention)

**Auth Endpoints:**

- `GET /api/auth/me` → get user info + roles (authenticated)
- `POST /api/auth/logout` → invalidate server-side caches (authenticated)
- `GET /api/auth/validate` → proactive token validation (authenticated)
- `GET /api/auth/cache/stats` → cache statistics (broadcaster only)
- `POST /api/auth/cache/clear` → manual cache clear (broadcaster only)

**Protected Routes:**

- **Public**: `/api/health`, `/api/queue` (GET), `/api/settings` (GET)
- **Moderator**: `/api/queue/submit|advance|previous|remove|play` (POST)
- **Broadcaster**: `/api/queue/open|close` (POST), `/api/queue` (DELETE), `/api/queue/history` (DELETE), `/api/settings` (PUT), `/api/auth/cache/*`

**Frontend** (`apps/web/src/stores/user.ts`, `apps/web/src/utils/api.ts`):

- OAuth flow with CSRF protection (state parameter in `packages/services/src/twitch/auth.ts`)
- Fetches user role from `/api/auth/me` endpoint after login
- Proactive token validation every 5 minutes via `/api/auth/validate`
- Auto-logout on token expiration or validation failure
- Role-based computed properties: `canControlQueue`, `canManageSettings`
- UI conditionally shows/hides controls based on permissions
- `fetchWithAuth()` utility with 30-second timeout, handles 401/403 responses
- WebSocket auth failure notifications via toast messages

**WebSocket Authentication** (`apps/api/src/index.ts`, `apps/web/src/stores/websocket.ts`):

- Socket.io middleware validates token on connection
- Unauthenticated connections allowed (read-only)
- Token passed in handshake: `socket.handshake.auth.token`
- Auth errors emit user-visible notifications

#### 8. OAuth Router (Authorization Code + PKCE)

**Implementation** (`apps/api/src/oauth.ts`):

- Uses Authorization Code + PKCE flow (not deprecated Implicit Grant)
- Tokens stored in httpOnly cookies (XSS protection)
- Session store uses SQLite (`connect-sqlite3`) for OAuth state + PKCE verifier
- Session secret required via `SESSION_SECRET` env var

**OAuth Endpoints:**

- `GET /api/oauth/login` → Redirect to Twitch OAuth with PKCE challenge
- `GET /api/oauth/callback` → Exchange code for tokens, set httpOnly cookies
- `POST /api/oauth/refresh` → Refresh expired access token
- `POST /api/oauth/logout` → Clear authentication cookies

**Security Features:**

- PKCE prevents authorization code interception attacks
- httpOnly cookies prevent JavaScript access to tokens
- Secure cookie flag in production (HTTPS only)
- SameSite=strict for CSRF protection
- 60-day token lifetime (matches Twitch refresh token)

#### 9. Path Resolution Utilities

**Implementation** (`apps/api/src/paths.ts`):

- Uses `find-up-simple` to locate workspace root (`pnpm-workspace.yaml`)
- Avoids hardcoded relative paths (`../../.env`) that break when `process.cwd()` changes
- Works regardless of where commands are run from (root or subdirectory)
- Node.js-only utility (kept in `@cq/api` to avoid bundling in browser code)

**Functions:**

- `findWorkspaceRoot()` → Walk up directories to find workspace root (cached)
- `getWorkspaceRoot()` → Get cached workspace root
- `resolveFromRoot(...paths)` → Resolve paths relative to workspace root

**Usage:**

```typescript
import { resolveFromRoot } from './paths.js'

// Load .env from workspace root (works from any subdirectory)
config({ path: resolveFromRoot('.env') })

// Database path
const dbPath = resolveFromRoot('apps', 'api', 'data', 'clips.db')

// Migrations path
const migrationsPath = resolveFromRoot('apps', 'api', 'drizzle')
```

#### 10. Bootstrap Pattern (server.ts)

**Problem**: ESM (ES Modules) **hoists all imports** to the top before running any module body code. This causes issues when modules access `process.env` at import time (e.g., creating `session()` middleware), because dotenv hasn't loaded yet.

**Solution**: Bootstrap entry point (`apps/api/src/server.ts`) that:
1. Loads `.env` via dotenv **first**
2. Validates all required env vars
3. Only then imports and runs `index.ts`

**Implementation**:

```typescript
// server.ts (entry point)
import { config } from 'dotenv'
import { resolveFromRoot } from './paths.js'

config({ path: resolveFromRoot('.env') })  // Load FIRST
validateEnvironment()                      // Validate SECOND
import('./index.js')                       // Import app LAST
```

**Benefits**:
- Explicit load order (no ESM hoisting surprises)
- Centralized env validation with clear error messages
- No need for lazy initialization wrappers
- Standard Node.js pattern

**package.json scripts**:
```json
{
  "dev": "tsx watch src/server.ts",
  "start": "node dist/server.js"
}
```

### Environment Variables

**Required for running the server** (validated at startup in `apps/api/src/server.ts`):

```env
TWITCH_CLIENT_ID=your_client_id
TWITCH_BOT_TOKEN=your_user_token       # Get via: pnpm api setup (or: make api-setup)
TWITCH_CHANNEL_NAME=your_channel       # Lowercase
SESSION_SECRET=your_random_secret      # Generate with: openssl rand -base64 48
```

**Required for setup script** (`pnpm api setup`):

```env
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret  # OAuth token exchange
```

**Optional**:

```env
API_URL=http://localhost:3000          # API base URL (for OAuth callbacks)
FRONTEND_URL=http://localhost:5173     # CORS origin
PORT=3000                              # Server port
DB_PATH=./data/clips.db               # SQLite location
```

**Frontend** (`apps/web`):

```env
VITE_TWITCH_CLIENT_ID=your_client_id  # For OAuth login flow
VITE_API_URL=http://localhost:3000    # Backend WebSocket URL
VITE_TWITCH_REDIRECT_URI=http://localhost:5173  # OAuth callback URL
```

### Critical Files

**Backend**:

1. `apps/api/src/server.ts` - Bootstrap entry point (loads .env, validates env vars, imports index.ts)
2. `apps/api/src/index.ts` - Main server, event handlers, API endpoints
3. `apps/api/src/eventsub.ts` - Twitch EventSub WebSocket client
4. `apps/api/src/auth.ts` - Authentication middleware, token validation, role checking
5. `apps/api/src/oauth.ts` - OAuth router (Authorization Code + PKCE flow)
6. `apps/api/src/db.ts` - Database operations (Drizzle)
7. `apps/api/src/schema.ts` - Database schema + Zod validators
8. `apps/api/src/paths.ts` - Workspace path resolution utilities
9. `apps/api/src/setup.ts` - OAuth setup script for bot token generation

**Frontend**:

1. `apps/web/src/stores/queue-server.ts` - WebSocket sync, queue state
2. `apps/web/src/stores/websocket.ts` - Socket.io connection manager
3. `apps/web/src/stores/user.ts` - User authentication, role management, token validation
4. `apps/web/src/utils/api.ts` - Authenticated fetch wrapper, timeout handling, error responses
5. `apps/web/src/utils/events.ts` - Auth event system for toast notifications
6. `apps/web/src/utils/schemas.ts` - Zod schemas for API response validation

**Shared**:

1. `packages/platforms/src/clip-list.ts` - Queue sorting logic
2. `packages/platforms/src/types.ts` - `Clip` interface
3. `packages/platforms/src/twitch.ts` - Twitch clip fetching
4. `packages/platforms/src/kick.ts` - Kick clip fetching
5. `packages/utils/src/http.ts` - HTTP utilities (fetch wrappers)
6. `packages/utils/src/cache.ts` - TTL cache implementation
7. `packages/queue-ops/src/index.ts` - Queue operations (advance, previous, clear)
8. `packages/constants/src/events.ts` - WebSocket event constants
9. `packages/schemas/src/auth.ts` - Auth-related Zod schemas

### Common Patterns

#### Adding a New Clip Platform

1. Create `packages/platforms/src/newplatform.ts`:

```typescript
export class NewPlatform extends PlatformBase {
  async getClip(url: string): Promise<Clip | null> {
    // Fetch metadata, normalize to Clip type
    return {
      platform: Platform.NEW,
      id: "...",
      url,
      embedUrl,
      thumbnailUrl,
      title,
      channel,
      creator,
      submitters: [],
    };
  }
}
```

2. Add URL detection in `apps/api/src/index.ts`:

```typescript
if (url.includes("newplatform.com/clips/")) {
  await handleClipSubmission(url, message.username, canAutoApprove);
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
io.emit("my:event", { data: "value" });
```

**Client** (`queue-server.ts`):

```typescript
function initialize() {
  websocket.on("my:event", handleMyEvent as WebSocketEventHandler);
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

- **Bootstrap pattern**: Entry point is `server.ts` (not `index.ts`) - loads `.env` before any imports to avoid ESM hoisting issues
- **EventSub requires valid token**: Run `pnpm api setup` (or `make api-setup`) to generate `TWITCH_BOT_TOKEN`
- **SESSION_SECRET required**: OAuth flow needs `SESSION_SECRET` env var - generate with `openssl rand -base64 48`
- **Database auto-migrates**: Migrations in `drizzle/` folder apply on server startup
- **ClipList sorting**: Clips with more submitters rise to top (popularity-based)
- **Single channel only**: Server monitors ONE channel per deployment (multi-channel not supported)
- **Settings are JSON blobs**: Stored in SQLite, validated with Zod on read/write
- **Kick URL format**: `kick.com/channel/clips/clip_ID` (note: `/clips/` with `clip_` prefix)
- **toClipUUID()**: Returns `"platform:id"` (lowercase) for duplicate detection
- **Auth caching**: Token cache (5min), role cache (2min) - broadcaster can clear via `/api/auth/cache/clear`
- **Token validation**: Frontend automatically validates token every 5 minutes, auto-logout on expiration
- **WebSocket auth**: Connections work without auth (read-only), but mods/broadcaster need token for controls
- **Path resolution**: Backend uses `apps/api/src/paths.ts` utilities (`resolveFromRoot`) for workspace-relative paths - avoids `process.cwd()` issues
