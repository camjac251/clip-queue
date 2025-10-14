/**
 * Bot Token Manager
 *
 * Handles automatic refresh of Twitch bot tokens to prevent EventSub disconnection.
 * Monitors token expiration and proactively refreshes tokens before they expire.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs'

import { z } from 'zod'

import { resolveFromRoot } from './paths.js'

const TwitchTokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  scope: z.array(z.string()),
  token_type: z.string()
})

const TwitchValidateResponseSchema = z.object({
  client_id: z.string(),
  login: z.string(),
  scopes: z.array(z.string()),
  user_id: z.string(),
  expires_in: z.number()
})

interface TokenValidation {
  isValid: boolean
  expiresIn: number // seconds
  userId: string
  login: string
}

interface TokenRefreshResult {
  success: boolean
  newAccessToken?: string
  newRefreshToken?: string
  error?: string
}

export class BotTokenManager {
  private clientId: string
  private clientSecret: string
  private accessToken: string
  private botRefreshToken: string | null
  private validationCheckInterval: NodeJS.Timeout | null = null
  private onTokenRefreshed?: (newAccessToken: string) => void

  constructor(clientId: string, clientSecret: string, accessToken: string, refreshToken?: string) {
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.accessToken = accessToken
    this.botRefreshToken = refreshToken || null
  }

  /**
   * Get current access token
   */
  getAccessToken(): string {
    return this.accessToken
  }

  /**
   * Register callback for when token is refreshed
   */
  onRefresh(callback: (newAccessToken: string) => void): void {
    this.onTokenRefreshed = callback
  }

  /**
   * Start monitoring token expiration (checks every 24 hours)
   */
  startMonitoring(): void {
    // Check immediately on startup
    this.checkAndRefreshToken().catch((error) =>
      console.error('[TokenManager] Initial token check failed:', error)
    )

    // Then check every 24 hours
    this.validationCheckInterval = setInterval(
      () => {
        this.checkAndRefreshToken().catch((error) =>
          console.error('[TokenManager] Scheduled token check failed:', error)
        )
      },
      24 * 60 * 60 * 1000
    ) // 24 hours

    console.log('[TokenManager] Token monitoring started (checks every 24 hours)')
  }

  /**
   * Stop monitoring token expiration
   */
  stopMonitoring(): void {
    if (this.validationCheckInterval) {
      clearInterval(this.validationCheckInterval)
      this.validationCheckInterval = null
      console.log('[TokenManager] Token monitoring stopped')
    }
  }

  /**
   * Validate current bot token with Twitch API
   */
  async validateToken(): Promise<TokenValidation> {
    try {
      const response = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: {
          Authorization: `OAuth ${this.accessToken}`
        }
      })

      if (!response.ok) {
        return {
          isValid: false,
          expiresIn: 0,
          userId: '',
          login: ''
        }
      }

      const rawData = await response.json()
      const parseResult = TwitchValidateResponseSchema.safeParse(rawData)

      if (!parseResult.success) {
        console.error('[TokenManager] Invalid validation response:', parseResult.error)
        return {
          isValid: false,
          expiresIn: 0,
          userId: '',
          login: ''
        }
      }

      const data = parseResult.data

      return {
        isValid: true,
        expiresIn: data.expires_in,
        userId: data.user_id,
        login: data.login
      }
    } catch (error) {
      console.error('[TokenManager] Token validation failed:', error)
      return {
        isValid: false,
        expiresIn: 0,
        userId: '',
        login: ''
      }
    }
  }

  /**
   * Refresh bot token using refresh token
   */
  async refreshToken(): Promise<TokenRefreshResult> {
    if (!this.botRefreshToken) {
      return {
        success: false,
        error: 'No refresh token available. Re-run: pnpm api setup'
      }
    }

    try {
      console.log('[TokenManager] Refreshing bot token...')

      const response = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: this.botRefreshToken,
          grant_type: 'refresh_token'
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[TokenManager] Token refresh failed:', response.status, errorText)

        if (response.status === 400) {
          return {
            success: false,
            error: 'Refresh token expired or invalid. Re-run: pnpm api setup'
          }
        }

        return {
          success: false,
          error: `Token refresh failed: ${response.status}`
        }
      }

      const rawData = await response.json()
      const parseResult = TwitchTokenResponseSchema.safeParse(rawData)

      if (!parseResult.success) {
        console.error('[TokenManager] Invalid token response:', parseResult.error)
        return {
          success: false,
          error: 'Invalid token response from Twitch'
        }
      }

      const tokenData = parseResult.data

      // Update instance tokens
      this.accessToken = tokenData.access_token
      this.botRefreshToken = tokenData.refresh_token

      // Persist to .env file
      this.updateEnvFile(tokenData.access_token, tokenData.refresh_token)

      // Notify listeners
      if (this.onTokenRefreshed) {
        this.onTokenRefreshed(tokenData.access_token)
      }

      console.log('[TokenManager] ✅ Bot token refreshed successfully')
      console.log(
        `[TokenManager] New token expires in: ${tokenData.expires_in}s (~${Math.floor(tokenData.expires_in / 86400)} days)`
      )

      return {
        success: true,
        newAccessToken: tokenData.access_token,
        newRefreshToken: tokenData.refresh_token
      }
    } catch (error) {
      console.error('[TokenManager] Token refresh error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Check token validity and refresh if needed (< 7 days remaining)
   */
  private async checkAndRefreshToken(): Promise<void> {
    const validation = await this.validateToken()

    if (!validation.isValid) {
      console.warn('[TokenManager] ⚠️  Bot token is invalid!')

      // Try to refresh
      const refreshResult = await this.refreshToken()
      if (!refreshResult.success) {
        console.error('[TokenManager] ❌ Token refresh failed:', refreshResult.error)
        console.error('[TokenManager] EventSub will fail until token is manually refreshed')
        console.error('[TokenManager] Run: pnpm api setup')
      }
      return
    }

    const expiresInHours = Math.floor(validation.expiresIn / 3600)
    const expiresInDays = Math.floor(validation.expiresIn / 86400)
    const timeUnit = expiresInDays > 0 ? `~${expiresInDays} days` : `~${expiresInHours} hours`
    console.log(
      `[TokenManager] Bot token valid. Expires in: ${validation.expiresIn}s (${timeUnit})`
    )

    // Refresh if less than 2 hours remaining (appropriate for 4-hour user access tokens)
    const REFRESH_THRESHOLD_SECONDS = 2 * 3600 // 2 hours
    if (validation.expiresIn < REFRESH_THRESHOLD_SECONDS) {
      console.log('[TokenManager] ⚠️  Token expires soon, refreshing...')

      const refreshResult = await this.refreshToken()
      if (!refreshResult.success) {
        console.error('[TokenManager] ❌ Token refresh failed:', refreshResult.error)
      }
    }
  }

  /**
   * Update .env file with new tokens
   */
  private updateEnvFile(accessToken: string, refreshToken: string): void {
    const envPath = resolveFromRoot('.env')

    if (!existsSync(envPath)) {
      console.error('[TokenManager] .env file not found')
      return
    }

    try {
      const envContent = readFileSync(envPath, 'utf-8')
      const lines = envContent.split('\n')

      // Update or add TWITCH_BOT_TOKEN
      let tokenLineIndex = -1
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]?.trim() ?? ''
        if (line.startsWith('TWITCH_BOT_TOKEN=') || line.startsWith('#TWITCH_BOT_TOKEN=')) {
          tokenLineIndex = i
          break
        }
      }

      if (tokenLineIndex !== -1) {
        lines[tokenLineIndex] = `TWITCH_BOT_TOKEN=${accessToken}`
      } else {
        lines.push(`TWITCH_BOT_TOKEN=${accessToken}`)
      }

      // Update or add TWITCH_BOT_REFRESH_TOKEN
      let refreshLineIndex = -1
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]?.trim() ?? ''
        if (
          line.startsWith('TWITCH_BOT_REFRESH_TOKEN=') ||
          line.startsWith('#TWITCH_BOT_REFRESH_TOKEN=')
        ) {
          refreshLineIndex = i
          break
        }
      }

      if (refreshLineIndex !== -1) {
        lines[refreshLineIndex] = `TWITCH_BOT_REFRESH_TOKEN=${refreshToken}`
      } else {
        // Add after TWITCH_BOT_TOKEN
        const insertIndex = tokenLineIndex !== -1 ? tokenLineIndex + 1 : lines.length
        lines.splice(insertIndex, 0, `TWITCH_BOT_REFRESH_TOKEN=${refreshToken}`)
      }

      writeFileSync(envPath, lines.join('\n'), 'utf-8')
      console.log('[TokenManager] Updated .env file with new tokens')
    } catch (error) {
      console.error('[TokenManager] Failed to update .env file:', error)
    }
  }
}
