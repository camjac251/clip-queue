/**
 * Shared HTTP Utilities
 * Common patterns for HTTP requests, error handling, and authentication
 */

/**
 * Create authorization headers for Twitch API
 */
export function createAuthHeaders(token: string, clientId?: string): HeadersInit {
  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`
  }
  if (clientId) {
    headers['Client-Id'] = clientId
  }
  return headers
}

/**
 * Fetch JSON with automatic error handling
 * Throws on non-OK responses with descriptive error messages
 */
export async function fetchJSON<T>(
  url: string,
  options?: RequestInit,
  errorContext?: string
): Promise<T> {
  const response = await fetch(url, options)

  if (!response.ok) {
    const context = errorContext || url
    throw new Error(`Failed to fetch ${context}: ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

/**
 * Fetch JSON with Bearer token authentication
 */
export async function fetchJSONWithAuth<T>(
  url: string,
  token: string,
  clientId?: string,
  options?: RequestInit,
  errorContext?: string
): Promise<T> {
  return fetchJSON<T>(
    url,
    {
      ...options,
      headers: {
        ...createAuthHeaders(token, clientId),
        ...(options?.headers || {})
      }
    },
    errorContext
  )
}
