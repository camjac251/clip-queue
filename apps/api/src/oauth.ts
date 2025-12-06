import type { Request, Response } from 'express'
import type { Store } from 'express-session'
import SQLiteStoreFactory from 'connect-sqlite3'
import express from 'express'
import session from 'express-session'
import pkceChallenge from 'pkce-challenge'

import { TwitchTokenResponseSchema } from '@cq/schemas'

import { resolveFromRoot } from './paths.js'

/**
 * OAuth 2.0 Authorization Code Flow with PKCE
 *
 * Implements secure OAuth flow using Authorization Code + PKCE instead of
 * deprecated Implicit Grant Flow. Tokens are stored in httpOnly cookies
 * to prevent XSS attacks.
 *
 * Flow:
 * 1. GET  /api/oauth/login    - Redirect to Twitch OAuth with PKCE challenge
 * 2. GET  /api/oauth/callback - Exchange code for tokens, set httpOnly cookies
 * 3. POST /api/oauth/refresh  - Refresh expired access token
 * 4. POST /api/oauth/logout   - Clear authentication cookies
 */

const router = express.Router()

// Auth cookie options (shared across token endpoints)
const AUTH_COOKIE_OPTIONS = {
  httpOnly: true, // Prevent JavaScript access (XSS protection)
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'strict' as const, // CSRF protection
  maxAge: 60 * 24 * 60 * 60 * 1000 // 60 days (matches Twitch token lifetime)
}

// Clear cookie options (must match AUTH_COOKIE_OPTIONS minus maxAge)
const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const
}

// Session type extension
interface OAuthSession {
  oauth?: {
    state: string
    codeVerifier: string
  }
}

declare module 'express-session' {
  // Extend SessionData to include OAuth fields (declaration merging)
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface SessionData extends OAuthSession {}
}

// Session store for OAuth state + PKCE verifier
const SQLiteStore = SQLiteStoreFactory(session)
const sessionStore = new SQLiteStore({
  db: 'oauth_sessions.db',
  dir: resolveFromRoot('apps', 'api', 'data'),
  table: 'sessions'
}) as Store

// Session middleware for OAuth state + PKCE
router.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    name: 'oauth_sid', // Different from main app session
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Allow OAuth redirect
      maxAge: 10 * 60 * 1000 // 10 minutes (OAuth flow timeout)
    }
  })
)

/**
 * Step 1: Initiate OAuth flow
 * GET /api/oauth/login
 *
 * Generates PKCE challenge and redirects to Twitch OAuth authorization endpoint.
 */
router.get('/login', async (req: Request, res: Response) => {
  const clientId = process.env.TWITCH_CLIENT_ID
  const apiUrl = process.env.API_URL || 'http://localhost:3000'

  if (!clientId) {
    return res.status(500).json({ error: 'Server misconfiguration: TWITCH_CLIENT_ID not set' })
  }

  try {
    // Generate PKCE challenge
    const { code_verifier, code_challenge } = await pkceChallenge()
    const state = crypto.randomUUID()

    // Store verifier + state in session (will be validated in callback)
    req.session.oauth = {
      state,
      codeVerifier: code_verifier
    }

    // Save session before redirect
    req.session.save((err) => {
      if (err) {
        console.error('[OAuth] Failed to save session:', err)
        return res.status(500).json({ error: 'Failed to initiate OAuth flow' })
      }

      // Construct Twitch authorization URL
      const authUrl = new URL('https://id.twitch.tv/oauth2/authorize')
      authUrl.searchParams.set('client_id', clientId)
      authUrl.searchParams.set('redirect_uri', `${apiUrl}/api/oauth/callback`)
      authUrl.searchParams.set('response_type', 'code') // Authorization Code flow
      authUrl.searchParams.set('scope', 'openid user:read:chat')
      authUrl.searchParams.set('state', state)
      authUrl.searchParams.set('code_challenge', code_challenge)
      authUrl.searchParams.set('code_challenge_method', 'S256')
      authUrl.searchParams.set('claims', JSON.stringify({ id_token: { preferred_username: null } }))

      console.log('[OAuth] Redirecting to Twitch authorization:', authUrl.toString())
      res.redirect(authUrl.toString())
    })
  } catch (error) {
    console.error('[OAuth] Error initiating OAuth flow:', error)
    res.status(500).json({ error: 'Failed to initiate OAuth flow' })
  }
})

/**
 * Step 2: Handle OAuth callback
 * GET /api/oauth/callback?code=...&state=...
 *
 * Validates state, exchanges authorization code for tokens using PKCE,
 * and sets httpOnly cookies with tokens.
 */
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

  // Handle OAuth errors from Twitch
  if (error) {
    console.error('[OAuth] Twitch returned error:', error, error_description)
    return res.redirect(`${frontendUrl}/?login=error&reason=${encodeURIComponent(String(error))}`)
  }

  // Validate required parameters
  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    console.error('[OAuth] Missing code or state parameter')
    return res.redirect(`${frontendUrl}/?login=error&reason=missing_params`)
  }

  // Validate state (CSRF protection)
  if (!req.session.oauth?.state || state !== req.session.oauth.state) {
    console.error('[OAuth] State mismatch - possible CSRF attack')
    req.session.destroy(() => {})
    return res.redirect(`${frontendUrl}/?login=error&reason=csrf`)
  }

  const codeVerifier = req.session.oauth.codeVerifier
  const clientId = process.env.TWITCH_CLIENT_ID
  const clientSecret = process.env.TWITCH_CLIENT_SECRET
  const apiUrl = process.env.API_URL || 'http://localhost:3000'

  if (!clientId || !clientSecret) {
    console.error('[OAuth] Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET')
    return res.redirect(`${frontendUrl}/?login=error&reason=server_config`)
  }

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${apiUrl}/api/oauth/callback`,
        code_verifier: codeVerifier
      })
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}))
      console.error('[OAuth] Token exchange failed:', tokenResponse.status, errorData)
      return res.redirect(`${frontendUrl}/?login=error&reason=token_exchange`)
    }

    const rawTokens = await tokenResponse.json()

    // Validate token response with Zod
    const parseResult = TwitchTokenResponseSchema.safeParse(rawTokens)
    if (!parseResult.success) {
      console.error('[OAuth] Invalid token response:', parseResult.error)
      return res.redirect(`${frontendUrl}/?login=error&reason=invalid_tokens`)
    }

    const tokens = parseResult.data

    // Set httpOnly cookies for access token and refresh token
    res.cookie('auth_token', tokens.access_token, AUTH_COOKIE_OPTIONS)
    res.cookie('refresh_token', tokens.refresh_token, AUTH_COOKIE_OPTIONS)

    console.log('[OAuth] Tokens set successfully, redirecting to frontend')

    // Clear OAuth session
    req.session.destroy((err) => {
      if (err) {
        console.error('[OAuth] Failed to destroy session:', err)
      }

      // Redirect to frontend with success flag
      res.redirect(`${frontendUrl}/?login=success`)
    })
  } catch (error) {
    console.error('[OAuth] Token exchange error:', error)
    req.session.destroy(() => {})
    res.redirect(`${frontendUrl}/?login=error&reason=exception`)
  }
})

/**
 * Step 3: Refresh expired access token
 * POST /api/oauth/refresh
 *
 * Uses refresh token to obtain new access token, updates cookies.
 */
router.post('/refresh', async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refresh_token

  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token available' })
  }

  const clientId = process.env.TWITCH_CLIENT_ID
  const clientSecret = process.env.TWITCH_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  try {
    // Request new access token using refresh token
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}))
      console.error('[OAuth] Token refresh failed:', tokenResponse.status, errorData)

      // Refresh token invalid/expired → clear cookies and force re-login
      res.clearCookie('auth_token', CLEAR_COOKIE_OPTIONS)
      res.clearCookie('refresh_token', CLEAR_COOKIE_OPTIONS)
      return res.status(401).json({ error: 'Refresh token expired', requiresReauth: true })
    }

    const rawTokens = await tokenResponse.json()

    // Validate token response
    const parseResult = TwitchTokenResponseSchema.safeParse(rawTokens)
    if (!parseResult.success) {
      console.error('[OAuth] Invalid token refresh response:', parseResult.error)
      res.clearCookie('auth_token', CLEAR_COOKIE_OPTIONS)
      res.clearCookie('refresh_token', CLEAR_COOKIE_OPTIONS)
      return res.status(500).json({ error: 'Invalid token response' })
    }

    const tokens = parseResult.data

    // Update cookies with new tokens
    res.cookie('auth_token', tokens.access_token, AUTH_COOKIE_OPTIONS)
    res.cookie('refresh_token', tokens.refresh_token, AUTH_COOKIE_OPTIONS)

    console.log('[OAuth] Token refreshed successfully')
    res.json({ success: true })
  } catch (error) {
    console.error('[OAuth] Token refresh error:', error)
    res.status(500).json({ error: 'Token refresh failed' })
  }
})

/**
 * Step 4: Logout
 * POST /api/oauth/logout
 *
 * Revokes tokens with Twitch and clears authentication cookies.
 */
router.post('/logout', async (req: Request, res: Response) => {
  const accessToken = req.cookies.auth_token
  const refreshToken = req.cookies.refresh_token
  const clientId = process.env.TWITCH_CLIENT_ID

  let revokeSuccess = true

  // Attempt to revoke both tokens with Twitch
  if (clientId) {
    // Revoke access token
    if (accessToken) {
      try {
        const revokeResponse = await fetch(
          `https://id.twitch.tv/oauth2/revoke?client_id=${clientId}&token=${accessToken}`,
          { method: 'POST' }
        )

        if (!revokeResponse.ok) {
          console.warn('[OAuth] Access token revocation failed:', revokeResponse.status)
          revokeSuccess = false
        } else {
          console.log('[OAuth] Access token revoked successfully')
        }
      } catch (error) {
        console.error('[OAuth] Access token revocation error:', error)
        revokeSuccess = false
      }
    }

    // Revoke refresh token
    if (refreshToken) {
      try {
        const revokeResponse = await fetch(
          `https://id.twitch.tv/oauth2/revoke?client_id=${clientId}&token=${refreshToken}`,
          { method: 'POST' }
        )

        if (!revokeResponse.ok) {
          console.warn('[OAuth] Refresh token revocation failed:', revokeResponse.status)
          revokeSuccess = false
        } else {
          console.log('[OAuth] Refresh token revoked successfully')
        }
      } catch (error) {
        console.error('[OAuth] Refresh token revocation error:', error)
        revokeSuccess = false
      }
    }
  }

  // Clear cookies after revocation attempts (must use same options as when setting)
  res.clearCookie('auth_token', CLEAR_COOKIE_OPTIONS)
  res.clearCookie('refresh_token', CLEAR_COOKIE_OPTIONS)

  res.json({ success: revokeSuccess })
})

export default router
