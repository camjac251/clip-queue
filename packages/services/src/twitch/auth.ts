/**
 * Twitch OAuth Authentication (Backend-Driven Flow)
 *
 * Uses Authorization Code + PKCE flow handled by backend.
 * Tokens are stored in httpOnly cookies, not accessible to JavaScript.
 */

/**
 * Redirect to backend OAuth login endpoint
 * Backend will handle PKCE challenge generation and redirect to Twitch
 *
 * @param apiUrl - Backend API URL
 */
export function redirect(apiUrl: string): void {
  window.location.assign(`${apiUrl}/api/oauth/login`)
}

/**
 * Logout by calling backend OAuth logout endpoint
 * Backend will revoke tokens and clear httpOnly cookies
 *
 * @param apiUrl - Backend API URL
 */
export async function logout(apiUrl: string): Promise<void> {
  try {
    const response = await fetch(`${apiUrl}/api/oauth/logout`, {
      method: 'POST',
      credentials: 'include' // Send cookies
    })

    if (!response.ok) {
      throw new Error(`Logout failed: ${response.status}`)
    }
  } catch (error) {
    console.error('[Auth] Logout failed:', error)
    throw error
  }
}

/**
 * Check if user is logged in by validating with backend
 * Backend reads token from httpOnly cookie automatically
 *
 * @param apiUrl - Backend API URL
 * @returns True if logged in and token is valid
 */
export async function isLoginValid(apiUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${apiUrl}/api/auth/validate`, {
      credentials: 'include' // Send cookies
    })

    return response.ok
  } catch {
    return false
  }
}

export default {
  redirect,
  logout,
  isLoginValid
}
