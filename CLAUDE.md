# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clip Queue is a self-hosted web application for Twitch streamers. The Node.js backend monitors Twitch chat via EventSub, automatically queuing clips submitted by viewers. The Vue.js frontend uses HTTP polling (with ETag optimization) for real-time queue synchronization across multiple devices.

**Key Features:**

- Server-side Twitch EventSub chat monitoring (not IRC)
- HTTP polling architecture (no WebSockets for clients)
- SQLite + Drizzle ORM for persistence
- In-memory priority queue (sorted by popularity)
- OAuth authentication with role-based permissions
- Support for Twitch and Kick clips
- shadcn-vue design system (Tailwind CSS v4)

## Quick Start

```sh
# Install dependencies (requires Node.js >=20, pnpm >=10)
corepack enable && corepack install
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with: TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_CHANNEL_NAME

# Generate bot token (opens browser, auto-updates .env)
pnpm api setup

# Run both backend and frontend
pnpm dev:all
```

**Environment Variables Required:**

```env
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret  # For OAuth token exchange (setup script)
TWITCH_BOT_TOKEN=your_user_token         # From: pnpm api setup
TWITCH_CHANNEL_NAME=your_channel         # Lowercase
SESSION_SECRET=your_random_secret        # Generate: openssl rand -base64 48
```

**Optional** (backend):

```env
API_URL=http://localhost:3000          # API base URL (OAuth callbacks)
FRONTEND_URL=http://localhost:5173     # CORS origin
PORT=3000                              # Server port
DB_PATH=./data/clips.db               # SQLite location
```

**Frontend** (`apps/web/.env`):

```env
VITE_TWITCH_CLIENT_ID=your_client_id
VITE_API_URL=http://localhost:3000
VITE_TWITCH_REDIRECT_URI=http://localhost:5173
```

## Common Commands

```sh
# Development
pnpm dev:all              # Run backend + frontend
pnpm api dev              # Backend only (port 3000)
pnpm web dev              # Frontend only (port 5173)

# Build and test
pnpm build                # Build all packages
pnpm typecheck            # Type check all packages
pnpm test                 # Run all tests
pnpm lint                 # Check formatting and lint
pnpm lint:fix             # Auto-fix linting issues

# Database operations
pnpm --filter @cq/api db:generate  # Generate migration
pnpm --filter @cq/api db:migrate   # Apply migrations
pnpm --filter @cq/api db:studio    # Open Drizzle Studio GUI

# i18n (13 locales: ar, de, en, es, fr, hi, it, ja, ko, pt, ru, tr, zh)
pnpm web i18n:check       # Validate translation completeness
pnpm web i18n:sync        # Sync missing keys from en.json
pnpm web i18n:translate   # Machine translate all keys

# Per-package commands (work from root)
pnpm api <script>         # Backend script (e.g., pnpm api dev, pnpm api db:generate)
pnpm web <script>         # Frontend script (e.g., pnpm web dev, pnpm web i18n:check)
pnpm platforms <script>   # Platforms package script
pnpm ui <script>          # UI package script
pnpm player <script>      # Player package script
pnpm services <script>    # Services package script
```

**Makefile Available**: Run `make help` for aliases.

**Common Makefile targets**:

```sh
# Setup
make install       # Install all dependencies
make api-setup     # Get Twitch bot token (OAuth)

# Development
make api-dev       # Run backend API server
make web-dev       # Run frontend dev server
make dev-all       # Run both backend + frontend

# Build & Test
make build         # Build everything
make typecheck     # Type check all packages
make lint          # Lint all packages
make lint-fix      # Auto-fix linting issues
make test          # Run all tests

# Docker
make docker-build  # Build Docker images
make docker-up     # Start containers
make docker-down   # Stop containers
make docker-logs   # View backend logs

# Utilities
make clean         # Clean build artifacts and node_modules
```

## Architecture Overview

### System Flow

```
Twitch EventSub WebSocket (channel.chat.message)
             ↓
Backend (Node.js + Express + SQLite + In-memory ClipList)
             ↓ HTTP Polling (2s intervals with ETag)
Frontend(s) (Vue.js + Pinia + shadcn-vue)
```

**Single-channel design**: Server monitors ONE channel. Multiple clients can connect.

### Monorepo Structure

```
apps/
  api/           @cq/api - Express REST API + EventSub + SQLite
  web/           @cq/web - Vue.js SPA (HTTP polling client)

packages/
  config/        @cq/config - Shared configs (TypeScript, ESLint, Prettier)
  constants/     @cq/constants - Shared constants (commands, platforms, events)
  player/        @cq/player - Vidstack video player component
  platforms/     @cq/platforms - Clip fetching (Twitch, Kick) + ClipList
  queue-ops/     @cq/queue-ops - Queue operations (advance, previous, clear)
  schemas/       @cq/schemas - Zod schemas (settings, auth, twitch, clip)
  services/      @cq/services - API clients (Twitch Helix, Kick)
  ui/            @cq/ui - shadcn-vue components + Tailwind CSS v4
  utils/         @cq/utils - Shared utilities (HTTP, cache, URL parsing)
```

**Package Manager**: pnpm (≥10) with workspace protocol and catalog dependencies
**Note**: Packages export TypeScript source (`.ts`). Vite compiles everything together.

**Catalog Dependencies** (defined in `pnpm-workspace.yaml`):

- Shared versions across workspace: `@iconify/json`, `@tailwindcss/vite`, `@types/*`, `@vitejs/plugin-vue`, `@vue/*`, `jsdom`, `tailwindcss`, `typescript`, `unplugin-icons`, `vite`, `vue`, `vue-tsc`, `zod`
- Peer catalog: `vue: ^3.0.0`
- Only built dependencies: `@tailwindcss/oxide`, `better-sqlite3`, `esbuild`, `sqlite3`

**Package Exports** (TypeScript source exports):

```
@cq/config      → /eslint/typescript | /eslint/vue | /prettier/base | /prettier/vue | /tsconfig
@cq/constants   → . | /events | /commands | /platforms
@cq/schemas     → . | /settings | /auth | /twitch | /clip
@cq/utils       → . | /http | /cache | /url
@cq/services    → /kick | /twitch
@cq/platforms   → .
@cq/queue-ops   → .
@cq/player      → .
@cq/ui          → .
```

**Dependency Graph** (workspace dependencies only):

```
@cq/api
  ├── @cq/constants
  ├── @cq/platforms (→ @cq/schemas, @cq/services)
  ├── @cq/queue-ops (→ @cq/platforms)
  ├── @cq/schemas
  ├── @cq/services (→ @cq/utils)
  └── @cq/utils

@cq/web
  ├── @cq/constants
  ├── @cq/platforms (→ @cq/schemas, @cq/services)
  ├── @cq/player (→ @cq/services)
  ├── @cq/schemas
  ├── @cq/services (→ @cq/utils)
  └── @cq/ui
```

**Key External Dependencies**:

- **Backend**: Express, Drizzle ORM, better-sqlite3, ws (WebSocket for EventSub), helmet, express-rate-limit
- **Frontend**: Vue, Vue Router, Pinia, @tanstack/vue-table, @inlang/paraglide-js
- **UI**: shadcn-vue, radix-vue, reka-ui, Tailwind CSS v4, vue-sonner
- **Player**: Vidstack (video player with HLS/DASH support)
- **Validation**: Zod (catalog: shared across all packages)
- **Build Tools**: Vite, Turbo, TypeScript, vue-tsc

### Key Architectural Decisions

#### 1. HTTP Polling (Not WebSockets)

**Why polling over WebSockets:**

- Simpler implementation (~350 LOC removed)
- More reliable for OBS browser sources
- Efficient with ETag (most requests return 304 Not Modified)
- Better for burst traffic (naturally batched)
- Same perceived latency (2s polling + immediate fetch after commands)

**Optimizations:**

- ETag includes submitter counts (detects priority changes)
- SHA256 hash (effectively zero collisions)
- POST endpoints return full state (immediate sync)
- Exponential backoff on errors (2s → 4s → 8s → 16s → 30s max)
- Adaptive polling: 500ms (after commands), 2s (normal), 10s (idle >30s)
- Stops after 5 consecutive errors, clears stale ETag
- Settings included in state for real-time sync across clients

#### 2. Dual State Management

**In-Memory** (`ClipList`):

- Fast operations, popularity-based sorting
- Source of truth for current session

**Database** (SQLite + Drizzle):

- Persistence across restarts
- Status tracking (approved/pending/rejected/played)
- Historical data (playedAt timestamps)

**Sync Flow:**

```
Chat message → Validate → Fetch metadata → Check settings →
Database upsert → In-memory add → ETag invalidation → Client poll
```

#### 3. Database Schema (Normalized)

```typescript
clips:
  - id: TEXT PRIMARY KEY              // "platform:clip_id"
  - platform, clipId, url, embedUrl, thumbnailUrl
  - title, channel, creator, category
  - status: TEXT (approved|pending|rejected|played)
  - submittedAt, playedAt: TIMESTAMP

clip_submitters:                       // Many-to-many
  - clipId → clips.id (cascade delete)
  - submitter: TEXT
  - UNIQUE(clipId, submitter)

settings:                              // Single-row config
  - version: INTEGER
  - commands, queue, logger: JSON (Zod validated)
```

**Database Operations** (`apps/api/src/db.ts`):

- All queries use Drizzle ORM (type-safe)
- `upsertClip()` uses transactions (prevents race conditions)
- `getClipsByStatus()` bulk fetches submitters (avoids N+1 queries)
- Zod validates all JSON data on read/write

**Migrations**: Modify `schema.ts` → `pnpm api db:generate` → Auto-apply on startup

#### 4. Authentication & Authorization

**Backend** (`apps/api/src/auth.ts`, `apps/api/src/oauth.ts`):

- OAuth Authorization Code + PKCE flow (not deprecated Implicit Grant)
- httpOnly cookies (XSS protection), SameSite=strict (CSRF protection)
- Session store: SQLite (`connect-sqlite3`) for OAuth state + PKCE verifier
- Token validation cache: 5min (capped from Twitch `expires_in`)
- Role cache: 2min (faster mod status updates)
- 60-day token lifetime (matches Twitch refresh token)
- Rate limiting: 100 req/15min (general), 20 req/15min (auth failures)
- Security headers: CSP, HSTS (1-year), Referrer-Policy

**Protected Routes:**

- **Public**: `/api/health`, `/api/queue` (GET), `/api/settings` (GET)
- **Moderator**: Queue operations, approve/reject, batch operations
- **Broadcaster**: Open/close queue, clear queue/history, update settings, cache management

**Frontend** (`apps/web/src/stores/user.ts`):

- OAuth with CSRF protection
- Proactive token validation every 5 minutes
- Auto-logout on expiration
- Role-based UI (computed: `canControlQueue`, `canManageSettings`)

#### 5. Design System (shadcn-vue + Tailwind CSS v4)

**Stack**: [shadcn-vue](https://www.shadcn-vue.com/) (unstyled [radix-vue](https://www.radix-vue.com/) + [reka-ui](https://github.com/unovue/reka-ui) primitives) + Tailwind CSS v4

**Theme System:**

- Dark mode: `.dark` class on `<html>` (toggle via `preferences.toggleTheme()`)
- CSS variables in `packages/ui/src/styles/tailwind.css`
- OKLCH color space (perceptually uniform)

**✅ Use Semantic Tokens (Not Hardcoded Colors):**

```vue
<!-- Correct -->
<div class="bg-background text-foreground"></div>
```

**Available Tokens:**

- **Backgrounds**: `bg-background`, `bg-card`, `bg-popover`, `bg-muted`, `bg-secondary`
- **Text**: `text-foreground`, `text-muted-foreground`, `text-card-foreground`
- **Borders**: `border-border`, `border-input`
- **Interactive**: `bg-primary`, `text-primary`, `bg-destructive`

**Component Usage (Compositional API):**

```vue
<script setup>
import { Button, Card, CardContent, CardHeader, CardTitle } from '@cq/ui'
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Title</CardTitle>
    </CardHeader>
    <CardContent>
      <Button variant="default">Save</Button>
    </CardContent>
  </Card>
</template>
```

**Note**: Import from `@cq/ui` (not direct shadcn imports) to use project wrappers.

#### 6. Icon System (Centralized Registries)

**Stack**: [unplugin-icons](https://github.com/unplugin/unplugin-icons) + [@iconify/json](https://icon-sets.iconify.design/)

**Why unplugin-icons:**

- Compile-time icon bundling (no runtime API calls)
- Access to 200,000+ icons from 150+ icon sets
- Tree-shakable (only bundles used icons)
- TypeScript support via auto-generated types
- Works with Vite's hot module replacement

**Icon Sets Used:**

- **Simple Icons** (`~icons/simple-icons/*`) - Official brand logos (Twitch, Kick)
- **Lucide** (`~icons/lucide/*`) - Primary set for UI icons (1,500+ icons)

**Architecture:**
Icons are organized into centralized registries with semantic naming:

- **App icons**: `apps/web/src/composables/icons.ts` (34 icons)
- **UI package icons**: `packages/ui/src/icons.ts` (10 reusable component icons)

**Icon Categories** (app registry):

```typescript
// Brands: BrandTwitch, BrandKick
// Actions: ActionPlay, ActionPause, ActionSkipForward, ActionTrash, ActionLogOut, etc.
// Media: MediaVolume, MediaVolumeMute
// Navigation: NavList, NavHistory, NavSettings, NavInfo, NavBookOpen, etc.
// Status: StatusLock, StatusClock, StatusAlertCircle, StatusCheck, etc.
// UI: UiChevronDown, UiX, UiSearch, UiCircle, etc.
// Theme: ThemeSun, ThemeMoon
```

**Usage Pattern:**

```vue
<script setup>
import { ActionPlay, BrandTwitch, NavHistory } from '@/composables/icons'
</script>

<template>
  <ActionPlay :size="24" />
  <BrandTwitch :size="20" />
  <NavHistory :size="16" />
</template>
```

**UI Package Icons:**
Import from `@cq/ui` for reusable component icons:

```vue
<script setup>
import { IconCheck, IconChevronDown, IconX } from '@cq/ui'
</script>
```

**Configuration:**

- Vite plugins configured in `apps/web/vite.config.ts` and `packages/ui/vite.config.ts`
- TypeScript declarations in `apps/web/src/env.d.ts` and `packages/ui/src/env.d.ts`
- Icons are Vue functional components with `size` prop (defaults to 1em)

**Finding Icons:**

- Browse: [Iconify Icon Sets](https://icon-sets.iconify.design/)
- Search: [Icônes](https://icones.js.org/) (visual search tool)
- Import format in registry: `~icons/{collection}/{icon-name}` (e.g., `~icons/lucide/play-circle`)

**Router Integration:**
Route meta icons use typed keys from the centralized registry:

```typescript
import type { RouteIconKey } from '@/composables/icons'
import { routeIcons } from '@/composables/icons'

// apps/web/src/composables/icons.ts
export const routeIcons = {
  list: NavList,
  history: NavHistory,
  settings: NavSettings
  // ... etc.
} as const

export type RouteIconKey = keyof typeof routeIcons

// apps/web/src/router/index.ts

// Routes use typed keys: meta: { icon: 'list' as RouteIconKey }
// Components map keys to components: routeIcons[iconKey]
```

**Adding New Icons:**

1. Add import to `apps/web/src/composables/icons.ts` (or `packages/ui/src/icons.ts`)
2. Add to appropriate category in `icons` object
3. Export with semantic name (e.g., `ActionNewIcon`)
4. Import and use: `import { ActionNewIcon } from '@/composables/icons'`

#### 7. Chat Commands (EventSub)

**EventSub Connection** (`apps/api/src/eventsub.ts`):

- WebSocket to `wss://eventsub.wss.twitch.tv/ws` (not IRC/tmi.js)
- Subscribes to `channel.chat.message` event
- Handles `session_reconnect` (server-initiated reconnects)
- Keepalive timeout monitoring (default 10s, configurable)
- Auto-reconnect with exponential backoff (1s → 5min max)
- Badge detection for mod/broadcaster permissions

**Command Format**: `!cq <command>` (prefix configurable)
**Permission**: Mods/broadcasters only

**Available Commands:**

- `open` / `close` - Toggle queue submissions
- `clear` - Delete all approved clips
- `next` / `prev` - Navigate queue
- `setlimit <N>` / `removelimit` - Set queue size limit
- `removebysubmitter <user>` - Remove clips by user
- `removebyplatform <twitch|kick>` - Remove clips by platform
- `enableplatform` / `disableplatform` - Toggle platform support
- `enableautomod` / `disableautomod` - Toggle manual approval
- `purgecache` - Clear auth caches
- `purgehistory` - Clear history

#### 8. Bootstrap Pattern (server.ts)

**Problem**: ESM hoists imports before code execution, causing dotenv issues.

**Solution**: Entry point `apps/api/src/server.ts`:

```typescript
import { config } from 'dotenv'

config({ path: resolveFromRoot('.env') }) // Load FIRST
validateEnvironment() // Validate SECOND
import('./index.js') // Import LAST
```

**package.json**:

```json
{
  "dev": "tsx watch src/server.ts",
  "start": "node dist/server.js"
}
```

### API Endpoints Reference

**Queue Management:**
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/queue` | Public | Get current queue state |
| GET | `/api/queue/pending` | Mod | List pending clips |
| GET | `/api/queue/rejected` | Mod | List rejected clips |
| POST | `/api/queue/submit` | Mod | Manually add clip |
| POST | `/api/queue/advance` | Mod | Next clip |
| POST | `/api/queue/previous` | Mod | Previous clip |
| POST | `/api/queue/play` | Mod | Play specific clip |
| POST | `/api/queue/remove` | Mod | Remove specific clip |
| POST | `/api/queue/approve` | Mod | Approve pending clip |
| POST | `/api/queue/reject` | Mod | Reject pending clip |
| POST | `/api/queue/rejected/:clipId/restore` | Mod | Restore rejected clip |
| POST | `/api/queue/history/:clipId/replay` | Mod | Replay from history |
| DELETE | `/api/queue/history/:clipId` | Mod | Delete from history |
| POST | `/api/queue/batch/remove` | Mod | Remove multiple (max 100) |
| POST | `/api/queue/batch/approve` | Mod | Approve multiple (max 100) |
| POST | `/api/queue/batch/reject` | Mod | Reject multiple (max 100) |
| POST | `/api/queue/refresh-video-url` | Public | Refresh expired Twitch URL |
| POST | `/api/queue/open` | Broadcaster | Open queue |
| POST | `/api/queue/close` | Broadcaster | Close queue |
| DELETE | `/api/queue` | Broadcaster | Clear queue |
| DELETE | `/api/queue/history` | Broadcaster | Clear history |

**Settings & Auth:**
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/settings` | Public | Get app settings |
| PUT | `/api/settings` | Broadcaster | Update settings |
| GET | `/api/auth/me` | Auth | Get user info + roles |
| POST | `/api/auth/logout` | Auth | Invalidate caches |
| GET | `/api/auth/validate` | Auth | Validate token |
| GET | `/api/auth/cache/stats` | Broadcaster | Cache statistics |
| POST | `/api/auth/cache/clear` | Broadcaster | Clear caches |

**Notes:**

- All POST endpoints return `{ success: true, state: QueueState }` for immediate sync
- Batch operations use partial success pattern (some may fail)
- `clipId` format: `platform:id` (e.g., `twitch:abc123`)
- Zod validates all inputs

### Critical Files

**Backend:**

1. `apps/api/src/server.ts` - Bootstrap entry point
2. `apps/api/src/index.ts` - Main server + API endpoints
3. `apps/api/src/eventsub.ts` - Twitch EventSub WebSocket client
4. `apps/api/src/auth.ts` - Auth middleware + token validation
5. `apps/api/src/oauth.ts` - OAuth router (PKCE flow)
6. `apps/api/src/db.ts` - Database operations (Drizzle)
7. `apps/api/src/schema.ts` - Database schema + Zod validators
8. `apps/api/src/paths.ts` - Workspace path resolution utilities
9. `apps/api/src/setup.ts` - OAuth setup script for bot token

**Frontend:**

1. `apps/web/src/stores/queue-server.ts` - HTTP polling + queue state
2. `apps/web/src/stores/user.ts` - Auth + role management
3. `apps/web/src/stores/preferences.ts` - Theme + language + autoplay preference
4. `apps/web/src/utils/api.ts` - Authenticated fetch wrapper
5. `apps/web/src/composables/toast.ts` - Toast notifications composable
6. `apps/web/src/composables/player-state.ts` - Video player state composable
7. `apps/web/src/composables/icons.ts` - Centralized icon registry (34 icons)
8. `apps/web/src/views/QueuePage.vue` - Main player view (passes autoplay preference)
9. `apps/web/src/components/ClipPlayer.vue` - Clip player wrapper (threads autoplay to CqPlayer)

**Shared:**

1. `packages/platforms/src/clip-list.ts` - Priority queue (popularity sorting)
2. `packages/platforms/src/twitch.ts` / `kick.ts` - Clip fetching
3. `packages/platforms/src/types.ts` - `Clip` interface + `toClipUUID()`
4. `packages/player/src/VidStackPlayer.vue` - Video player (auto URL refresh + play button overlay)
5. `packages/player/src/CqPlayer.vue` - Player component router (accepts autoplay prop)
6. `packages/ui/src/components/ui/` - shadcn-vue components
7. `packages/ui/src/styles/tailwind.css` - Theme CSS variables
8. `packages/ui/src/icons.ts` - UI package icon registry (10 component icons)
9. `packages/queue-ops/src/index.ts` - Queue operations
10. `packages/utils/src/http.ts` / `cache.ts` - HTTP + cache utilities

### Common Patterns

**Adding a New Clip Platform:**

1. Create `packages/platforms/src/newplatform.ts`:

```typescript
export class NewPlatform extends PlatformBase {
  async getClip(url: string): Promise<Clip | null> {
    // Fetch metadata, normalize to Clip type
    return { platform: Platform.NEW, id, url, ... }
  }
}
```

2. Add URL detection in `apps/api/src/index.ts`:

```typescript
// Existing patterns:
// Twitch: url.includes('twitch.tv') && (url.includes('clip') || url.includes('/clips/'))
// Kick: url.includes('kick.com/') && url.includes('/clips/clip_')

if (url.includes('newplatform.com/clips/')) {
  await handleClipSubmission(url, message.username, canAutoApprove)
}
```

3. Update `schema.ts`: Add platform to enum
4. Update `packages/platforms/src/types.ts`: Add to `Platform` enum

**Adding a Database Migration:**

1. Modify `apps/api/src/schema.ts`
2. Run `pnpm api db:generate` (creates `drizzle/0001_random_name.sql`)
3. Add SQL comment header to document changes:
   ```sql
   /**
    * Migration: Add channels table
    * Date: 2025-10-13
    * Adds multi-channel support...
    */
   ```
4. Migration auto-applies on server startup via `initDatabase()`

### Git Hooks (Husky)

**Hooks Active:**

- **pre-commit**: Format staged files (lint-staged) + run `typecheck`, `lint`, `test` on changed packages (Turborepo)
- **commit-msg**: Validate commit message format (commitlint)

**Pre-commit Hook Details:**

1. **lint-staged** (`.husky/pre-commit:5`):
   - Runs `prettier --write --ignore-unknown` on all staged files
   - Auto-formats code before commit
   - Automatically re-stages formatted files

2. **Turborepo validation** (`.husky/pre-commit:13`):
   - Runs `turbo run typecheck lint test --filter='...[HEAD]'`
   - Only checks changed packages + their dependents (fast!)
   - Uses cached results when possible (80-90% faster on cache hits)
   - Parallel execution with all CPU cores

**Commit-msg Hook Details:**

- Validates [Conventional Commits](https://www.conventionalcommits.org/) format
- Enforces line length limits (subject: 72, body/footer: 120)
- Validates type and scope (see rules below)

**Commit Message Format:**

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Rules** (enforced by commitlint):

- **Subject**: Max 72 chars (git best practice for single-line display)
- **Body**: Max 120 chars per line (wrap long explanations)
- **Footer**: Max 120 chars per line (for issue refs, breaking changes)

**Available Types:**

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `style` - Code style (formatting, semicolons, etc.)
- `refactor` - Code change (neither fixes bug nor adds feature)
- `perf` - Performance improvement
- `test` - Adding/updating tests
- `build` - Build system or dependencies
- `ci` - CI configuration
- `chore` - Other changes (doesn't modify src/test)
- `revert` - Revert previous commit

**Available Scopes** (optional):
`api`, `web`, `player`, `platforms`, `queue-ops`, `services`, `schemas`, `ui`, `utils`, `constants`, `config`, `deps`, `i18n`, `docs`, `ci`, `docker`, `db`

**Examples:**

```sh
# Good (fits line limits)
git commit -m "fix(player): respect autoplay preference and add play button

- Thread autoplay through component chain
- Fix hot reload autoplay bug
- Add clickable overlay when autoplay disabled"

# Bad (subject too long, body lines too long)
git commit -m "fix(player): respect autoplay preference and add manual play button overlay

- Thread autoplay preference through component chain (QueuePage → ClipPlayer → CqPlayer → VidStackPlayer)"
```

**Skip Hooks:**

```sh
# Skip pre-commit hook only (still validates commit message)
SKIP_HOOKS=1 git commit

# Skip all hooks (pre-commit AND commit-msg)
git commit --no-verify
# Or: SKIP_HOOKS=1 git commit --no-verify
```

**When to skip:**

- LLM workflows where formatting/tests already passed
- Emergency hotfixes (use sparingly!)
- Amending commits after pre-commit hook made changes

**Troubleshooting:**

```sh
turbo run typecheck lint test --filter='...[HEAD]' --dry-run  # Check what runs
rm -rf .turbo  # Clear cache if stale
```

### Build System (Turborepo)

**Benefits:** Incremental builds, task caching (80-90% faster on cache hits), parallel execution

**Common Commands:**

```sh
turbo run build                      # All packages
turbo run build --filter=@cq/api    # Specific package
turbo run build --filter=@cq/web... # Package + dependencies
rm -rf .turbo                        # Clear cache
```

**Performance:**

- First build: ~30-45s (cache miss)
- Subsequent with no changes: ~0.5s (cache hit)
- Partial changes: ~5-10s (affected packages only)

### Code Quality & Formatting

**Architecture**: Centralized configs in `@cq/config` package. All 11 packages import shared ESLint/Prettier configs.

**Two config types**:

- **TypeScript** (`@cq/config/eslint/typescript`, `prettier/base`) - 8 packages: api, constants, queue-ops, schemas, utils, services, platforms, config
- **Vue** (`@cq/config/eslint/vue`, `prettier/vue`) - 3 packages: web, player, ui (adds Tailwind class sorting)

**Pre-commit hooks** (Husky):

1. `lint-staged` - Prettier auto-formats all staged files
2. `turbo typecheck lint test --filter='...[HEAD]'` - Runs on changed packages only (cached)

**Common commands**:

```sh
pnpm lint              # Check all packages
pnpm lint:fix          # Auto-fix all packages
pnpm format            # Format all packages
SKIP_HOOKS=1 git commit # Skip pre-commit checks
```

**Adding new packages**: Must include `eslint.config.js`, `prettier.config.js`, and lint scripts (`lint`, `lint:fix`, `format`) in `package.json`. Import configs from `@cq/config` to match existing packages.

### i18n (Internationalization)

**Framework**: [@inlang/paraglide-js](https://inlang.com/m/gerre34r/library-inlang-paraglideJs)
**Locales**: ar, de, en, es, fr, hi, it, ja, ko, pt, ru, tr, zh (13 total)
**Usage**: `import * as m from '@/paraglide/messages'` then `m.login()`

**Workflow:**

1. Add keys to `apps/web/messages/en.json` (base locale)
2. `pnpm web i18n:sync` - Sync to other locales (adds English placeholders)
3. `pnpm web i18n:translate` - Machine translate via [@inlang/cli](https://inlang.com/m/2qj2w8pu/app-inlang-cli)
4. `pnpm web i18n:check` - Validate completeness (TypeScript script)

**Scripts**: `apps/web/scripts/check-i18n.ts`, `sync-i18n.ts`
**Quality**: Machine translations generally good for UI; technical terms may remain in English

### Testing

- **Framework**: Vitest
- **Location**: Colocated `__tests__/` directories
- **Mocks**: `apps/web/src/__tests__/mocks/`
- **Run single file**: `pnpm test <path/to/test.spec.ts>`

### Common Gotchas

- **Entry point is `server.ts`** (not `index.ts`) - loads `.env` before imports (ESM hoisting workaround)
- **Path resolution**: Backend uses `resolveFromRoot()` from `paths.ts` for workspace-relative paths (avoids `process.cwd()` issues)
- **EventSub requires token**: Run `pnpm api setup` to generate `TWITCH_BOT_TOKEN`
- **SESSION_SECRET required**: Generate with `openssl rand -base64 48`
- **Single channel only**: Server monitors ONE channel (multi-channel not supported)
- **ClipList sorting**: Popularity-based (more submitters = higher priority)
- **toClipUUID()**: Returns `"platform:id"` (lowercase) for deduplication
- **Settings are JSON blobs**: Stored in SQLite, validated with Zod on read/write
- **Kick URL format**: `kick.com/channel/clips/clip_ID` (note: `/clips/` with `clip_` prefix)
- **Auth caching**: 5min token cache, 2min role cache (broadcaster can clear)
- **Token validation**: Frontend validates every 5 minutes, auto-logout on expiration
- **HTTP Polling**: 2s intervals with ETag (most return 304 Not Modified)
- **Backend EventSub**: `ws` package for Twitch only (not frontend)
- **Batch operations**: Max 100 items, partial success pattern (some may fail)
- **Input validation**: Zod on all endpoints; clipId 1-200 chars, clipIds array 1-100 items
- **Design system**: Use semantic tokens (`bg-background`, etc.) not `zinc-*` colors
- **Dark mode**: `.dark` class on `<html>` (not `.app-dark`)
- **Tailwind CSS v4 required**: Cannot be removed (shadcn-vue foundation)
- **Compositional API**: Use sub-components (e.g., `SelectTrigger` + `SelectContent`)
- **Video player**: Vidstack (not Video.js) with client-side URL fetching
- **Composables**: Use `useToastNotifications()` and `usePlayerState()`
- **Generic typecheck errors**: MultiSelect/DataTable show TS4025 (known vue-tsc issue, runtime works)
- **Icon imports**: Use centralized registries (`@/composables/icons` for app, `@cq/ui` for UI package) - do NOT import directly from `~icons/*`
- **Icon naming**: Use semantic prefixes (Brand*, Action*, Nav*, Status*, Media*, Ui*, Theme\*) for clarity
- **env.d.ts files**: Provide TypeScript declarations for Vite features and unplugin-icons imports (do not modify)
- **Autoplay preference**: Thread through component chain (QueuePage → ClipPlayer → CqPlayer → VidStackPlayer); when disabled, shows clickable play button overlay that auto-hides after playback starts
- **Player autoplay prop**: Always pass `preferences.preferences.autoplay` to `ClipPlayer` to prevent hot reload bugs where video autoplays despite preference being off
- **New packages need configs**: Every package MUST have `eslint.config.js`, `prettier.config.js`, and lint scripts in `package.json` to be included in pre-commit checks (see "Code Quality & Formatting Architecture" section)
- **All 11 packages are linted**: Pre-commit hooks now run lint/typecheck on all packages (no silent skips); breaking this will cause commits to fail
