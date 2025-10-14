import { defineStore } from 'pinia'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'

import twitch from '@cq/services/twitch'

import { env } from '@/config'
import { clearAuthEvents, emitAuthEvent } from '@/utils/events'
import { UserRoleSchema } from '@/utils/schemas'
import { useLogger } from './logger'

const { API_URL } = env

export const useUser = defineStore('user', () => {
  const logger = useLogger()
  const router = useRouter()

  const isLoggedIn = ref<boolean>(false)
  const username = ref<string | undefined>(undefined)

  // Role information from backend
  const isBroadcaster = ref<boolean>(false)
  const isModerator = ref<boolean>(false)

  // Computed permissions
  const canControlQueue = computed(() => isModerator.value || isBroadcaster.value)
  const canManageSettings = computed(() => isBroadcaster.value)

  // Track initialization state to prevent race conditions with router guards
  const isInitialized = ref<boolean>(false)
  let initializationPromise: Promise<void> | null = null

  // Token validation interval (every 5 minutes to detect expired tokens)
  let validationInterval: ReturnType<typeof setInterval> | null = null

  /**
   * Redirect to backend OAuth login
   */
  function redirect(): void {
    twitch.redirect(API_URL)
  }

  /**
   * Fetch user role information from backend
   * (broadcaster/moderator status for the configured channel)
   * Backend reads token from httpOnly cookie automatically
   */
  async function fetchUserRole(): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        credentials: 'include' // Send cookies
      })

      if (!response.ok) {
        if (response.status === 401) {
          logger.error('[User]: Token validation failed - invalid or expired')
          emitAuthEvent({
            type: 'unauthorized',
            message: 'Authentication failed. Please log in again.'
          })
          await logout()
        } else {
          logger.error(`[User]: Failed to fetch role: ${response.status}`)
        }
        return
      }

      const rawData = await response.json()
      const parseResult = UserRoleSchema.safeParse(rawData)

      if (!parseResult.success) {
        logger.error(
          `[User]: Invalid role data from server: ${JSON.stringify(parseResult.error.issues)}`
        )
        return
      }

      const data = parseResult.data
      username.value = data.username
      isBroadcaster.value = data.isBroadcaster
      isModerator.value = data.isModerator
      isLoggedIn.value = true

      logger.info(
        `[User]: Role fetched - User: ${data.username}, Broadcaster: ${data.isBroadcaster}, Moderator: ${data.isModerator}`
      )
    } catch (error: unknown) {
      logger.error(`[User]: Failed to fetch role: ${error}`)
    }
  }

  /**
   * Check if user is logged in and fetch role
   * Call this on app initialization and after OAuth callback
   */
  async function checkLoginStatus(): Promise<void> {
    try {
      const isValid = await twitch.isLoginValid(API_URL)
      if (isValid) {
        await fetchUserRole()
        startProactiveValidation()
      } else {
        isLoggedIn.value = false
        username.value = undefined
        isBroadcaster.value = false
        isModerator.value = false
      }
    } catch (error: unknown) {
      logger.error(`[User]: Failed to check login status: ${error}`)
      isLoggedIn.value = false
    } finally {
      isInitialized.value = true
    }
  }

  /**
   * Ensure initialization completes before router guards check auth status
   * Returns a promise that resolves when initial login check is done
   */
  async function ensureInitialized(): Promise<void> {
    if (isInitialized.value) return
    if (initializationPromise) return initializationPromise

    // Store the promise so multiple calls wait for the same initialization
    initializationPromise = checkLoginStatus()
    await initializationPromise
  }

  /**
   * Handle OAuth callback
   * Parse URL parameters and check login status
   */
  async function handleOAuthCallback(): Promise<void> {
    const params = new URLSearchParams(window.location.search)
    const loginStatus = params.get('login')

    if (loginStatus === 'success') {
      logger.info('[User]: OAuth login successful')
      await checkLoginStatus()

      // Clean OAuth callback params from URL
      router.replace({ query: {} })
    } else if (loginStatus === 'error') {
      const reason = params.get('reason') || 'unknown'
      logger.error(`[User]: OAuth login failed: ${reason}`)

      emitAuthEvent({
        type: 'unauthorized',
        message: `Login failed: ${reason}. Please try again.`
      })

      // Clean OAuth callback params from URL
      router.replace({ query: {} })
    }
  }

  /**
   * Start proactive token validation
   * Validates token every 5 minutes to detect expiration early
   */
  function startProactiveValidation(): void {
    stopProactiveValidation()

    validationInterval = setInterval(
      async () => {
        if (isLoggedIn.value) {
          try {
            const isValid = await twitch.isLoginValid(API_URL)
            if (!isValid) {
              logger.warn('[User]: Token validation failed, logging out')
              emitAuthEvent({
                type: 'expired',
                message: 'Your session has expired. Please log in again.'
              })
              await logout()
            } else {
              logger.debug('[User]: Token validated successfully')
            }
          } catch (error: unknown) {
            logger.error(`[User]: Token validation error: ${error}`)
          }
        }
      },
      5 * 60 * 1000
    ) // 5 minutes

    logger.debug('[User]: Started proactive token validation (every 5 minutes)')
  }

  /**
   * Stop proactive token validation
   */
  function stopProactiveValidation(): void {
    if (validationInterval) {
      clearInterval(validationInterval)
      validationInterval = null
      logger.debug('[User]: Stopped proactive token validation')
    }
  }

  /**
   * Cleanup on store disposal
   */
  onBeforeUnmount(() => {
    stopProactiveValidation()
    logger.debug('[User]: Cleaned up validation interval on unmount')
  })

  /**
   * Logout user
   */
  async function logout(): Promise<void> {
    // Stop proactive validation
    stopProactiveValidation()

    // Clear any pending auth events
    clearAuthEvents()

    // Call backend OAuth logout endpoint
    try {
      await twitch.logout(API_URL)
      logger.info('[User]: Logged out successfully')
    } catch (error: unknown) {
      logger.error(`[User]: Logout failed: ${error}`)
    }

    // Clear local state
    isLoggedIn.value = false
    username.value = undefined
    isBroadcaster.value = false
    isModerator.value = false
  }

  return {
    isLoggedIn,
    username,
    isBroadcaster,
    isModerator,
    canControlQueue,
    canManageSettings,
    isInitialized,
    redirect,
    checkLoginStatus,
    ensureInitialized,
    handleOAuthCallback,
    logout,
    fetchUserRole
  }
})
