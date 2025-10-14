/**
 * Authentication & Authorization Module
 *
 * Handles Twitch OAuth token validation and role-based access control.
 * Validates tokens with Twitch API and checks broadcaster/moderator status.
 */

import type { NextFunction, Request, Response } from 'express'

import type { AuthenticatedUser } from '@cq/schemas'
import {
  TwitchModeratorsResponseSchema,
  TwitchUsersResponseSchema,
  TwitchValidateResponseSchema
} from '@cq/schemas'
import { TTLCache } from '@cq/utils'

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser
}

export type { AuthenticatedUser }

// Token cache with 5-minute TTL using TTLCache utility
interface CachedToken {
  user_id: string
  login: string
}

const tokenCache = new TTLCache<string, CachedToken>(5 * 60 * 1000) // 5 minutes

/**
 * Validate Twitch OAuth token with Twitch API (with caching)
 */
export async function validateTwitchToken(
  token: string
): Promise<{ user_id: string; login: string } | null> {
  // Check cache first
  const cached = tokenCache.get(token)
  if (cached) {
    return { user_id: cached.user_id, login: cached.login }
  }

  try {
    const response = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: {
        Authorization: `OAuth ${token}`
      }
    })

    if (!response.ok) {
      // Token is invalid, ensure it's not cached
      tokenCache.delete(token)
      return null
    }

    const rawData = await response.json()

    // Validate with Zod
    const parseResult = TwitchValidateResponseSchema.safeParse(rawData)
    if (!parseResult.success) {
      console.error('[Auth] Invalid response from Twitch validate:', parseResult.error)
      // Invalid response format, don't cache
      tokenCache.delete(token)
      return null
    }

    const data = parseResult.data
    const result = {
      user_id: data.user_id,
      login: data.login
    }

    // Use Twitch's expires_in but cap at cache TTL (5 minutes)
    const twitchExpiry = data.expires_in * 1000 // Convert seconds to ms
    const cacheDuration = Math.min(twitchExpiry, 5 * 60 * 1000)

    // Cache the result
    tokenCache.set(token, result, cacheDuration)

    return result
  } catch (error) {
    console.error('[Auth] Token validation failed:', error)
    // Network error, don't cache the failure
    tokenCache.delete(token)
    return null
  }
}

/**
 * Invalidate token from cache (called on logout)
 */
export function invalidateTokenCache(token: string): void {
  tokenCache.delete(token)
}

/**
 * Clear all caches (useful for development/testing)
 */
export function clearAllCaches(): void {
  tokenCache.clear()
  roleCache.clear()
  userDataCache.clear()
  console.log('[Auth] All caches cleared')
}

/**
 * Invalidate role cache for a specific user/channel combination
 */
export function invalidateRoleCache(userId: string, broadcasterLogin: string): void {
  const cacheKey = getRoleCacheKey(userId, broadcasterLogin)
  roleCache.delete(cacheKey)
}

/**
 * Clear all role cache entries
 */
export function clearRoleCache(): void {
  roleCache.clear()
  console.log('[Auth] Role cache cleared')
}

/**
 * Get cache statistics for debugging/monitoring
 */
export function getCacheStats(): {
  tokenCacheSize: number
  roleCacheSize: number
  userDataCacheSize: number
} {
  return {
    tokenCacheSize: tokenCache.size,
    roleCacheSize: roleCache.size,
    userDataCacheSize: userDataCache.size
  }
}

// Role cache with 2-minute TTL (shorter than token cache to handle role changes faster)
interface CachedRole {
  isBroadcaster: boolean
  isModerator: boolean
}

const roleCache = new TTLCache<string, CachedRole>(2 * 60 * 1000) // 2 minutes

// User data cache with 10-minute TTL (profile pics rarely change)
interface CachedUserData {
  displayName: string
  profileImageUrl: string
}

const userDataCache = new TTLCache<string, CachedUserData>(10 * 60 * 1000) // 10 minutes

/**
 * Generate role cache key from userId and broadcaster login
 */
function getRoleCacheKey(userId: string, broadcasterLogin: string): string {
  return `${userId}:${broadcasterLogin}`
}

/**
 * Check if user is a moderator or broadcaster of the channel (with caching)
 */
export async function checkChannelRole(
  clientId: string,
  userId: string,
  broadcasterLogin: string,
  userToken: string
): Promise<{ isBroadcaster: boolean; isModerator: boolean }> {
  // Create cache key from userId + channel
  const cacheKey = getRoleCacheKey(userId, broadcasterLogin)

  // Check cache first
  const cached = roleCache.get(cacheKey)
  if (cached) {
    return {
      isBroadcaster: cached.isBroadcaster,
      isModerator: cached.isModerator
    }
  }

  try {
    // First, get broadcaster ID using user's token
    const broadcasterResponse = await fetch(
      `https://api.twitch.tv/helix/users?login=${broadcasterLogin}`,
      {
        headers: {
          'Client-Id': clientId,
          Authorization: `Bearer ${userToken}`
        }
      }
    )

    if (!broadcasterResponse.ok) {
      throw new Error('Failed to fetch broadcaster info')
    }

    const rawBroadcasterData = await broadcasterResponse.json()

    // Validate with Zod
    const broadcasterParseResult = TwitchUsersResponseSchema.safeParse(rawBroadcasterData)
    if (!broadcasterParseResult.success) {
      console.error('[Auth] Invalid response from Twitch users API:', broadcasterParseResult.error)
      throw new Error('Invalid broadcaster data from Twitch')
    }

    const broadcasterData = broadcasterParseResult.data
    const broadcasterId = broadcasterData.data[0]?.id

    if (!broadcasterId) {
      throw new Error('Broadcaster not found')
    }

    // Check if user is the broadcaster
    const isBroadcaster = userId === broadcasterId

    // Check if user is a moderator
    let isModerator = false
    if (!isBroadcaster) {
      const modResponse = await fetch(
        `https://api.twitch.tv/helix/moderation/moderators?broadcaster_id=${broadcasterId}&user_id=${userId}`,
        {
          headers: {
            'Client-Id': clientId,
            Authorization: `Bearer ${userToken}`
          }
        }
      )

      if (modResponse.ok) {
        const rawModData = await modResponse.json()

        // Validate with Zod
        const modParseResult = TwitchModeratorsResponseSchema.safeParse(rawModData)
        if (!modParseResult.success) {
          console.error('[Auth] Invalid response from Twitch moderators API:', modParseResult.error)
        } else {
          const modData = modParseResult.data
          isModerator = modData.data.length > 0
        }
      }
    }

    const result = { isBroadcaster, isModerator }

    // Cache the result with shorter TTL to handle role changes faster
    roleCache.set(cacheKey, result)

    return result
  } catch (error) {
    console.error('[Auth] Role check failed:', error)
    return { isBroadcaster: false, isModerator: false }
  }
}

/**
 * Fetch user display name and profile image from Twitch Helix API (with caching)
 */
async function fetchUserData(
  clientId: string,
  userId: string,
  userToken: string
): Promise<{ displayName: string; profileImageUrl: string }> {
  // Check cache first
  const cached = userDataCache.get(userId)
  if (cached) {
    return {
      displayName: cached.displayName,
      profileImageUrl: cached.profileImageUrl
    }
  }

  try {
    const response = await fetch(`https://api.twitch.tv/helix/users?id=${userId}`, {
      headers: {
        'Client-Id': clientId,
        Authorization: `Bearer ${userToken}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch user data from Twitch')
    }

    const rawData = await response.json()

    // Validate with Zod
    const parseResult = TwitchUsersResponseSchema.safeParse(rawData)
    if (!parseResult.success) {
      console.error('[Auth] Invalid response from Twitch users API:', parseResult.error)
      throw new Error('Invalid user data from Twitch')
    }

    const userData = parseResult.data
    const user = userData.data[0]

    if (!user) {
      throw new Error('User not found')
    }

    const result = {
      displayName: user.display_name,
      profileImageUrl: user.profile_image_url
    }

    // Cache the result for 10 minutes
    userDataCache.set(userId, result)

    return result
  } catch (error) {
    console.error('[Auth] Failed to fetch user data:', error)
    // Don't cache failures
    userDataCache.delete(userId)
    throw error
  }
}

/**
 * Middleware: Authenticate user via Twitch OAuth token
 * Reads token from httpOnly cookie set by OAuth flow
 */
export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // Read token from httpOnly cookie
  const token = req.cookies?.auth_token

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Please log in.'
    })
    return
  }

  const clientId = process.env.TWITCH_CLIENT_ID
  const channelName = process.env.TWITCH_CHANNEL_NAME

  if (!clientId || !channelName) {
    res.status(500).json({ error: 'Server misconfiguration' })
    return
  }

  // Validate token and check roles
  validateTwitchToken(token)
    .then((userData) => {
      if (!userData) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or expired token. Please log in again.'
        })
        return null
      }

      // Fetch role and user data in parallel
      return Promise.all([
        checkChannelRole(clientId, userData.user_id, channelName, token),
        fetchUserData(clientId, userData.user_id, token)
      ]).then(([roles, userInfo]) => ({
        ...userData,
        ...roles,
        ...userInfo
      }))
    })
    .then((user) => {
      if (!user) return

      req.user = {
        userId: user.user_id,
        username: user.login,
        displayName: user.displayName,
        profileImageUrl: user.profileImageUrl,
        isBroadcaster: user.isBroadcaster,
        isModerator: user.isModerator
      }

      next()
    })
    .catch((error: unknown) => {
      console.error('[Auth] Authentication error:', error)
      res.status(500).json({ error: 'Authentication failed' })
    })
}

/**
 * Middleware: Require broadcaster permissions
 */
export function requireBroadcaster(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!req.user.isBroadcaster) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'This action requires broadcaster permissions'
    })
    return
  }

  next()
}

/**
 * Middleware: Require moderator or broadcaster permissions
 */
export function requireModerator(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!req.user.isModerator && !req.user.isBroadcaster) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'This action requires moderator or broadcaster permissions'
    })
    return
  }

  next()
}
