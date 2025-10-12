# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clip Queue is a self-hosted web application with a Node.js backend that continuously monitors Twitch chat via EventSub, automatically queuing clips submitted by viewers. The Vue.js frontend polls the backend via HTTP for real-time queue synchronization across multiple devices.

## Development Commands

### Setup

```sh
# Install dependencies (uses pnpm via corepack)
corepack enable && corepack install
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with: TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_CHANNEL_NAME

# Generate bot token (opens browser for OAuth, automatically updates .env)
pnpm api setup
# Or: make api-setup
# Token automatically written to TWITCH_BOT_TOKEN in .env
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

# Internationalization (i18n)
pnpm web i18n:check      # Check for missing translation keys
pnpm web i18n:sync       # Sync missing keys from en.json (adds English placeholders)
pnpm web i18n:translate  # Machine translate all untranslated keys
```

### Internationalization (i18n)

**Framework**: [@inlang/paraglide-js](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) v2.4.0
- Zero runtime overhead, type-safe translations
- 13 locales: ar, de, en, es, fr, hi, it, ja, ko, pt, ru, tr, zh
- Messages stored in `apps/web/messages/*.json`
- Usage: `import * as m from '@/paraglide/messages'` then `m.login()`

**Workflow**:
1. **Add new keys** to `apps/web/messages/en.json` (base locale)
2. **Sync keys** to other locales: `pnpm web i18n:sync` (adds English placeholders)
3. **Machine translate**: `pnpm web i18n:translate` (uses inlang CLI AI translation)
4. **Check completeness**: `pnpm web i18n:check` (validates all locales have same keys)

**Scripts** (`apps/web/scripts/`):
- `check-i18n.ts` - TypeScript script to validate translation completeness
- `sync-i18n.ts` - TypeScript script to sync missing keys across locales

**Turborepo Integration**:
- Tasks defined in `turbo.json`: `i18n:check`, `i18n:sync`, `i18n:translate`
- No caching (translation files change frequently)

**Translation Quality**:
- Machine translations via [@inlang/cli](https://inlang.com/m/2qj2w8pu/app-inlang-cli) are generally good for UI text
- Technical terms and proper nouns may remain in English
- Manual review recommended for user-facing strings

### Git Hooks (Husky)

**Pre-commit Hook** (`.husky/pre-commit`):
- Runs `typecheck`, `lint`, and `test` on **changed packages only** (+ their dependents)
- Uses Turborepo for caching and parallel execution
- **Performance**: ~133ms on cache hit, ~2-10s on cache miss

**Commit Message Hook** (`.husky/commit-msg`):
- Validates commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
- Format: `type(scope?): description` (e.g., `feat: add OAuth support`, `fix(api): handle null clips`)
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`, `revert`

**Skipping Hooks** (for LLM workflows or urgent fixes):
```sh
# Skip all hooks (use sparingly)
git commit --no-verify

# Skip pre-commit only (via env var)
SKIP_HOOKS=1 git commit

# Skip pre-commit via alias (add to .bashrc/.zshrc)
alias gcf='SKIP_HOOKS=1 git commit'
```

**Why this setup works:**
- ✅ Catches 95% of issues before commit (types, lint, tests)
- ✅ Fast with Turborepo caching (instant on subsequent commits)
- ✅ Only checks affected packages (not entire monorepo)
- ✅ Can bypass for LLM workflows (lower token usage)
- ✅ CI still provides final validation

**Troubleshooting:**
```sh
# If hook fails unexpectedly, check what would run:
turbo run typecheck lint test --filter='...[HEAD]' --dry-run

# Clear Turbo cache if stale:
rm -rf .turbo

# Reinstall hooks if missing:
pnpm prepare
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
│  - TwitchEventSubClient (eventsub.ts)   │
│  - Drizzle ORM + SQLite                 │
│  - In-memory ClipList (queue)           │
└─────────────┬───────────────────────────┘
              │
              ↓ (HTTP Polling every 2s with ETag)
┌─────────────────────────────────────────┐
│  Frontend(s) (Vue.js SPA)               │
│  - HTTP polling client                  │
│  - Pinia stores (queue-server.ts)       │
│  - Real-time UI updates                 │
└─────────────────────────────────────────┘
```

**Single-channel design**: Server monitors ONE Twitch channel (configured via `TWITCH_CHANNEL_NAME`). Multiple frontend clients can connect to view/control the same queue.

### Monorepo Structure

```
apps/
  api/           Express + REST API + EventSub + SQLite
  web/           Vue.js frontend (HTTP polling client)

packages/
  config/        Shared configurations (TypeScript, ESLint, Vitest)
  constants/     Shared constants (commands, platforms)
  player/        Video.js clip player component
  platforms/     Clip fetching (TwitchPlatform, KickPlatform)
  queue-ops/     Queue operations (advance, previous, clear, play)
  schemas/       Zod schemas (auth, settings, Twitch types)
  services/      API clients (Twitch Helix API, Kick API)
  ui/            PrimeVue component library
  utils/         Shared utilities (HTTP, cache, URL parsing)
```

**Important**: Packages export TypeScript source (`.ts`), not compiled JS. Vite compiles everything together in the web app.

### Build System (Turborepo)

This project uses **Turborepo** for task orchestration, caching, and parallelization across the monorepo.

**Benefits:**
- **Incremental builds** - Only rebuild changed packages and their dependents
- **Task caching** - Reuse previous build outputs if inputs haven't changed (80-90% faster on cache hits)
- **Parallel execution** - Automatically runs independent tasks in parallel
- **Dependency-aware** - Ensures tasks run in the correct order based on package dependencies

**Task Pipeline:**
```
dev (persistent, depends on ^build)
  ↓
build (cached, outputs: dist/)
  ↓
typecheck (cached)
  ↓
lint (cached)
  ↓
test (cached, outputs: coverage/)
```

**Configuration:**
- `turbo.json` - Task definitions and caching strategy
- `.turboignore` - Files that shouldn't invalidate cache (e.g., README changes)
- `.turbo/` - Local cache directory (gitignored)

**Caching Strategy:**
- **Cached tasks**: `build`, `typecheck`, `lint`, `test` (reuses outputs when inputs unchanged)
- **Non-cached tasks**: `dev`, `setup`, `db:*` (side effects or persistent processes)
- **Cache invalidation**: Changes to source files, dependencies, or env vars (listed in `globalEnv`)

**Common Patterns:**
```sh
# Run task across all packages
turbo run build

# Run task in specific package
turbo run build --filter=@cq/api

# Run task in package + dependencies
turbo run build --filter=@cq/web...

# Run task in package + dependents
turbo run build --filter=...@cq/platforms

# Clear cache
rm -rf .turbo

# Check what would run (dry run)
turbo run build --dry-run
```

**Performance:**
- First build: ~30-45s (cache miss)
- Subsequent builds with no changes: ~0.5s (cache hit)
- Partial changes: ~5-10s (only affected packages)

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

**Note**: The `ws` package is used **only** for backend-to-Twitch EventSub connection. The frontend does **not** use WebSockets.

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
  ├─ Check if queue is open (settings.queue.isOpen)
  ├─ Fetch clip metadata (TwitchPlatform.getClip())
  ├─ Check platform enabled (settings.queue.platforms)
  ├─ Check queue limit (settings.queue.limit)
  ├─ Check auto-moderation (settings.queue.hasAutoModerationEnabled)
  ├─ upsertClip(db, ...) → SQLite
  └─ queue.add(clip) → in-memory ClipList (if approved)
  ↓
State updated (clients will fetch on next poll)
```

#### 4. HTTP Polling Architecture

**Server Endpoint** (`apps/api/src/index.ts`):

```typescript
app.get('/api/queue', (req, res) => {
  // Generate ETag from current state
  const etag = generateStateHash()

  // Check if client has cached version
  const clientETag = req.headers['if-none-match']
  if (clientETag === etag) {
    return res.status(304).end() // Not Modified
  }

  // Return full state with ETag
  res.setHeader('ETag', etag)
  res.setHeader('Cache-Control', 'no-cache')
  res.json({
    current: currentClip,
    upcoming: queue.toArray(),
    history: history.toArray(),
    isOpen: isQueueOpen,
    settings: settings // Include settings for client synchronization
  })
})
```

**Client Store** (`apps/web/src/stores/queue-server.ts`):

- Polls `GET /api/queue` every 2 seconds with ETag header
- Server returns `304 Not Modified` if state unchanged (efficient)
- Immediately fetches state after sending commands (no wait for next poll)
- Sends control commands via REST API:
  - `GET /api/health` → server health check
  - `GET /api/queue` → get current queue state
  - `GET /api/settings` → get app settings
  - `GET /api/queue/pending` → list pending clips (moderator)
  - `GET /api/queue/rejected` → list rejected clips (moderator)
  - `POST /api/queue/submit` → manually add clip (moderator)
  - `POST /api/queue/advance` → next clip (moderator)
  - `POST /api/queue/previous` → previous clip (moderator)
  - `POST /api/queue/open` → open queue (broadcaster)
  - `POST /api/queue/close` → close queue (broadcaster)
  - `POST /api/queue/play` → play specific clip (moderator)
  - `POST /api/queue/remove` → remove specific clip (moderator)
  - `POST /api/queue/approve` → approve pending clip (moderator)
  - `POST /api/queue/reject` → reject pending clip (moderator)
  - `POST /api/queue/rejected/:clipId/restore` → restore rejected clip to queue (moderator)
  - `POST /api/queue/history/:clipId/replay` → replay clip from history (moderator)
  - `DELETE /api/queue/history/:clipId` → delete individual history clip (moderator)
  - `POST /api/queue/batch/remove` → remove multiple clips (moderator)
  - `POST /api/queue/batch/approve` → approve multiple pending clips (moderator)
  - `POST /api/queue/batch/reject` → reject multiple pending clips (moderator)
  - `POST /api/queue/refresh-video-url` → refresh expired Twitch video URL (public)
  - `DELETE /api/queue` → clear queue (broadcaster)
  - `DELETE /api/queue/history` → clear history (broadcaster)
  - `PUT /api/settings` → update app settings (broadcaster)

**Polling Implementation**:

```typescript
const POLL_INTERVAL_MS = 2000 // 2 seconds

async function fetchQueueState() {
  const headers = lastETag ? { 'If-None-Match': lastETag } : {}
  const response = await fetch(`${API_URL}/api/queue`, { headers })

  if (response.status === 304) {
    // State unchanged, nothing to update
    return
  }

  lastETag = response.headers.get('ETag')
  const data = await response.json()
  updateState(data)
}

function initialize() {
  fetchQueueState() // Fetch immediately
  pollInterval = setInterval(fetchQueueState, POLL_INTERVAL_MS)
}
```

**Why Polling Over WebSockets**:

- ✅ **Simpler**: ~350 LOC removed, no connection management
- ✅ **More reliable for OBS**: Browser sources handle HTTP better than persistent WebSocket connections
- ✅ **Efficient with ETag**: Most polls return `304 Not Modified` (empty response)
- ✅ **Same UX**: 2-second polling + immediate fetch after commands = imperceptible latency
- ✅ **Better for burst traffic**: Naturally batched updates during raid events

**Polling Optimizations**:

1. **Enhanced ETag with Submitter Counts**: ETag includes submitter count for each clip to detect priority changes
2. **Full SHA256 Hash (64 chars)**: Reduces collision probability to effectively zero
3. **POST Responses Return Full State**: All POST endpoints return `{ success: true, state: getQueueState() }` - clients can update from response instead of waiting for next poll
4. **Exponential Backoff on Errors**: Poll interval doubles on consecutive errors (2s → 4s → 8s → 16s → 30s max)
5. **Stale ETag Clearing**: After errors, clear ETag to force full refresh on recovery
6. **Batch State Updates (O(n log n))**: Replace ClipList contents in bulk instead of incremental add/remove
7. **Optimistic Updates with Rollback**: UI updates immediately, reverts on error
8. **Adaptive Polling (500ms/2s/10s)**: 500ms after commands, 2s normal, 10s when idle >30s
9. **Poll Jitter (±500ms)**: Random offset prevents thundering herd
10. **Error Recovery**: Stops polling after 5 consecutive errors, clears stale state
11. **Settings Synchronization**: Settings included in queue state and ETag - all clients stay in sync

#### 5. API Endpoints Reference

**Queue Management Endpoints:**

**GET /api/queue/pending** (Moderator)
- Lists all clips pending approval when auto-moderation is enabled
- Returns: `{ clips: Clip[] }`
- Use case: Review queue for manual moderation

**POST /api/queue/approve** (Moderator)
- Approves a pending clip and adds it to the active queue
- Body: `{ clipId: string }`
- Returns: `{ success: true, state: QueueState }`
- Error 404: Clip not found or already processed

**POST /api/queue/reject** (Moderator)
- Rejects a pending clip (sets status to 'rejected')
- Body: `{ clipId: string }`
- Returns: `{ success: true, state: QueueState }`
- Error 404: Clip not found or already processed

**GET /api/queue/rejected** (Moderator)
- Lists all rejected clips
- Returns: `{ clips: Clip[] }`
- Use case: Review rejected clips, restore false positives

**POST /api/queue/rejected/:clipId/restore** (Moderator)
- Restores a rejected clip back to approved status and adds to queue
- URL param: `clipId` (e.g., `twitch:abc123`)
- Returns: `{ success: true, state: QueueState }`
- Error 404: Clip not found or not in rejected status
- Error 400: Invalid clipId parameter

**POST /api/queue/history/:clipId/replay** (Moderator)
- Moves a played clip from history back to the active queue
- URL param: `clipId` (e.g., `twitch:abc123`)
- Returns: `{ success: true, state: QueueState }`
- Error 404: Clip not found in history
- Error 400: Invalid clipId parameter
- Use case: Replay popular clips, requeue accidentally skipped clips

**DELETE /api/queue/history/:clipId** (Moderator)
- Permanently removes a specific clip from history
- URL param: `clipId` (e.g., `twitch:abc123`)
- Returns: `{ success: true, state: QueueState }`
- Error 404: Clip not found in history
- Error 400: Invalid clipId parameter
- Use case: Clean up history without clearing entire list

**Batch Operations Endpoints:**

**POST /api/queue/batch/remove** (Moderator)
- Removes multiple clips from queue at once (sets status to 'rejected')
- Body: `{ clipIds: string[] }` (max 100 clips)
- Returns: `{ success: true, removed: number, failed: string[], notFound: string[], state: QueueState }`
- Partial success pattern: Some clips may fail while others succeed
- Use case: Mass cleanup of spam or off-topic clips

**POST /api/queue/batch/approve** (Moderator)
- Approves multiple pending clips at once
- Body: `{ clipIds: string[] }` (max 100 clips)
- Returns: `{ success: true, approved: number, failed: string[], notFound: string[], state: QueueState }`
- Partial success pattern: Some clips may fail while others succeed
- Use case: Bulk approval after manual review

**POST /api/queue/batch/reject** (Moderator)
- Rejects multiple pending clips at once
- Body: `{ clipIds: string[] }` (max 100 clips)
- Returns: `{ success: true, rejected: number, failed: string[], notFound: string[], state: QueueState }`
- Partial success pattern: Some clips may fail while others succeed
- Use case: Bulk rejection of low-quality submissions

**Input Validation:**
- All endpoints validate input with Zod schemas
- `clipId`: 1-200 characters, format: `platform:id` (e.g., `twitch:abc123`)
- `clipIds`: Array of 1-100 clipIds
- Invalid input returns 400 with error details

**Error Handling:**
- All async endpoints wrapped in `asyncHandler()` for consistent error responses
- Database failures trigger automatic rollback of in-memory state changes
- Structured error responses: `{ error: string, message: string, details?: any }`

**State Synchronization:**
- All successful mutations call `invalidateETag()` to trigger client updates
- POST responses include full `state: QueueState` for immediate client sync
- Batch operations only invalidate ETag if at least one operation succeeds

**POST /api/queue/refresh-video-url** (Public)
- Refreshes expired Twitch video URLs (Twitch signed URLs expire after ~24 hours)
- Body: `{ clipId: string }` (format: `twitch:abc123`)
- Returns: `{ success: true, videoUrl: string, message: string }`
- Error 404: Clip not found in database
- Use case: Video.js player automatically calls this on playback error (403/404)
- Implementation: Fetches fresh signed URL from Twitch GraphQL API, updates database + in-memory state
- Note: Kick clips ignored (URLs don't expire)

#### 6. Platform/Service Separation

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

#### 7. Chat Commands

**Detection** (`apps/api/src/index.ts`):

- Messages starting with `settings.commands.prefix` (default: `!cq`)
- Only mods/broadcasters can execute commands
- Parsed in `handleChatCommand()`

**Available Commands**:

- `open/close` → toggle queue submissions
- `clear` → delete all approved clips
- `next` → move current to history, shift next from queue
- `prev/previous` → move current back to queue, pop from history
- `setlimit <number>` → set queue size limit (e.g., `!cq setlimit 50`)
- `removelimit` → remove queue size limit
- `removebysubmitter <username>` → remove all clips by a specific submitter
- `removebyplatform <twitch|kick>` → remove all clips from a platform
- `enableplatform <twitch|kick>` → enable clip submissions from a platform
- `disableplatform <twitch|kick>` → disable clip submissions from a platform
- `enableautomod` → enable auto-moderation (clips require approval)
- `disableautomod` → disable auto-moderation (clips auto-approve)
- `purgecache` → clear authentication caches
- `purgehistory` → clear history

#### 8. Authentication & Authorization

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
- **Moderator**:
  - Single clip operations: `/api/queue/submit|advance|previous|remove|play|approve|reject` (POST)
  - Pending/rejected management: `/api/queue/pending` (GET), `/api/queue/rejected` (GET), `/api/queue/rejected/:clipId/restore` (POST)
  - History operations: `/api/queue/history/:clipId/replay` (POST), `/api/queue/history/:clipId` (DELETE)
  - Batch operations: `/api/queue/batch/remove|approve|reject` (POST)
- **Broadcaster**: `/api/queue/open|close` (POST), `/api/queue` (DELETE), `/api/queue/history` (DELETE), `/api/settings` (PUT), `/api/auth/cache/*`

**Frontend** (`apps/web/src/stores/user.ts`, `apps/web/src/utils/api.ts`):

- OAuth flow with CSRF protection (state parameter in `packages/services/src/twitch/auth.ts`)
- Fetches user role from `/api/auth/me` endpoint after login
- Proactive token validation every 5 minutes via `/api/auth/validate`
- Auto-logout on token expiration or validation failure
- Role-based computed properties: `canControlQueue`, `canManageSettings`
- UI conditionally shows/hides controls based on permissions
- `fetchWithAuth()` utility with 30-second timeout, handles 401/403 responses

#### 9. OAuth Router (Authorization Code + PKCE)

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

#### 10. Path Resolution Utilities

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

#### 11. Bootstrap Pattern (server.ts)

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
VITE_API_URL=http://localhost:3000    # Backend API URL
VITE_TWITCH_REDIRECT_URI=http://localhost:5173  # OAuth callback URL
```

### Critical Files

**Backend**:

1. `apps/api/src/server.ts` - Bootstrap entry point (loads .env, validates env vars, imports index.ts)
2. `apps/api/src/index.ts` - Main server, event handlers, API endpoints, video URL refresh endpoint
3. `apps/api/src/eventsub.ts` - Twitch EventSub WebSocket client (backend-to-Twitch only)
4. `apps/api/src/auth.ts` - Authentication middleware, token validation, role checking
5. `apps/api/src/oauth.ts` - OAuth router (Authorization Code + PKCE flow)
6. `apps/api/src/db.ts` - Database operations (Drizzle), video URL updates
7. `apps/api/src/schema.ts` - Database schema + Zod validators
8. `apps/api/src/paths.ts` - Workspace path resolution utilities
9. `apps/api/src/setup.ts` - OAuth setup script for bot token generation

**Frontend**:

1. `apps/web/src/stores/queue-server.ts` - HTTP polling client, queue state management
2. `apps/web/src/stores/user.ts` - User authentication, role management, token validation
3. `apps/web/src/utils/api.ts` - Authenticated fetch wrapper, timeout handling, error responses
4. `apps/web/src/utils/events.ts` - Auth event system for toast notifications
5. `apps/web/src/utils/schemas.ts` - Zod schemas for API response validation

**Shared**:

1. `packages/platforms/src/clip-list.ts` - Queue sorting logic
2. `packages/platforms/src/types.ts` - `Clip` interface
3. `packages/platforms/src/twitch.ts` - Twitch clip fetching
4. `packages/platforms/src/kick.ts` - Kick clip fetching
5. `packages/player/src/VideoJSPlayer.vue` - Video.js wrapper with automatic expired URL refresh
6. `packages/player/src/CqPlayer.vue` - Player component router (iframe vs video)
7. `packages/utils/src/http.ts` - HTTP utilities (fetch wrappers)
8. `packages/utils/src/cache.ts` - TTL cache implementation
9. `packages/queue-ops/src/index.ts` - Queue operations (advance, previous, clear)
10. `packages/constants/src/commands.ts` - Chat command constants
11. `packages/schemas/src/auth.ts` - Auth-related Zod schemas

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
- **HTTP Polling**: Frontend polls every 2 seconds with ETag optimization (most requests return 304 Not Modified)
- **Path resolution**: Backend uses `apps/api/src/paths.ts` utilities (`resolveFromRoot`) for workspace-relative paths - avoids `process.cwd()` issues
- **Backend EventSub WebSocket**: The `ws` package is used for Twitch EventSub connection only (backend-to-Twitch), not for frontend communication
