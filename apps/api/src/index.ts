/**
 * Clip Queue Server
 *
 * Express + Socket.io + EventSub backend for multi-user clip queue.
 * Continuously monitors Twitch chat, manages clip queue, and syncs to all connected clients.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import express from 'express'
import { Server as SocketIOServer } from 'socket.io'
import { createServer } from 'http'
import cors from 'cors'
import helmet from 'helmet'
import { ClipList, toClipUUID } from '@cq/platforms'
import { TwitchPlatform } from '@cq/platforms'
import {
  initDatabase,
  closeDatabase,
  initSettings,
  getSettings,
  updateSettings,
  upsertClip,
  getClipsByStatus,
  updateClipStatus,
  deleteClipsByStatus,
  deleteClip,
  type Clip,
  type AppSettings
} from './db.js'
import { TwitchEventSubClient } from './eventsub.js'

// Load .env from project root (for development)
config({ path: resolve(process.cwd(), '../../.env') })

/**
 * Async route wrapper to catch errors and pass to Express error middleware
 */
function asyncHandler(fn: express.RequestHandler): express.RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/**
 * Validate required environment variables
 */
function validateEnvironment(): void {
  const required = {
    TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID,
    TWITCH_BOT_TOKEN: process.env.TWITCH_BOT_TOKEN,
    TWITCH_CHANNEL_NAME: process.env.TWITCH_CHANNEL_NAME
  }

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    console.error('[Server] Missing required environment variables:')
    missing.forEach((key) => console.error(`  - ${key}`))
    console.error('\nPlease copy .env.example to .env and fill in the required values.')
    console.error('Run "pnpm api setup" (or "make api-setup") to generate TWITCH_BOT_TOKEN automatically.')
    process.exit(1)
  }

  console.log('[Server] Environment variables validated ✓')
}

// Validate environment before starting
validateEnvironment()

const app = express()
const server = createServer(app)

// CORS configuration
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
app.use(helmet())
app.use(cors({ origin: FRONTEND_URL, credentials: true }))
app.use(express.json())

// Socket.io with CORS
const io = new SocketIOServer(server, {
  cors: {
    origin: FRONTEND_URL,
    credentials: true
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
      io.emit('queue:opened', {})
      console.log(`[Command] Queue opened by ${message.username}`)
      break

    case 'close':
      isQueueOpen = false
      io.emit('queue:closed', {})
      console.log(`[Command] Queue closed by ${message.username}`)
      break

    case 'clear': {
      const previousQueue = queue.toArray()
      try {
        queue.clear()
        deleteClipsByStatus(db, 'approved')
        io.emit('queue:cleared', {})
        console.log(`[Command] Queue cleared by ${message.username}`)
      } catch (error) {
        // Roll back in-memory changes on database failure
        previousQueue.forEach((clip: Clip) => queue.add(clip))
        console.error(`[Command] Failed to clear queue: ${error}`)
      }
      break
    }

    case 'next': {
      const previousCurrent = currentClip
      try {
        // Move current to history
        if (currentClip) {
          history.add(currentClip)
          const clipId = toClipUUID(currentClip)
          updateClipStatus(db, clipId, 'played')
        }

        // Get next clip
        const nextClip = queue.shift()
        currentClip = nextClip || null

        // Broadcast change
        io.emit('queue:current', { clip: currentClip })
        console.log(`[Command] Advanced to next clip by ${message.username}`)
      } catch (error) {
        // Roll back in-memory changes on database failure
        if (previousCurrent) {
          history.remove(previousCurrent)
        }
        if (currentClip) {
          queue.unshift(currentClip)
        }
        currentClip = previousCurrent
        console.error(`[Command] Failed to advance to next clip: ${error}`)
      }
      break
    }

    case 'prev':
    case 'previous':
      // Move current back to upcoming
      if (currentClip) {
        queue.unshift(currentClip)
      }

      // Pop from history
      const prevClip = history.toArray().pop()
      if (prevClip) {
        history.remove(prevClip)
        currentClip = prevClip
      } else {
        currentClip = null
      }

      // Broadcast change
      io.emit('queue:current', { clip: currentClip })
      console.log(`[Command] Went to previous clip by ${message.username}`)
      break

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
 */
async function handleClipSubmission(
  url: string,
  submitter: string,
  autoApprove = false
): Promise<void> {
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

    // Check if clip already exists in queue
    if (queue.includes(clip)) {
      // Add submitter to existing clip using transaction-safe upsert
      const updatedClip = upsertClip(db, clipId, { ...clip, submitters: [submitter] }, 'approved')

      // Update in-memory queue
      queue.add(updatedClip)

      // Broadcast update
      io.emit('clip:added', { clip: updatedClip })
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
    io.emit('clip:added', { clip: savedClip })
    console.log(`[Queue] Added clip: ${clip.title} (submitted by ${submitter})`)
  } catch (error) {
    console.error('[Queue] Failed to submit clip:', error)
  }
}

// Connect to chat on startup
connectToChat()

// WebSocket connection handler
io.on('connection', (socket) => {
  console.log(`[WebSocket] Client connected: ${socket.id}`)

  // Send initial state
  socket.emit('sync:state', {
    current: currentClip,
    upcoming: queue.toArray(),
    history: history.toArray(),
    isOpen: isQueueOpen
  })

  socket.on('disconnect', () => {
    console.log(`[WebSocket] Client disconnected: ${socket.id}`)
  })
})

// REST API endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    chatConnected: eventSubClient?.isConnected() || false,
    queueSize: queue.toArray().length
  })
})

app.get('/api/queue', (req, res) => {
  res.json({
    current: currentClip,
    upcoming: queue.toArray(),
    history: history.toArray(),
    isOpen: isQueueOpen
  })
})

app.post('/api/queue/submit', asyncHandler(async (req, res) => {
  const { url, submitter } = req.body as { url: string; submitter: string }

  if (!url || !submitter) {
    return res.status(400).json({ error: 'Missing url or submitter' })
  }

  await handleClipSubmission(url, submitter, false)
  res.json({ success: true })
}))

app.post('/api/queue/advance', asyncHandler(async (req, res) => {
  const previousCurrent = currentClip
  try {
    // Move current to history
    if (currentClip) {
      history.add(currentClip)
      const clipId = toClipUUID(currentClip)
      updateClipStatus(db, clipId, 'played')
    }

    // Get next clip
    const nextClip = queue.shift()
    currentClip = nextClip || null

    // Broadcast change
    io.emit('queue:current', { clip: currentClip })

    console.log(`[Queue] Advanced to next clip: ${currentClip?.title || 'none'}`)
    res.json({ success: true, current: currentClip })
  } catch (error) {
    // Roll back in-memory changes on database failure
    if (previousCurrent) {
      history.remove(previousCurrent)
    }
    if (currentClip) {
      queue.unshift(currentClip)
    }
    currentClip = previousCurrent
    throw error // Let asyncHandler catch and respond with error
  }
}))

app.post('/api/queue/previous', (req, res) => {
  // Move current back to upcoming
  if (currentClip) {
    queue.unshift(currentClip)
  }

  // Pop from history
  const prevClip = history.toArray().pop()
  if (prevClip) {
    history.remove(prevClip)
    currentClip = prevClip
  } else {
    currentClip = null
  }

  // Broadcast change
  io.emit('queue:current', { clip: currentClip })

  console.log(`[Queue] Went to previous clip: ${currentClip?.title || 'none'}`)
  res.json({ success: true, current: currentClip })
})

app.delete('/api/queue', asyncHandler(async (req, res) => {
  const previousQueue = queue.toArray()
  try {
    queue.clear()
    deleteClipsByStatus(db, 'approved')
    io.emit('queue:cleared', {})

    console.log('[Queue] Cleared queue')
    res.json({ success: true })
  } catch (error) {
    // Roll back in-memory changes on database failure
    previousQueue.forEach((clip: Clip) => queue.add(clip))
    throw error // Let asyncHandler catch and respond with error
  }
}))

app.delete('/api/queue/history', asyncHandler(async (req, res) => {
  const previousHistory = history.toArray()
  try {
    history.clear()
    deleteClipsByStatus(db, 'played')

    // Broadcast history cleared event
    io.emit('history:cleared', {})

    console.log('[Queue] Cleared history')
    res.json({ success: true })
  } catch (error) {
    // Roll back in-memory changes on database failure
    previousHistory.forEach((clip: Clip) => history.add(clip))
    throw error // Let asyncHandler catch and respond with error
  }
}))

app.post('/api/queue/open', (req, res) => {
  isQueueOpen = true
  io.emit('queue:opened', {})
  console.log('[Queue] Queue opened')
  res.json({ success: true })
})

app.post('/api/queue/close', (req, res) => {
  isQueueOpen = false
  io.emit('queue:closed', {})
  console.log('[Queue] Queue closed')
  res.json({ success: true })
})

app.post('/api/queue/remove', asyncHandler(async (req, res) => {
  const { clipId } = req.body as { clipId: string }

  if (!clipId) {
    return res.status(400).json({ error: 'Missing clipId' })
  }

  // Find and remove clip
  const clips = queue.toArray()
  const clip = clips.find((c) => toClipUUID(c) === clipId)

  if (clip) {
    try {
      queue.remove(clip)
      updateClipStatus(db, clipId, 'rejected')

      // Broadcast removal
      io.emit('clip:removed', { clipId })

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

app.post('/api/queue/play', asyncHandler(async (req, res) => {
  const { clipId } = req.body as { clipId: string }

  if (!clipId) {
    return res.status(400).json({ error: 'Missing clipId' })
  }

  // Find clip in queue
  const clips = queue.toArray()
  const clip = clips.find((c) => toClipUUID(c) === clipId)

  if (!clip) {
    return res.status(404).json({ error: 'Clip not found' })
  }

  const previousCurrent = currentClip
  try {
    // Move current to history
    if (currentClip) {
      history.add(currentClip)
      const currentId = toClipUUID(currentClip)
      updateClipStatus(db, currentId, 'played')
    }

    // Remove clip from queue and set as current
    queue.remove(clip)
    currentClip = clip

    // Broadcast change
    io.emit('queue:current', { clip: currentClip })

    console.log(`[Queue] Playing clip: ${currentClip.title}`)
    res.json({ success: true, current: currentClip })
  } catch (error) {
    // Roll back in-memory changes on database failure
    if (previousCurrent) {
      history.remove(previousCurrent)
    }
    queue.add(clip)
    currentClip = previousCurrent
    throw error // Let asyncHandler catch and respond with error
  }
}))

// Settings API endpoints
app.get('/api/settings', (req, res) => {
  res.json(settings)
})

app.put('/api/settings', (req, res) => {
  try {
    const newSettings = req.body as AppSettings

    // Update in-memory settings (will validate via Zod)
    updateSettings(db, newSettings)
    settings = newSettings

    // Broadcast to all connected clients
    io.emit('settings:updated', settings)

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
