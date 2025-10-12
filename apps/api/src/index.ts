/**
 * Clip Queue Server
 *
 * Express + Socket.io + EventSub backend for multi-user clip queue.
 * Continuously monitors Twitch chat, manages clip queue, and syncs to all connected clients.
 *
 * NOTE: This file is imported by server.ts, which loads .env and validates env vars first.
 */

import express from 'express'
import { Server as SocketIOServer } from 'socket.io'
import { createServer } from 'http'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import { z } from 'zod'
import { ClipList, toClipUUID } from '@cq/platforms'
import { advanceQueue, previousClip, clearQueue, playClip } from '@cq/queue-ops'
import { WEBSOCKET_EVENTS } from '@cq/constants/events'

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
import { TwitchPlatform } from '@cq/platforms'
import {
  initDatabase,
  closeDatabase,
  initSettings,
  updateSettings,
  upsertClip,
  getClipsByStatus,
  updateClipStatus,
  deleteClipsByStatus,
  type Clip,
  type AppSettings
} from './db.js'
import { TwitchEventSubClient } from './eventsub.js'
import { authenticate, requireBroadcaster, requireModerator, validateTwitchToken, checkChannelRole, invalidateTokenCache, invalidateRoleCache, clearAllCaches, getCacheStats, type AuthenticatedRequest } from './auth.js'
import oauthRouter from './oauth.js'

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
    // TypeScript doesn't know AuthenticatedRequest is compatible with Express Request
    return ipKeyGenerator(req as any)
  },
  skipSuccessfulRequests: false
})

const authFailureLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failures
  message: 'Too many failed authentication attempts. Please try again later.'
})

// Socket.io with CORS - Use same origin configuration as Express
const io = new SocketIOServer(server, {
  cors: {
    origin: corsOrigin,
    credentials: true
  }
})

// Socket.io authentication middleware
io.use(async (socket, next) => {
  // Parse cookies from handshake headers
  const cookieHeader = socket.handshake.headers.cookie
  let token: string | undefined

  if (cookieHeader && typeof cookieHeader === 'string') {
    try {
      // Parse auth_token from cookie string (simple parser for this one cookie)
      const cookies = Object.fromEntries(
        cookieHeader.split('; ').map(cookie => {
          const [name, ...rest] = cookie.split('=')
          return [name, rest.join('=')]
        })
      )
      token = cookies.auth_token
    } catch (error) {
      console.error('[WebSocket] Cookie parsing error:', error)
    }
  }

  // Allow connections without token (unauthenticated viewers)
  // They can view the queue but cannot perform actions
  if (!token) {
    console.log('[WebSocket] Unauthenticated connection allowed (read-only)')
    return next()
  }

  try {
    // Validate token with Twitch API
    const userData = await validateTwitchToken(token)

    if (!userData) {
      return next(new Error('Invalid authentication token'))
    }

    // Check broadcaster/moderator status
    const roles = await checkChannelRole(
      process.env.TWITCH_CLIENT_ID!,
      userData.user_id,
      process.env.TWITCH_CHANNEL_NAME!,
      token
    )

    // Attach full user data including roles
    socket.data.user = {
      userId: userData.user_id,
      username: userData.login,
      isBroadcaster: roles.isBroadcaster,
      isModerator: roles.isModerator
    }

    console.log(`[WebSocket] Authenticated: ${userData.login} (Broadcaster: ${roles.isBroadcaster}, Mod: ${roles.isModerator})`)
    next()
  } catch (error) {
    console.error('[WebSocket] Authentication error:', error)
    next(new Error('Authentication failed'))
  }
})

// Initialize database
const db = initDatabase(process.env.DB_PATH)

// Initialize settings from database
let settings: AppSettings = initSettings(db)
console.log('[Settings] Loaded from database:', settings)

// Initialize queue and platform
const queue = new ClipList()
const history = new ClipList()
let currentClip: Clip | null = null
let isQueueOpen = true

const platform = new TwitchPlatform(() => ({
  id: process.env.TWITCH_CLIENT_ID!,
  token: process.env.TWITCH_BOT_TOKEN
}))

// Restore queue and history from database
function restoreQueueFromDatabase() {
  const approvedClips = getClipsByStatus(db, 'approved')
  const playedClips = getClipsByStatus(db, 'played', 50)

  for (const clip of approvedClips) {
    queue.add(clip)
  }

  for (const clip of playedClips.reverse()) {
    history.add(clip)
  }

  console.log(`[Queue] Restored ${approvedClips.length} clips from database`)
  console.log(`[History] Restored ${playedClips.length} clips from database`)
}

restoreQueueFromDatabase()

// Initialize Twitch EventSub chat monitoring
let eventSubClient: TwitchEventSubClient | null = null

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
  const clientId = process.env.TWITCH_CLIENT_ID!
  const botToken = process.env.TWITCH_BOT_TOKEN!

  try {
    console.log(`[Chat] Connecting to EventSub for channel: ${channelName}`)

    eventSubClient = new TwitchEventSubClient(clientId, botToken)

    // Handle disconnection (unexpected only - Twitch reconnects handled in EventSub)
    eventSubClient.onDisconnect(() => {
      console.log('[Chat] EventSub disconnected unexpectedly')
      eventSubClient = null

      // Don't reconnect here - EventSub client handles graceful reconnects
      // For unexpected disconnects, outer error handler will retry with backoff
    })

    // Listen for chat messages
    eventSubClient.onMessage(async (message) => {
      try {
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
          // Check if it's a Twitch clip URL
          if (url.includes('twitch.tv') && (url.includes('clip') || url.includes('/clips/'))) {
            await handleClipSubmission(url, message.username, canAutoApprove)
          }
          // Check if it's a Kick clip URL (format: kick.com/channel/clips/clip_ID)
          else if (url.includes('kick.com/') && url.includes('/clips/clip_')) {
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
      io.emit(WEBSOCKET_EVENTS.QUEUE_OPENED, {})
      console.log(`[Command] Queue opened by ${message.username}`)
      break

    case 'close':
      isQueueOpen = false
      io.emit(WEBSOCKET_EVENTS.QUEUE_CLOSED, {})
      console.log(`[Command] Queue closed by ${message.username}`)
      break

    case 'clear': {
      try {
        await clearQueue(
          { current: currentClip, queue, history },
          {
            updateClipStatus: (clipId, status) => updateClipStatus(db, clipId, status),
            deleteClipsByStatus: (status) => deleteClipsByStatus(db, status)
          }
        )
        io.emit(WEBSOCKET_EVENTS.QUEUE_CLEARED, {})
        console.log(`[Command] Queue cleared by ${message.username}`)
      } catch (error) {
        console.error(`[Command] Failed to clear queue: ${error}`)
      }
      break
    }

    case 'next': {
      try {
        const state = { current: currentClip, queue, history }
        await advanceQueue(
          state,
          {
            updateClipStatus: (clipId, status) => updateClipStatus(db, clipId, status),
            deleteClipsByStatus: (status) => deleteClipsByStatus(db, status)
          },
          toClipUUID
        )
        currentClip = state.current

        // Broadcast change
        io.emit(WEBSOCKET_EVENTS.QUEUE_CURRENT, { clip: currentClip })
        console.log(`[Command] Advanced to next clip by ${message.username}`)
      } catch (error) {
        console.error(`[Command] Failed to advance to next clip: ${error}`)
      }
      break
    }

    case 'prev':
    case 'previous': {
      const state = { current: currentClip, queue, history }
      await previousClip(state)
      currentClip = state.current

      // Broadcast change
      io.emit(WEBSOCKET_EVENTS.QUEUE_CURRENT, { clip: currentClip })
      console.log(`[Command] Went to previous clip by ${message.username}`)
      break
    }

    case 'purgehistory':
      history.clear()
      console.log(`[Command] History purged by ${message.username}`)
      break

    default:
      console.log(`[Command] Unknown command: ${command}`)
      break
  }
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
    // Check if queue is open
    if (!isQueueOpen && !autoApprove) {
      console.log(`[Queue] Queue closed, ignoring clip from ${submitter}`)
      return
    }

    // Fetch clip data using existing platform
    const clip = await platform.getClip(url)
    if (!clip) {
      console.log(`[Queue] Failed to fetch clip: ${url}`)
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
      io.emit(WEBSOCKET_EVENTS.CLIP_ADDED, { clip: updatedClip })
      console.log(`[Queue] Added submitter to existing clip: ${clip.title} (${submitter})`)
      return
    }

    // Add clip to queue with transaction
    const clipWithSubmitter = { ...clip, submitters: [submitter] }
    const status = autoApprove ? 'approved' : 'pending'

    const savedClip = upsertClip(db, clipId, clipWithSubmitter, status)

    // Add to in-memory queue
    queue.add(savedClip)

    // Broadcast to all clients
    io.emit(WEBSOCKET_EVENTS.CLIP_ADDED, { clip: savedClip })
    console.log(`[Queue] Added clip: ${clip.title} (submitted by ${submitter})`)
  } catch (error) {
    console.error('[Queue] Failed to submit clip:', error)
  } finally {
    release()
  }
}

// Connect to chat on startup
connectToChat()

// WebSocket connection handler
io.on('connection', (socket) => {
  console.log(`[WebSocket] Client connected: ${socket.id}`)

  // Send initial state (on both connect and reconnect)
  socket.emit(WEBSOCKET_EVENTS.SYNC_STATE, {
    current: currentClip,
    upcoming: queue.toArray(),
    history: history.toArray(),
    isOpen: isQueueOpen
  })

  // Allow client to request state re-sync manually
  socket.on(WEBSOCKET_EVENTS.SYNC_REQUEST, () => {
    console.log(`[WebSocket] Client ${socket.id} requested state sync`)
    socket.emit(WEBSOCKET_EVENTS.SYNC_STATE, {
      current: currentClip,
      upcoming: queue.toArray(),
      history: history.toArray(),
      isOpen: isQueueOpen
    })
  })

  socket.on('disconnect', () => {
    console.log(`[WebSocket] Client disconnected: ${socket.id}`)
  })
})

// OAuth routes (must come before other API routes)
app.use('/api/oauth', oauthRouter)

// REST API endpoints
app.get('/api/health', publicReadLimiter, (req, res) => {
  res.json({
    status: 'ok',
    chatConnected: eventSubClient?.isConnected() || false,
    queueSize: queue.toArray().length
  })
})

app.get('/api/queue', publicReadLimiter, (req, res) => {
  res.json({
    current: currentClip,
    upcoming: queue.toArray(),
    history: history.toArray(),
    isOpen: isQueueOpen
  })
})

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
  res.json({ success: true })
}))

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
    const state = { current: currentClip, queue, history }
    await advanceQueue(
      state,
      {
        updateClipStatus: (clipId, status) => updateClipStatus(db, clipId, status),
        deleteClipsByStatus: (status) => deleteClipsByStatus(db, status)
      },
      toClipUUID
    )
    currentClip = state.current

    // Broadcast change
    io.emit(WEBSOCKET_EVENTS.QUEUE_CURRENT, { clip: currentClip })

    console.log(`[Queue] Advanced to next clip: ${currentClip?.title || 'none'}`)
    res.json({ success: true, current: currentClip })
  } finally {
    release()
  }
}))

app.post('/api/queue/previous', authenticate, authFailureLimiter, authenticatedLimiter, requireModerator, asyncHandler(async (req, res) => {
  const release = await queueOperationMutex.acquire()
  try {
    const state = { current: currentClip, queue, history }
    await previousClip(state)
    currentClip = state.current

    // Broadcast change
    io.emit(WEBSOCKET_EVENTS.QUEUE_CURRENT, { clip: currentClip })

    console.log(`[Queue] Went to previous clip: ${currentClip?.title || 'none'}`)
    res.json({ success: true, current: currentClip })
  } finally {
    release()
  }
}))

// Clear queue (broadcaster only)
app.delete('/api/queue', authenticate, authFailureLimiter, authenticatedLimiter, requireBroadcaster, asyncHandler(async (req, res) => {
  try {
    await clearQueue(
      { current: currentClip, queue, history },
      {
        updateClipStatus: (clipId, status) => updateClipStatus(db, clipId, status),
        deleteClipsByStatus: (status) => deleteClipsByStatus(db, status)
      }
    )
    io.emit(WEBSOCKET_EVENTS.QUEUE_CLEARED, {})

    console.log('[Queue] Cleared queue')
    res.json({ success: true })
  } catch (error) {
    throw error // Let asyncHandler catch and respond with error
  }
}))

// Clear history (broadcaster only)
app.delete('/api/queue/history', authenticate, authFailureLimiter, authenticatedLimiter, requireBroadcaster, asyncHandler(async (req, res) => {
  const previousHistory = history.toArray()
  try {
    history.clear()
    deleteClipsByStatus(db, 'played')

    // Broadcast history cleared event
    io.emit(WEBSOCKET_EVENTS.HISTORY_CLEARED, {})

    console.log('[Queue] Cleared history')
    res.json({ success: true })
  } catch (error) {
    // Roll back in-memory changes on database failure
    previousHistory.forEach((clip: Clip) => history.add(clip))
    throw error // Let asyncHandler catch and respond with error
  }
}))

// Queue control (broadcaster only)
app.post('/api/queue/open', authenticate, authFailureLimiter, authenticatedLimiter, requireBroadcaster, (req, res) => {
  isQueueOpen = true
  io.emit(WEBSOCKET_EVENTS.QUEUE_OPENED, {})
  console.log('[Queue] Queue opened')
  res.json({ success: true })
})

app.post('/api/queue/close', authenticate, authFailureLimiter, authenticatedLimiter, requireBroadcaster, (req, res) => {
  isQueueOpen = false
  io.emit(WEBSOCKET_EVENTS.QUEUE_CLOSED, {})
  console.log('[Queue] Queue closed')
  res.json({ success: true })
})

// Clip management (moderators only)
app.post('/api/queue/remove', authenticate, authFailureLimiter, authenticatedLimiter, requireModerator, asyncHandler(async (req, res) => {
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
      io.emit(WEBSOCKET_EVENTS.CLIP_REMOVED, { clipId })

      console.log(`[Queue] Removed clip: ${clip.title}`)
      res.json({ success: true })
    } catch (error) {
      // Roll back in-memory changes on database failure
      queue.add(clip)
      throw error // Let asyncHandler catch and respond with error
    }
  } else {
    res.status(404).json({ error: 'Clip not found' })
  }
}))

app.post('/api/queue/play', authenticate, authFailureLimiter, authenticatedLimiter, requireModerator, asyncHandler(async (req, res) => {
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
      return res.status(404).json({ error: 'Clip not found' })
    }

    const state = { current: currentClip, queue, history }
    await playClip(
      state,
      {
        updateClipStatus: (clipId, status) => updateClipStatus(db, clipId, status),
        deleteClipsByStatus: (status) => deleteClipsByStatus(db, status)
      },
      clip,
      toClipUUID
    )
    currentClip = state.current

    // Broadcast change
    io.emit(WEBSOCKET_EVENTS.QUEUE_CURRENT, { clip: currentClip })

    console.log(`[Queue] Playing clip: ${currentClip?.title}`)
    res.json({ success: true, current: currentClip })
  } finally {
    release()
  }
}))

// Auth API endpoints
app.get('/api/auth/me', authenticate, authFailureLimiter, authenticatedLimiter, (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  res.json({
    userId: req.user.userId,
    username: req.user.username,
    isBroadcaster: req.user.isBroadcaster,
    isModerator: req.user.isModerator
  })
})

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

app.get('/api/auth/validate', authenticate, authFailureLimiter, (req: AuthenticatedRequest, res) => {
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
})

// Cache management endpoints (broadcaster only)
app.get('/api/auth/cache/stats', authenticate, authFailureLimiter, requireBroadcaster, (req, res) => {
  const stats = getCacheStats()
  res.json({
    ...stats,
    tokenCacheTTL: '5 minutes',
    roleCacheTTL: '2 minutes'
  })
})

app.post('/api/auth/cache/clear', authenticate, authFailureLimiter, requireBroadcaster, (req, res) => {
  clearAllCaches()
  console.log(`[Auth] All caches cleared by broadcaster: ${(req as AuthenticatedRequest).user?.username}`)
  res.json({ success: true, message: 'All authentication caches cleared' })
})

// Settings API endpoints
app.get('/api/settings', publicReadLimiter, (req, res) => {
  res.json(settings)
})

app.put('/api/settings', authenticate, authFailureLimiter, authenticatedLimiter, requireBroadcaster, (req, res) => {
  try {
    const newSettings = req.body as AppSettings

    // Update in-memory settings (will validate via Zod)
    updateSettings(db, newSettings)
    settings = newSettings

    // Broadcast to all connected clients
    io.emit(WEBSOCKET_EVENTS.SETTINGS_UPDATED, settings)

    console.log('[Settings] Updated:', settings)
    res.json({ success: true, settings })
  } catch (error) {
    console.error('[Settings] Validation failed:', error)
    res.status(400).json({ error: 'Invalid settings', details: error })
  }
})

// Global error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Express] Unhandled error:', err)

  // Send error response
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
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

  closeDatabase()

  server.close(() => {
    console.log('[Server] HTTP server closed')
    process.exit(0)
  })
})
