/**
 * Bootstrap - Load environment and validate before importing app
 *
 * This file ensures dotenv loads BEFORE any module-level code that accesses env vars.
 * In ESM, all imports are hoisted, so we need this separate entry point.
 */

import { config } from 'dotenv'
import { resolveFromRoot } from './paths.js'

// Load .env from project root BEFORE any other imports
config({ path: resolveFromRoot('.env') })

/**
 * Validate required environment variables
 */
function validateEnvironment(): void {
  // Trim all environment variables to remove accidental whitespace
  if (process.env.TWITCH_CLIENT_ID) process.env.TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID.trim()
  if (process.env.TWITCH_CLIENT_SECRET) process.env.TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET.trim()
  if (process.env.TWITCH_BOT_TOKEN) process.env.TWITCH_BOT_TOKEN = process.env.TWITCH_BOT_TOKEN.trim()
  if (process.env.TWITCH_CHANNEL_NAME) process.env.TWITCH_CHANNEL_NAME = process.env.TWITCH_CHANNEL_NAME.trim()
  if (process.env.SESSION_SECRET) process.env.SESSION_SECRET = process.env.SESSION_SECRET.trim()
  if (process.env.API_URL) process.env.API_URL = process.env.API_URL.trim()
  if (process.env.FRONTEND_URL) process.env.FRONTEND_URL = process.env.FRONTEND_URL.trim()

  const required = {
    TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID,
    TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET,
    TWITCH_BOT_TOKEN: process.env.TWITCH_BOT_TOKEN,
    TWITCH_CHANNEL_NAME: process.env.TWITCH_CHANNEL_NAME,
    SESSION_SECRET: process.env.SESSION_SECRET,
    API_URL: process.env.API_URL
  }

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    console.error('[Server] Missing required environment variables:')
    missing.forEach((key) => console.error(`  - ${key}`))
    console.error('\nPlease copy .env.example to .env and fill in the required values.')
    console.error('Run "pnpm api setup" (or "make api-setup") to generate TWITCH_BOT_TOKEN automatically.')
    console.error('For SESSION_SECRET, generate a random string: openssl rand -base64 48')
    process.exit(1)
  }

  // Validate Client-ID format (Twitch uses 30-character alphanumeric IDs)
  const clientId = process.env.TWITCH_CLIENT_ID
  if (clientId && (clientId.length !== 30 || !/^[a-z0-9]+$/.test(clientId))) {
    console.error(`[Server] Invalid TWITCH_CLIENT_ID format: "${clientId}"`)
    console.error('Expected: 30 lowercase alphanumeric characters')
    console.error('Current length:', clientId.length)
    console.error('Check your .env file for extra whitespace or invalid characters')
    process.exit(1)
  }

  console.log('[Server] Environment variables validated ✓')
  console.log(`[Server] Client-ID: ${clientId?.substring(0, 10)}... (${clientId?.length} chars)`)
  console.log('[Auth] Using Twitch OAuth Authorization Code + PKCE flow')
  console.log('[Auth] Broadcaster and moderators can control the queue')
}

// Validate before importing app
validateEnvironment()

// Now safe to import app (env vars are loaded and validated)
import('./index.js')
