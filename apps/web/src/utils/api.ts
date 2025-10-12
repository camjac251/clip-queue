/**
 * Authenticated API Utility
 *
 * Wrapper around fetch that automatically includes credentials (cookies),
 * handles token refresh, and emits auth events for error handling.
 */

import { env } from '@/config'
import { emitAuthEvent } from './events'

const { API_URL } = env

// Default timeout for API requests
const DEFAULT_TIMEOUT = 30000 // 30 seconds

// Track if we're currently refreshing to prevent multiple refresh attempts
let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null

/**
 * Try to refresh the access token using the refresh token
 * Returns true if refresh was successful, false otherwise
 */
async function tryRefreshToken(): Promise<boolean> {
  // If already refreshing, wait for that promise
  if (isRefreshing && refreshPromise) {
    return refreshPromise
  }

  isRefreshing = true
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_URL}/api/oauth/refresh`, {
        method: 'POST',
        credentials: 'include'
      })

      if (response.ok) {
        console.log('[API] Token refreshed successfully')
        return true
      } else {
        console.warn('[API] Token refresh failed:', response.status)
        return false
      }
    } catch (error) {
      console.error('[API] Token refresh error:', error)
      return false
    } finally {
      isRefreshing = false
      refreshPromise = null
    }
  })()

  return refreshPromise
}

/**
 * Fetch with automatic authentication using httpOnly cookies
 *
 * Features:
 * - Automatically includes credentials (cookies) in all requests
 * - 30-second timeout by default
 * - Automatic token refresh on 401 errors
 * - Emits auth events for UI notifications
 * - Handles 403 (forbidden) errors with appropriate messaging
 *
 * @param url - API endpoint URL
 * @param options - Fetch options
 * @returns Response object
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  // Set up abort controller for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT)

  try {
    // Make request with credentials
    const response = await fetch(url, {
      ...options,
      credentials: 'include', // Always send cookies
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    // Handle 401 (Unauthorized) - try to refresh token
    if (response.status === 401) {
      console.warn('[API] Received 401 Unauthorized, attempting token refresh')

      const refreshed = await tryRefreshToken()

      if (refreshed) {
        // Retry original request with new token
        const retryResponse = await fetch(url, {
          ...options,
          credentials: 'include'
        })

        // If still unauthorized after refresh, emit event and log out
        if (retryResponse.status === 401) {
          emitAuthEvent({
            type: 'unauthorized',
            message: 'Your session has expired. Please log in again.'
          })
        }

        return retryResponse
      } else {
        // Refresh failed, emit event
        emitAuthEvent({
          type: 'unauthorized',
          message: 'Your session has expired. Please log in again.'
        })

        return response
      }
    }

    // Handle 403 (Forbidden) - insufficient permissions
    if (response.status === 403) {
      const clonedResponse = response.clone()
      const errorData = await clonedResponse.json().catch(() => null)
      const message = errorData?.message || 'You do not have permission to perform this action'

      console.warn('[API] Received 403 Forbidden:', message)
      emitAuthEvent({
        type: 'forbidden',
        message
      })
    }

    // Handle 429 (Too Many Requests) - rate limit exceeded
    if (response.status === 429) {
      const resetHeader = response.headers.get('RateLimit-Reset')
      const retryAfter = response.headers.get('Retry-After')

      let message = 'Too many requests. Please try again later.'

      if (resetHeader) {
        const resetTime = new Date(parseInt(resetHeader) * 1000)
        const now = new Date()
        const minutesUntilReset = Math.ceil((resetTime.getTime() - now.getTime()) / 60000)
        message = `Rate limit exceeded. Please try again in ${minutesUntilReset} minute${minutesUntilReset !== 1 ? 's' : ''}.`
      } else if (retryAfter) {
        message = `Rate limit exceeded. Please try again in ${retryAfter} seconds.`
      }

      console.warn('[API] Received 429 Rate Limit:', message)
      emitAuthEvent({
        type: 'forbidden',
        message
      })
    }

    return response
  } catch (error) {
    clearTimeout(timeoutId)

    // Handle timeout
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[API] Request timeout after ${DEFAULT_TIMEOUT}ms:`, url)
      throw new Error('Request timeout')
    }

    throw error
  }
}
