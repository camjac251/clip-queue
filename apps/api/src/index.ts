/**
 * Clip Queue Server
 *
 * Express + polling backend for multi-user clip queue.
 * Continuously monitors Twitch chat, manages clip queue, and syncs to clients via HTTP polling.
 *
 * NOTE: This file is imported by server.ts, which loads .env and validates env vars first.
 */

import { createHash } from 'crypto'
import { createServer } from 'http'

import cookieParser from 'cookie-parser'
import cors from 'cors'
import { eq } from 'drizzle-orm'
import express from 'express'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import helmet from 'helmet'
import { z } from 'zod'

import {
  ClipList,
  KickPlatform,
  PlayHistory,
  SoraPlatform,
  toClipUUID,
  TwitchPlatform
} from '@cq/platforms'
import { advanceQueue, clearQueue, jumpToHistoryClip, playClip, previousClip } from '@cq/queue-ops'
import kick from '@cq/services/kick'
import sora from '@cq/services/sora'
import twitch from '@cq/services/twitch'
import { TTLCache } from '@cq/utils'

import type { AuthenticatedRequest } from './auth.js'
import type { AppSettings, Clip } from './db.js'
import {
  authenticate,
  clearAllCaches,
  getCacheStats,
  invalidateRoleCache,
  invalidateTokenCache,
  requireBroadcaster,
  requireModerator
} from './auth.js'
import {
  clips,
  closeDatabase,
  deleteClipsByStatus,
  deletePlayLogsByClipStatus,
  getClip,
  getClipsByStatus,
  getPlayLogs,
  initDatabase,
  initSettings,
  insertPlayLog,
  playLog,
  updateClipStatus,
  updateSettings,
  upsertClip
} from './db.js'
import { TwitchEventSubClient } from './eventsub.js'
import oauthRouter from './oauth.js'
import { BotTokenManager } from './token-manager.js'

/**
 * Simple async mutex for preventing race conditions
 */
class Mutex {
  private queue: (() => void)[] = []
  private locked = false

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true
        resolve(() => this.release())
      } else {
        this.queue.push(() => resolve(() => this.release()))
      }
    })
  }

  private release(): void {
    const next = this.queue.shift()
    if (next) {
      next()
    } else {
      this.locked = false
    }
  }
}

// Mutexes for preventing race conditions
const clipSubmissionMutex = new Mutex()
const queueOperationMutex = new Mutex()

/**
 * Async route wrapper to catch errors and pass to Express error middleware
 */
function asyncHandler(fn: express.RequestHandler): express.RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/**
 * Input validation schemas for API endpoints
 */
const SubmitClipSchema = z.object({
  url: z.string().url().min(1).max(500),
  submitter: z.string().min(1).max(100)
})

const ClipIdSchema = z.object({
  clipId: z.string().min(1).max(200)
})

const BatchClipIdsSchema = z.object({
  clipIds: z.array(z.string().min(1).max(200)).min(1).max(100)
})

const app = express()
const server = createServer(app)

// CORS configuration - Allow multiple origins for development
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
const isDevelopment = process.env.NODE_ENV !== 'production'

// In development, allow localhost on any port + LAN IPs for mobile testing
const corsOrigin = isDevelopment
  ? [
      FRONTEND_URL,
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/127\.0\.0\.1:\d+$/,
      /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
      /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
      /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:\d+$/
    ]
  : FRONTEND_URL

// Security headers with helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", FRONTEND_URL],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"]
      }
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  })
)

app.use(cors({ origin: corsOrigin, credentials: true }))
app.use(express.json({ limit: '1mb' })) // Add size limit to prevent DoS
app.use(cookieParser()) // Parse cookies for OAuth token

// Rate limiting - separate limiters by route type
const publicReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500, // Higher limit for read-only endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests. Check RateLimit-Reset header for retry time.'
})

const authenticatedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthenticatedRequest) => {
    // Use userId if authenticated, fallback to IP with proper IPv6 handling
    if (req.user?.userId) {
      return req.user.userId
    }
    // Use built-in IPv6-safe IP key generator
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ipKeyGenerator(req as any)
  },
  skipSuccessfulRequests: false
})

// HLS proxy limiter - higher limit for streaming (HLS uses ~50+ requests per video)
const hlsProxyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000, // Allow ~100 videos per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many HLS proxy requests. Check RateLimit-Reset header for retry time.'
})

const authFailureLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failures
  message: 'Too many failed authentication attempts. Please try again later.'
})

// Initialize database
const db = initDatabase(process.env.DB_PATH)

// Initialize settings from database
let settings: AppSettings = initSettings(db)
console.log('[Settings] Loaded from database:', settings)

// Initialize queue and platform
const queue = new ClipList()
const playHistory = new PlayHistory()
let currentClip: Clip | null = null
let historyPosition = -1 // -1 = at end (queue mode), >= 0 = index in history
let isQueueOpen = true

// Load approved clips from database on startup (bulk add for O(n log n) performance)
const approvedClips = getClipsByStatus(db, 'approved')
if (approvedClips.length > 0) {
  queue.add(...approvedClips)
}
console.log(`[Queue] Loaded ${approvedClips.length} approved clips from database`)

// Load play history from play_log table on startup (ASC order - oldest first)
const playLogs = getPlayLogs(db, { limit: 100, order: 'asc' }) as Array<{
  id: number
  clip: Clip
  playedAt: Date
}>
playLogs.forEach((entry) => {
  playHistory.add(entry)
})
console.log(`[Queue] Loaded ${playLogs.length} play log entries from database`)

/**
 * Generate ETag hash from queue state
 * Used for efficient HTTP caching (304 Not Modified responses)
 * Includes clip IDs, submitter counts, queue status, and settings for accurate change detection
 */
// Cached ETag for state hash optimization
let cachedETag: string | null = null

/**
 * Invalidate cached ETag when state changes
 * Must be called after any state mutation
 */
function invalidateETag() {
  cachedETag = null
}

function generateStateHash(): string {
  // Return cached ETag if available
  if (cachedETag) return cachedETag

  const state = {
    current: currentClip?.id || null,
    currentSubmitters: currentClip?.submitters.length || 0,
    upcoming: queue.toArray().map((c) => ({ id: c.id, submitters: c.submitters.length })),
    playHistory: playHistory
      .toArray()
      .map((e) => ({ id: e.id, clipId: e.clip.id, playedAt: e.playedAt.getTime() })),
    isOpen: isQueueOpen,
    settings: settings // Include settings in hash for change detection
  }
  // Use full SHA256 hash (64 hex chars) to minimize collision risk
  cachedETag = createHash('sha256').update(JSON.stringify(state)).digest('hex')
  return cachedETag
}

/**
 * Get current queue state
 * Used for API responses to avoid race conditions
 */
function getQueueState() {
  return {
    current: currentClip,
    upcoming: queue.toArray(),
    playHistory: playHistory.toArray(),
    historyPosition, // Navigation state
    isOpen: isQueueOpen,
    settings: settings // Include settings for client synchronization
  }
}

const platforms = {
  twitch: new TwitchPlatform(() => ({
    id: process.env.TWITCH_CLIENT_ID!,
    token: process.env.TWITCH_BOT_TOKEN
  })),
  kick: new KickPlatform(),
  sora: new SoraPlatform()
}

// Per-user rate limiting cache (tracks last submission time per user)
const userSubmissionCache = new TTLCache<string, number>(60000) // 1 minute TTL
const urlSubmissionCache = new TTLCache<string, number>(5000) // 5 second TTL for duplicate URL prevention

// Restore queue and play history from database
function restoreQueueFromDatabase() {
  const approvedClips = getClipsByStatus(db, 'approved')
  const playLogs = getPlayLogs(db, { limit: 50, order: 'asc' }) as Array<{
    id: number
    clip: Clip
    playedAt: Date
  }>

  for (const clip of approvedClips) {
    queue.add(clip)
  }

  for (const entry of playLogs) {
    playHistory.add(entry)
  }

  console.log(`[Queue] Restored ${approvedClips.length} clips from database`)
  console.log(`[PlayHistory] Restored ${playLogs.length} play log entries from database`)

  // Invalidate ETag after restoring state
  invalidateETag()
}

restoreQueueFromDatabase()

// Initialize Twitch EventSub chat monitoring
let eventSubClient: TwitchEventSubClient | null = null
let eventSubConnectedAt: Date | null = null
let eventSubLastMessageAt: Date | null = null

// Initialize bot token manager
const clientId = process.env.TWITCH_CLIENT_ID!
const clientSecret = process.env.TWITCH_CLIENT_SECRET!
const botToken = process.env.TWITCH_BOT_TOKEN!
const botRefreshToken = process.env.TWITCH_BOT_REFRESH_TOKEN

const botTokenManager = new BotTokenManager(clientId, clientSecret, botToken, botRefreshToken)

// Register callback for when token is refreshed
botTokenManager.onRefresh((newToken) => {
  console.log('[TokenManager] Token refreshed, updating EventSub client')
  if (eventSubClient) {
    eventSubClient.updateAccessToken(newToken)
  }
})

// Start monitoring token expiration
botTokenManager.startMonitoring()

let reconnectAttempts = 0
const MAX_BACKOFF_MS = 5 * 60 * 1000
const BASE_BACKOFF_MS = 1000

function calculateBackoff(attempts: number, isRateLimit = false): number {
  const base = isRateLimit ? 60000 : BASE_BACKOFF_MS
  const exponential = Math.min(base * Math.pow(2, attempts), MAX_BACKOFF_MS)
  const jitter = exponential * 0.25 * (Math.random() * 2 - 1)
  return Math.floor(exponential + jitter)
}

async function connectToChat() {
  const channelName = process.env.TWITCH_CHANNEL_NAME!

  try {
    console.log(`[Chat] Connecting to EventSub for channel: ${channelName}`)

    // Get current token from token manager
    const currentToken = botTokenManager.getAccessToken()
    eventSubClient = new TwitchEventSubClient(clientId, currentToken)

    // Handle token expiration (401 errors)
    eventSubClient.onTokenExpired(async () => {
      console.log('[Chat] Token expired, refreshing...')
      const result = await botTokenManager.refreshToken()
      if (result.success && result.newAccessToken) {
        return result.newAccessToken
      }
      console.error('[Chat] Token refresh failed, EventSub will retry')
      return null
    })

    // Handle disconnection (unexpected only - Twitch reconnects handled in EventSub)
    eventSubClient.onDisconnect(() => {
      console.log('[Chat] EventSub disconnected unexpectedly')
      eventSubClient = null
      eventSubConnectedAt = null
      eventSubLastMessageAt = null

      // Don't reconnect here - EventSub client handles graceful reconnects
      // For unexpected disconnects, outer error handler will retry with backoff
    })

    // Listen for chat messages
    eventSubClient.onMessage(async (message) => {
      try {
        eventSubLastMessageAt = new Date() // Track last message timestamp
        console.log(`[Chat] ${message.username}: ${message.text}`)

        // Check if message is a command
        if (message.text.startsWith(settings.commands.prefix)) {
          // Only mods and broadcasters can use commands
          if (message.isModerator || message.isBroadcaster) {
            await handleChatCommand(message)
          } else {
            console.log(`[Chat] User ${message.username} is not allowed to use commands`)
          }
          return
        }

        // Extract URLs from message text
        const urlRegex = /(https?:\/\/[^\s]+)/g
        const urls = message.text.match(urlRegex) || []

        // Check if user can auto-approve (moderator or broadcaster)
        const canAutoApprove = message.isModerator || message.isBroadcaster

        // Submit each URL
        for (const url of urls) {
          // Check if it's a Twitch URL (clip, VOD, or highlight)
          if (twitch.getContentTypeFromUrl(url)) {
            await handleClipSubmission(url, message.username, canAutoApprove)
          }
          // Check if it's a Kick clip URL
          else if (kick.getClipIdFromUrl(url)) {
            await handleClipSubmission(url, message.username, canAutoApprove)
          }
        }
      } catch (error) {
        console.error(`[EventSub] Error processing message from ${message.username}:`, error)
      }
    })

    // Connect and subscribe to channel
    await eventSubClient.connect()
    await eventSubClient.subscribeToChannel(channelName)

    eventSubConnectedAt = new Date() // Track connection timestamp
    console.log(`[Chat] Connected to EventSub for channel: ${channelName}`)
    reconnectAttempts = 0 // Reset on success
  } catch (error) {
    console.error('[Chat] Failed to connect to EventSub:', error)
    eventSubClient = null

    const isRateLimit = error instanceof Error && error.message.includes('429')
    const backoffMs = calculateBackoff(reconnectAttempts, isRateLimit)
    reconnectAttempts++

    console.log(
      `[Chat] Retrying in ${(backoffMs / 1000).toFixed(1)}s (attempt ${reconnectAttempts})${isRateLimit ? ' [RATE LIMITED]' : ''}`
    )

    setTimeout(connectToChat, backoffMs)
  }
}

/**
 * Handle chat command
 */
async function handleChatCommand(message: { username: string; text: string }): Promise<void> {
  const commandText = message.text.substring(settings.commands.prefix.length).trim()
  const [command, ...args] = commandText.split(/\s+/)

  if (!command) {
    return
  }

  console.log(`[Command] ${message.username} executed: ${command} ${args.join(' ')}`)

  switch (command.toLowerCase()) {
    case 'open':
      isQueueOpen = true
      console.log(`[Command] Queue opened by ${message.username}`)
      break

    case 'close':
      isQueueOpen = false
      console.log(`[Command] Queue closed by ${message.username}`)
      break

    case 'clear': {
      try {
        await clearQueue(
          { current: currentClip, queue, playHistory, historyPosition },
          {
            updateClipStatus: (clipId, status) => updateClipStatus(db, clipId, status),
            deleteClipsByStatus: (status) => deleteClipsByStatus(db, status),
            insertPlayLog: (clipId, playedAt) => insertPlayLog(db, clipId, playedAt),
            deletePlayLogsByClipStatus: (status) => deletePlayLogsByClipStatus(db, status)
          }
        )
        console.log(`[Command] Queue cleared by ${message.username}`)
        invalidateETag()
      } catch (error) {
        console.error(`[Command] Failed to clear queue: ${error}`)
      }
      break
    }

    case 'setlimit': {
      if (!args[0]) {
        console.log(`[Command] No limit specified`)
        break
      }
      const limit = parseInt(args[0], 10)
      if (isNaN(limit) || limit < 1) {
        console.log(`[Command] Invalid limit: ${args[0]}`)
        break
      }
      settings.queue.limit = limit
      updateSettings(db, settings)
      console.log(`[Command] Queue limit set to ${limit} by ${message.username}`)
      invalidateETag()
      break
    }

    case 'removelimit':
      settings.queue.limit = null
      updateSettings(db, settings)
      console.log(`[Command] Queue limit removed by ${message.username}`)
      invalidateETag()
      break

    case 'next': {
      try {
        const state = { current: currentClip, queue, playHistory, historyPosition }
        await advanceQueue(
          state,
          {
            updateClipStatus: (clipId, status) => updateClipStatus(db, clipId, status),
            deleteClipsByStatus: (status) => deleteClipsByStatus(db, status),
            insertPlayLog: (clipId, playedAt) => insertPlayLog(db, clipId, playedAt),
            deletePlayLogsByClipStatus: (status) => deletePlayLogsByClipStatus(db, status)
          },
          toClipUUID
        )
        currentClip = state.current
        historyPosition = state.historyPosition

        // Broadcast change
        console.log(`[Command] Advanced to next clip by ${message.username}`)
        invalidateETag()
      } catch (error) {
        console.error(`[Command] Failed to advance to next clip: ${error}`)
      }
      break
    }

    case 'prev':
    case 'previous': {
      const state = { current: currentClip, queue, playHistory, historyPosition }
      await previousClip(state)
      currentClip = state.current
      historyPosition = state.historyPosition

      // Broadcast change
      console.log(`[Command] Went to previous clip by ${message.username}`)
      invalidateETag()
      break
    }

    case 'removebysubmitter': {
      const submitter = args[0]?.toLowerCase()
      if (!submitter) {
        console.log(`[Command] No submitter specified`)
        break
      }

      const clips = queue.toArray()
      let removedCount = 0

      for (const clip of clips) {
        if (clip.submitters.some((s) => s.toLowerCase() === submitter)) {
          queue.remove(clip)
          updateClipStatus(db, toClipUUID(clip), 'rejected')
          removedCount++
        }
      }

      console.log(
        `[Command] Removed ${removedCount} clips by ${submitter} (requested by ${message.username})`
      )
      if (removedCount > 0) invalidateETag()
      break
    }

    case 'removebyplatform': {
      const platformArg = args[0]?.toLowerCase()
      if (!platformArg || (platformArg !== 'twitch' && platformArg !== 'kick')) {
        console.log(`[Command] Invalid platform: ${args[0]}`)
        break
      }

      const clips = queue.toArray()
      let removedCount = 0

      for (const clip of clips) {
        if (clip.platform.toLowerCase() === platformArg) {
          queue.remove(clip)
          updateClipStatus(db, toClipUUID(clip), 'rejected')
          removedCount++
        }
      }

      console.log(
        `[Command] Removed ${removedCount} ${platformArg} clips (requested by ${message.username})`
      )
      if (removedCount > 0) invalidateETag()
      break
    }

    case 'enableplatform': {
      const platformArg = args[0]?.toLowerCase()
      if (
        !platformArg ||
        (platformArg !== 'twitch' && platformArg !== 'kick' && platformArg !== 'sora')
      ) {
        console.log(`[Command] Invalid platform: ${args[0]}`)
        break
      }

      if (!settings.queue.platforms.includes(platformArg as 'twitch' | 'kick' | 'sora')) {
        settings.queue.platforms.push(platformArg as 'twitch' | 'kick' | 'sora')
        updateSettings(db, settings)
        console.log(`[Command] Enabled ${platformArg} platform (requested by ${message.username})`)
        invalidateETag()
      } else {
        console.log(`[Command] ${platformArg} platform already enabled`)
      }
      break
    }

    case 'disableplatform': {
      const platformArg = args[0]?.toLowerCase()
      if (
        !platformArg ||
        (platformArg !== 'twitch' && platformArg !== 'kick' && platformArg !== 'sora')
      ) {
        console.log(`[Command] Invalid platform: ${args[0]}`)
        break
      }

      const index = settings.queue.platforms.indexOf(platformArg as 'twitch' | 'kick' | 'sora')
      if (index !== -1) {
        settings.queue.platforms.splice(index, 1)
        updateSettings(db, settings)
        console.log(`[Command] Disabled ${platformArg} platform (requested by ${message.username})`)
        invalidateETag()
      } else {
        console.log(`[Command] ${platformArg} platform already disabled`)
      }
      break
    }

    case 'enableautomod':
      settings.queue.hasAutoModerationEnabled = true
      updateSettings(db, settings)
      console.log(`[Command] Auto-moderation enabled by ${message.username}`)
      invalidateETag()
      break

    case 'disableautomod':
      settings.queue.hasAutoModerationEnabled = false
      updateSettings(db, settings)
      console.log(`[Command] Auto-moderation disabled by ${message.username}`)
      invalidateETag()
      break

    case 'purgecache':
      clearAllCaches()
      console.log(`[Command] Authentication caches purged by ${message.username}`)
      break

    case 'purgehistory':
      playHistory.clear()
      deletePlayLogsByClipStatus(db, 'played')
      deleteClipsByStatus(db, 'played')
      console.log(`[Command] Play history purged by ${message.username}`)
      break

    default:
      console.log(`[Command] Unknown command: ${command}`)
      break
  }
}

/**
 * Fetch clip from platform with retry logic and exponential backoff
 */
async function fetchClipWithRetry(
  platformInstance: { getClip: (url: string) => Promise<Clip> },
  url: string,
  maxRetries = 3
): Promise<Clip | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const timeout = 10000 * (attempt + 1) // 10s, 20s, 30s
    const backoffDelay = attempt > 0 ? 1000 * Math.pow(2, attempt - 1) : 0 // 0ms, 1s, 2s

    // Wait before retry (except first attempt)
    if (backoffDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, backoffDelay))
    }

    try {
      const clip = await Promise.race([
        platformInstance.getClip(url),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Platform API timeout')), timeout)
        )
      ])

      if (clip) return clip
    } catch (error) {
      const isLastAttempt = attempt === maxRetries - 1
      const errorMessage = error instanceof Error ? error.message : 'unknown error'

      if (isLastAttempt) {
        console.log(
          `[Queue] Failed to fetch clip after ${maxRetries} attempts (${errorMessage}): ${url}`
        )
        return null
      }

      console.log(
        `[Queue] Attempt ${attempt + 1}/${maxRetries} failed (${errorMessage}), retrying...`
      )
    }
  }

  return null
}

/**
 * Handle clip submission from chat or API
 * Uses mutex to prevent race conditions on duplicate submissions
 */
async function handleClipSubmission(
  url: string,
  submitter: string,
  autoApprove = false
): Promise<void> {
  const release = await clipSubmissionMutex.acquire()
  try {
    // Duplicate URL protection (prevent processing same URL multiple times in 5s window)
    const lastUrlSubmission = urlSubmissionCache.get(url)
    if (lastUrlSubmission) {
      console.log(`[Queue] Duplicate URL submitted within 5s window, ignoring: ${url}`)
      return
    }
    urlSubmissionCache.set(url, Date.now())

    // Per-user rate limiting (prevent spam)
    const lastSubmission = userSubmissionCache.get(submitter)
    if (lastSubmission && Date.now() - lastSubmission < 10000) {
      console.log(`[Queue] Rate limit: ${submitter} submitted too recently`)
      return
    }
    userSubmissionCache.set(submitter, Date.now())

    // Check if queue is open
    if (!isQueueOpen && !autoApprove) {
      console.log(`[Queue] Queue closed, ignoring clip from ${submitter}`)
      return
    }

    // Detect platform and fetch clip data with timeout (use platform validators)
    let platformInstance
    if (kick.getClipIdFromUrl(url)) {
      platformInstance = platforms.kick
    } else if (sora.getPostIdFromUrl(url)) {
      platformInstance = platforms.sora
    } else if (twitch.getContentTypeFromUrl(url)) {
      platformInstance = platforms.twitch
    } else {
      console.log(`[Queue] Invalid URL format: ${url}`)
      return
    }
    // Fetch clip with retry logic (3 attempts with exponential backoff)
    const clip = await fetchClipWithRetry(platformInstance, url)

    if (!clip) {
      return
    }

    // Check if platform is enabled in settings
    if (!settings.queue.platforms.includes(clip.platform)) {
      console.log(`[Queue] Platform ${clip.platform} is disabled, ignoring clip from ${submitter}`)
      return
    }

    // Check queue size limit
    if (settings.queue.limit !== null && queue.size() >= settings.queue.limit) {
      console.log(
        `[Queue] Queue is full (limit: ${settings.queue.limit}), ignoring clip from ${submitter}`
      )
      return
    }

    const clipId = toClipUUID(clip)

    // Check if clip already exists in queue (now protected by mutex)
    if (queue.includes(clip)) {
      // Add submitter to existing clip using transaction-safe upsert
      const updatedClip = upsertClip(db, clipId, { ...clip, submitters: [submitter] }, 'approved')

      // Update in-memory queue
      queue.add(updatedClip)

      // Broadcast update
      console.log(`[Queue] Added submitter to existing clip: ${clip.title} (${submitter})`)
      invalidateETag()
      return
    }

    // Determine approval status based on auto-moderation setting and user role
    // Auto-approve if:
    // 1. Auto-moderation is disabled (all clips auto-approve), OR
    // 2. Submitter is mod/broadcaster (bypass moderation)
    const shouldAutoApprove = !settings.queue.hasAutoModerationEnabled || autoApprove
    const status = shouldAutoApprove ? 'approved' : 'pending'

    // Add clip to queue with transaction
    const clipWithSubmitter = { ...clip, submitters: [submitter] }
    const savedClip = upsertClip(db, clipId, clipWithSubmitter, status)

    // Add to in-memory queue only if approved
    if (status === 'approved') {
      queue.add(savedClip)
      console.log(`[Queue] Added clip: ${clip.title} (submitted by ${submitter})`)
      invalidateETag()
    } else {
      console.log(`[Queue] Clip pending moderation: ${clip.title} (submitted by ${submitter})`)
    }
  } catch (error) {
    console.error('[Queue] Failed to submit clip:', error)
  } finally {
    release()
  }
}

// Connect to chat on startup
connectToChat()

// OAuth routes (must come before other API routes)
app.use('/api/oauth', oauthRouter)

// REST API endpoints
app.get('/api/health', publicReadLimiter, (req, res) => {
  const isConnected = eventSubClient?.isConnected() || false
  const uptimeMs = eventSubConnectedAt ? Date.now() - eventSubConnectedAt.getTime() : null

  res.json({
    status: 'ok',
    eventsub: {
      connected: isConnected,
      connectedAt: eventSubConnectedAt?.toISOString() || null,
      lastMessageAt: eventSubLastMessageAt?.toISOString() || null,
      uptimeMs
    },
    queueSize: queue.toArray().length
  })
})

app.get('/api/queue', publicReadLimiter, (req, res) => {
  // Generate ETag from current state
  const etag = generateStateHash()

  // Check if client has cached version
  const clientETag = req.headers['if-none-match']
  if (clientETag === etag) {
    // State hasn't changed, return 304 Not Modified
    return res.status(304).end()
  }

  // State changed, return full response with ETag
  res.setHeader('ETag', etag)
  res.setHeader('Cache-Control', 'no-cache') // Must revalidate with ETag
  res.json(getQueueState())
})

/**
 * GET /api/history - Paginated play history with cursor-based pagination
 * Query params:
 *   - limit: number (optional, default 50, max 100)
 *   - cursor: string (optional, base64-encoded playLog.id)
 */
app.get('/api/history', publicReadLimiter, (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined
    const cursor = req.query.cursor as string | undefined

    const result = getPlayLogs(db, {
      limit,
      cursor,
      order: 'desc', // Newest first for UI browsing
      paginate: true
    }) as {
      entries: Array<{ id: number; clip: Clip; playedAt: Date }>
      nextCursor: string | null
      hasMore: boolean
    }

    res.json({
      entries: result.entries,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      count: result.entries.length
    })
  } catch (error) {
    console.error('[API] Failed to get paginated history:', error)
    res.status(500).json({ error: 'Failed to fetch history' })
  }
})

// HLS proxy for Twitch VODs (bypasses CORS restrictions)
app.get(
  '/api/proxy/hls',
  hlsProxyLimiter,
  asyncHandler(async (req, res) => {
    const url = req.query.url as string

    if (!url) {
      return res.status(400).json({ error: 'Missing url parameter' })
    }

    // Only allow Twitch HLS domains (usher.ttvnw.net, video-weaver.*, *.cloudfront.net)
    const urlObj = new URL(url)
    const hostname = urlObj.hostname
    const isTwitchDomain =
      hostname === 'usher.ttvnw.net' ||
      hostname.includes('video-weaver') ||
      hostname.endsWith('.cloudfront.net')

    if (!isTwitchDomain) {
      return res.status(403).json({ error: 'Domain not allowed' })
    }

    try {
      // Fetch from Twitch
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })

      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to fetch from Twitch' })
      }

      // Get content type
      const contentType = response.headers.get('content-type') || 'application/vnd.apple.mpegurl'

      // If it's an m3u8 manifest, rewrite URLs to go through proxy
      if (
        contentType.includes('mpegurl') ||
        contentType.includes('m3u8') ||
        url.endsWith('.m3u8')
      ) {
        const text = await response.text()
        const baseUrl = url.substring(0, url.lastIndexOf('/'))

        // Rewrite relative URLs in manifest to go through proxy
        const rewritten = text
          .split('\n')
          .map((line) => {
            if (line.startsWith('#') || line.trim() === '') {
              return line
            }
            // If it's a relative URL, make it absolute and proxy it
            if (!line.startsWith('http')) {
              const absoluteUrl = `${baseUrl}/${line}`
              return `/api/proxy/hls?url=${encodeURIComponent(absoluteUrl)}`
            }
            // If it's already absolute, proxy it
            return `/api/proxy/hls?url=${encodeURIComponent(line)}`
          })
          .join('\n')

        res.setHeader('Content-Type', contentType)
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.send(rewritten)
      } else {
        // For .ts segments, just stream through
        res.setHeader('Content-Type', contentType)
        res.setHeader('Access-Control-Allow-Origin', '*')

        // Stream the response
        const buffer = await response.arrayBuffer()
        res.send(Buffer.from(buffer))
      }
    } catch (error) {
      console.error('[HLS Proxy] Error:', error)
      res.status(500).json({ error: 'Proxy error' })
    }
  })
)

// Manual clip submission (moderators only)
app.post(
  '/api/queue/submit',
  authenticate,
  authFailureLimiter,
  authenticatedLimiter,
  requireModerator,
  asyncHandler(async (req, res) => {
    // Validate input
    const parseResult = SubmitClipSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: parseResult.error.issues
      })
    }

    const { url, submitter } = parseResult.data
    await handleClipSubmission(url, submitter, false)
    res.json({ success: true, state: getQueueState() })
  })
)

// Queue navigation (moderators only)
app.post(
  '/api/queue/advance',
  authenticate,
  authFailureLimiter,
  authenticatedLimiter,
  requireModerator,
  asyncHandler(async (req, res) => {
    const release = await queueOperationMutex.acquire()
    try {
      const state = { current: currentClip, queue, playHistory, historyPosition }
      await advanceQueue(
        state,
        {
          updateClipStatus: (clipId, status) => updateClipStatus(db, clipId, status),
          deleteClipsByStatus: (status) => deleteClipsByStatus(db, status),
          insertPlayLog: (clipId, playedAt) => insertPlayLog(db, clipId, playedAt),
          deletePlayLogsByClipStatus: (status) => deletePlayLogsByClipStatus(db, status)
        },
        toClipUUID
      )
      currentClip = state.current
      historyPosition = state.historyPosition

      // Broadcast change
      invalidateETag()

      console.log(`[Queue] Advanced to next clip: ${currentClip?.title || 'none'}`)
      res.json({ success: true, state: getQueueState() })
    } finally {
      release()
    }
  })
)

app.post(
  '/api/queue/previous',
  authenticate,
  authFailureLimiter,
  authenticatedLimiter,
  requireModerator,
  asyncHandler(async (req, res) => {
    const release = await queueOperationMutex.acquire()
    try {
      const state = { current: currentClip, queue, playHistory, historyPosition }
      await previousClip(state)
      currentClip = state.current
      historyPosition = state.historyPosition

      // Broadcast change
      invalidateETag()

      console.log(`[Queue] Went to previous clip: ${currentClip?.title || 'none'}`)
      res.json({ success: true, state: getQueueState() })
    } finally {
      release()
    }
  })
)

// Clear queue (broadcaster only)
app.delete(
  '/api/queue',
  authenticate,
  authFailureLimiter,
  authenticatedLimiter,
  requireBroadcaster,
  asyncHandler(async (req, res) => {
    await clearQueue(
      { current: currentClip, queue, playHistory, historyPosition },
      {
        updateClipStatus: (clipId, status) => updateClipStatus(db, clipId, status),
        deleteClipsByStatus: (status) => deleteClipsByStatus(db, status),
        insertPlayLog: (clipId, playedAt) => insertPlayLog(db, clipId, playedAt),
        deletePlayLogsByClipStatus: (status) => deletePlayLogsByClipStatus(db, status)
      }
    )

    console.log('[Queue] Cleared queue')
    invalidateETag()
    res.json({ success: true, state: getQueueState() })
  })
)

// Clear play history (broadcaster only)
app.delete(
  '/api/queue/history',
  authenticate,
  authFailureLimiter,
  authenticatedLimiter,
  requireBroadcaster,
  asyncHandler(async (req, res) => {
    const previousHistory = playHistory.toArray()
    try {
      playHistory.clear()
      deletePlayLogsByClipStatus(db, 'played')
      deleteClipsByStatus(db, 'played')

      // Broadcast history cleared event
      invalidateETag()

      console.log('[Queue] Cleared play history')
      res.json({ success: true, state: getQueueState() })
    } catch (error) {
      // Roll back in-memory changes on database failure
      previousHistory.forEach((entry) => playHistory.add(entry))
      throw error // Let asyncHandler catch and respond with error
    }
  })
)

// DELETE /api/queue/history/:clipId - Remove all play log entries for a clip (moderator only)
app.delete(
  '/api/queue/history/:clipId',
  authenticate,
  authFailureLimiter,
  authenticatedLimiter,
  requireModerator,
  asyncHandler(async (req, res) => {
    const { clipId } = req.params

    // Validate clipId format
    if (!clipId || clipId.length === 0 || clipId.length > 200) {
      return res.status(400).json({
        error: 'INVALID_CLIP_ID',
        message: 'Clip ID must be between 1 and 200 characters'
      })
    }

    // Check if clip exists
    const clip = getClip(db, clipId)
    if (!clip) {
      return res.status(404).json({
        error: 'CLIP_NOT_FOUND',
        message: 'Clip not found',
        clipId
      })
    }

    // Delete all play log entries for this clip
    db.delete(playLog).where(eq(playLog.clipId, clipId)).run()

    // Rebuild play history from database (ASC order - oldest first)
    playHistory.clear()
    const playLogs = getPlayLogs(db, { limit: 100, order: 'asc' }) as Array<{
      id: number
      clip: Clip
      playedAt: Date
    }>
    playLogs.forEach((entry) => playHistory.add(entry))

    // Delete clip from database
    db.delete(clips).where(eq(clips.id, clipId)).run()

    // Invalidate ETag
    invalidateETag()

    console.log(`[Queue] Removed all play log entries for clip: ${clip.title}`)
    res.json({ success: true, state: getQueueState() })
  })
)

// Queue control (broadcaster only)
app.post(
  '/api/queue/open',
  authenticate,
  authFailureLimiter,
  authenticatedLimiter,
  requireBroadcaster,
  (req, res) => {
    isQueueOpen = true
    console.log('[Queue] Queue opened')
    invalidateETag()
    res.json({ success: true, state: getQueueState() })
  }
)

app.post(
  '/api/queue/close',
  authenticate,
  authFailureLimiter,
  authenticatedLimiter,
  requireBroadcaster,
  (req, res) => {
    isQueueOpen = false
    console.log('[Queue] Queue closed')
    invalidateETag()
    res.json({ success: true, state: getQueueState() })
  }
)

// Clip management (moderators only)
app.post(
  '/api/queue/remove',
  authenticate,
  authFailureLimiter,
  authenticatedLimiter,
  requireModerator,
  asyncHandler(async (req, res) => {
    // Validate input
    const parseResult = ClipIdSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: parseResult.error.issues
      })
    }

    const { clipId } = parseResult.data

    // Find and remove clip
    const clips = queue.toArray()
    const clip = clips.find((c) => toClipUUID(c) === clipId)

    if (clip) {
      try {
        queue.remove(clip)
        updateClipStatus(db, clipId, 'rejected')

        // Broadcast removal
        invalidateETag()

        console.log(`[Queue] Removed clip: ${clip.title}`)
        res.json({ success: true, state: getQueueState() })
      } catch (error) {
        // Roll back in-memory changes on database failure
        queue.add(clip)
        throw error // Let asyncHandler catch and respond with error
      }
    } else {
      res.status(404).json({
        error: 'CLIP_NOT_FOUND',
        message: 'Clip not found in queue',
        clipId
      })
    }
  })
)

// GET /api/queue/pending - List pending clips awaiting approval (broadcaster/moderator only)
app.get(
  '/api/queue/pending',
  authenticate,
  authFailureLimiter,
  authenticatedLimiter,
  requireModerator,
  (req, res) => {
    const pendingClips = getClipsByStatus(db, 'pending')
    res.json({ clips: pendingClips })
  }
)

// POST /api/queue/approve - Approve a pending clip (broadcaster/moderator only)
app.post(
  '/api/queue/approve',
  authenticate,
  authFailureLimiter,
  authenticatedLimiter,
  requireModerator,
  asyncHandler(async (req, res) => {
    // Validate input
    const parseResult = ClipIdSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: parseResult.error.issues
      })
    }

    const { clipId } = parseResult.data

    // Get clip from database
    const clip = getClip(db, clipId)
    if (!clip) {
      return res.status(404).json({
        error: 'PENDING_CLIP_NOT_FOUND',
        message: 'Pending clip not found. It may have been already approved or rejected.',
        clipId
      })
    }

    // Update status in database
    updateClipStatus(db, clipId, 'approved')

    // Add to in-memory queue
    queue.add(clip)

    console.log(`[Queue] Approved pending clip: ${clip.title}`)
    invalidateETag()
    res.json({ success: true, state: getQueueState() })
  })
)

// POST /api/queue/reject - Reject a pending clip (broadcaster/moderator only)
app.post(
  '/api/queue/reject',
  authenticate,
  authFailureLimiter,
  authenticatedLimiter,
  requireModerator,
  asyncHandler(async (req, res) => {
    // Validate input
    const parseResult = ClipIdSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: parseResult.error.issues
      })
    }

    const { clipId } = parseResult.data

    // Get clip from database
    const clip = getClip(db, clipId)
    if (!clip) {
      return res.status(404).json({
        error: 'PENDING_CLIP_NOT_FOUND',
        message: 'Pending clip not found. It may have been already approved or rejected.',
        clipId
      })
    }

    // Update status to rejected
    updateClipStatus(db, clipId, 'rejected')

    console.log(`[Queue] Rejected pending clip: ${clip.title}`)
    res.json({ success: true, state: getQueueState() })
  })
)

// GET /api/queue/rejected - List rejected clips (broadcaster/moderator only)
app.get(
  '/api/queue/rejected',
  authenticate,
  authFailureLimiter,
  authenticatedLimiter,
  requireModerator,
  (req, res) => {
    const rejectedClips = getClipsByStatus(db, 'rejected')
    res.json({ clips: rejectedClips })
  }
)

// POST /api/queue/rejected/:clipId/restore - Restore a rejected clip to approved status (broadcaster/moderator only)
app.post(
  '/api/queue/rejected/:clipId/restore',
  authenticate,
  authFailureLimiter,
  authenticatedLimiter,
  requireModerator,
  asyncHandler(async (req, res) => {
    // Validate input
    const parseResult = ClipIdSchema.safeParse({ clipId: req.params.clipId })
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: parseResult.error.issues
      })
    }

    const { clipId } = parseResult.data

    // Get clip from database
    const clip = getClip(db, clipId)
    if (!clip) {
      return res.status(404).json({
        error: 'REJECTED_CLIP_NOT_FOUND',
        message: 'Rejected clip not found. It may have been deleted.',
        clipId
      })
    }

    // Verify clip is actually rejected
    const dbClip = db.select().from(clips).where(eq(clips.id, clipId)).get()
    if (!dbClip || dbClip.status !== 'rejected') {
      return res.status(404).json({
        error: 'CLIP_NOT_REJECTED',
        message: 'Clip is not in rejected status. Only rejected clips can be restored.',
        clipId,
        currentStatus: dbClip?.status || 'unknown'
      })
    }

    try {
      // Update status to approved in database
      updateClipStatus(db, clipId, 'approved')

      // Add to in-memory queue
      queue.add(clip)

      console.log(`[Queue] Restored rejected clip: ${clip.title}`)
      invalidateETag()
      res.json({ success: true, state: getQueueState() })
    } catch (error) {
      // Roll back in-memory changes on database failure
      queue.remove(clip)
      throw error // Let asyncHandler catch and respond with error
    }
  })
)

app.post(
  '/api/queue/play',
  authenticate,
  authFailureLimiter,
  authenticatedLimiter,
  requireModerator,
  asyncHandler(async (req, res) => {
    // Validate input
    const parseResult = ClipIdSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: parseResult.error.issues
      })
    }

    const { clipId } = parseResult.data

    const release = await queueOperationMutex.acquire()
    try {
      // Find clip in queue
      const clips = queue.toArray()
      const clip = clips.find((c) => toClipUUID(c) === clipId)

      if (!clip) {
        release()
        return res.status(404).json({
          error: 'CLIP_NOT_IN_QUEUE',
          message: 'Clip not found in queue. It may have already been played or removed.',
          clipId
        })
      }

      const state = { current: currentClip, queue, playHistory, historyPosition }
      await playClip(
        state,
        {
          updateClipStatus: (clipId, status) => updateClipStatus(db, clipId, status),
          deleteClipsByStatus: (status) => deleteClipsByStatus(db, status),
          insertPlayLog: (clipId, playedAt) => insertPlayLog(db, clipId, playedAt),
          deletePlayLogsByClipStatus: (status) => deletePlayLogsByClipStatus(db, status)
        },
        clip,
        toClipUUID
      )
      currentClip = state.current
      historyPosition = state.historyPosition

      // Broadcast change
      invalidateETag()

      console.log(`[Queue] Playing clip: ${currentClip?.title}`)
      res.json({ success: true, state: getQueueState() })
    } finally {
      release()
    }
  })
)

// Jump to history clip from timeline (moderators only)
app.post(
  '/api/queue/history/:clipId/replay',
  authenticate,
  authFailureLimiter,
  authenticatedLimiter,
  requireModerator,
  asyncHandler(async (req, res) => {
    // Validate input
    const parseResult = ClipIdSchema.safeParse({ clipId: req.params.clipId })
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: parseResult.error.issues
      })
    }

    const { clipId } = parseResult.data

    const release = await queueOperationMutex.acquire()
    try {
      // Find clip in history
      const historyEntries = playHistory.getAll()
      const entry = historyEntries.find((e) => toClipUUID(e.clip) === clipId)

      if (!entry) {
        release()
        return res.status(404).json({
          error: 'CLIP_NOT_IN_HISTORY',
          message: 'Clip not found in history. It may have been cleared or never played.',
          clipId
        })
      }

      // Jump to history clip without creating duplicate entry
      const state = { current: currentClip, queue, playHistory, historyPosition }
      await jumpToHistoryClip(state, entry.clip, toClipUUID)

      // Update in-memory state
      currentClip = state.current
      historyPosition = state.historyPosition

      // Broadcast change
      invalidateETag()

      console.log(`[Queue] Jumped to history clip: ${entry.clip.title}`)
      res.json({ success: true, state: getQueueState() })
    } finally {
      release()
    }
  })
)

// Batch clip operations (moderators only)
app.post(
  '/api/queue/batch/remove',
  authenticate,
  authFailureLimiter,
  authenticatedLimiter,
  requireModerator,
  asyncHandler(async (req, res) => {
    // Validate input
    const parseResult = BatchClipIdsSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: parseResult.error.issues
      })
    }

    const { clipIds } = parseResult.data
    const queueClips = queue.toArray()
    const results = {
      removed: 0,
      failed: [] as string[],
      notFound: [] as string[]
    }

    // Process each clip - use partial success pattern
    for (const clipId of clipIds) {
      const clip = queueClips.find((c) => toClipUUID(c) === clipId)

      if (!clip) {
        results.notFound.push(clipId)
        continue
      }

      try {
        queue.remove(clip)
        updateClipStatus(db, clipId, 'rejected')
        results.removed++
      } catch (error) {
        // Roll back in-memory change on database failure
        queue.add(clip)
        results.failed.push(clipId)
        console.error(`[Queue] Failed to remove clip ${clipId}:`, error)
      }
    }

    // Invalidate ETag only if at least one clip was removed
    if (results.removed > 0) {
      invalidateETag()
    }

    console.log(
      `[Queue] Batch remove: ${results.removed} removed, ${results.failed.length} failed, ${results.notFound.length} not found`
    )

    res.json({
      success: true,
      removed: results.removed,
      failed: results.failed,
      notFound: results.notFound,
      state: getQueueState()
    })
  })
)

app.post(
  '/api/queue/batch/approve',
  authenticate,
  authFailureLimiter,
  authenticatedLimiter,
  requireModerator,
  asyncHandler(async (req, res) => {
    // Validate input
    const parseResult = BatchClipIdsSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: parseResult.error.issues
      })
    }

    const { clipIds } = parseResult.data
    const results = {
      approved: 0,
      failed: [] as string[],
      notFound: [] as string[]
    }

    // Process each clip - use partial success pattern
    for (const clipId of clipIds) {
      const clip = getClip(db, clipId)

      if (!clip) {
        results.notFound.push(clipId)
        continue
      }

      try {
        // Update status in database
        updateClipStatus(db, clipId, 'approved')

        // Add to in-memory queue
        queue.add(clip)

        results.approved++
      } catch (error) {
        results.failed.push(clipId)
        console.error(`[Queue] Failed to approve clip ${clipId}:`, error)
      }
    }

    // Invalidate ETag only if at least one clip was approved
    if (results.approved > 0) {
      invalidateETag()
    }

    console.log(
      `[Queue] Batch approve: ${results.approved} approved, ${results.failed.length} failed, ${results.notFound.length} not found`
    )

    res.json({
      success: true,
      approved: results.approved,
      failed: results.failed,
      notFound: results.notFound,
      state: getQueueState()
    })
  })
)

app.post(
  '/api/queue/batch/reject',
  authenticate,
  authFailureLimiter,
  authenticatedLimiter,
  requireModerator,
  asyncHandler(async (req, res) => {
    // Validate input
    const parseResult = BatchClipIdsSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: parseResult.error.issues
      })
    }

    const { clipIds } = parseResult.data
    const results = {
      rejected: 0,
      failed: [] as string[],
      notFound: [] as string[]
    }

    // Process each clip - use partial success pattern
    for (const clipId of clipIds) {
      const clip = getClip(db, clipId)

      if (!clip) {
        results.notFound.push(clipId)
        continue
      }

      try {
        // Update status to rejected
        updateClipStatus(db, clipId, 'rejected')
        results.rejected++
      } catch (error) {
        results.failed.push(clipId)
        console.error(`[Queue] Failed to reject clip ${clipId}:`, error)
      }
    }

    console.log(
      `[Queue] Batch reject: ${results.rejected} rejected, ${results.failed.length} failed, ${results.notFound.length} not found`
    )

    res.json({
      success: true,
      rejected: results.rejected,
      failed: results.failed,
      notFound: results.notFound,
      state: getQueueState()
    })
  })
)

// Auth API endpoints
app.get(
  '/api/auth/me',
  authenticate,
  authFailureLimiter,
  authenticatedLimiter,
  (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'NOT_AUTHENTICATED',
        message: 'Authentication required. Please log in with Twitch.'
      })
    }

    res.json({
      userId: req.user.userId,
      username: req.user.username,
      displayName: req.user.displayName,
      profileImageUrl: req.user.profileImageUrl,
      isBroadcaster: req.user.isBroadcaster,
      isModerator: req.user.isModerator
    })
  }
)

app.post('/api/auth/logout', authenticate, authFailureLimiter, (req: AuthenticatedRequest, res) => {
  const token = req.cookies?.auth_token
  const channelName = process.env.TWITCH_CHANNEL_NAME!

  if (req.user && token) {
    // Invalidate token and role caches
    invalidateTokenCache(token)
    invalidateRoleCache(req.user.userId, channelName)

    console.log(`[Auth] User ${req.user.username} logged out, caches invalidated`)
  }

  // Note: Actual cookie clearing and token revocation handled by /api/oauth/logout
  res.json({ success: true })
})

app.get(
  '/api/auth/validate',
  authenticate,
  authFailureLimiter,
  (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    res.json({
      valid: true,
      user: {
        userId: req.user.userId,
        username: req.user.username,
        isBroadcaster: req.user.isBroadcaster,
        isModerator: req.user.isModerator
      }
    })
  }
)

// Cache management endpoints (broadcaster only)
app.get(
  '/api/auth/cache/stats',
  authenticate,
  authFailureLimiter,
  requireBroadcaster,
  (req, res) => {
    const stats = getCacheStats()
    res.json({
      ...stats,
      tokenCacheTTL: '5 minutes',
      roleCacheTTL: '2 minutes'
    })
  }
)

app.post(
  '/api/auth/cache/clear',
  authenticate,
  authFailureLimiter,
  requireBroadcaster,
  (req, res) => {
    clearAllCaches()
    console.log(
      `[Auth] All caches cleared by broadcaster: ${(req as AuthenticatedRequest).user?.username}`
    )
    res.json({ success: true, message: 'All authentication caches cleared' })
  }
)

// Settings API endpoints
app.get('/api/settings', authenticate, authFailureLimiter, requireBroadcaster, (req, res) => {
  res.json(settings)
})

app.put(
  '/api/settings',
  authenticate,
  authFailureLimiter,
  authenticatedLimiter,
  requireBroadcaster,
  (req, res) => {
    try {
      const newSettings = req.body as AppSettings

      // Update in-memory settings (will validate via Zod)
      updateSettings(db, newSettings)
      settings = newSettings

      // Broadcast to all connected clients
      invalidateETag()

      console.log('[Settings] Updated:', settings)
      res.json({ success: true, settings })
    } catch (error) {
      console.error('[Settings] Validation failed:', error)
      res.status(400).json({
        error: 'INVALID_SETTINGS',
        message: 'Settings validation failed. Check the details for specific errors.',
        details: error
      })
    }
  }
)

// Global error handling middleware
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Express] Unhandled error:', err)

  // Send structured error response
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500
  res.status(statusCode).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred on the server',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
})

// Start server
const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`)
  console.log(`[Server] Frontend URL: ${FRONTEND_URL}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully')

  if (eventSubClient) {
    eventSubClient.disconnect()
  }

  botTokenManager.stopMonitoring()
  closeDatabase()

  server.close(() => {
    console.log('[Server] HTTP server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down gracefully')

  if (eventSubClient) {
    eventSubClient.disconnect()
  }

  botTokenManager.stopMonitoring()
  closeDatabase()

  server.close(() => {
    console.log('[Server] HTTP server closed')
    process.exit(0)
  })
})
