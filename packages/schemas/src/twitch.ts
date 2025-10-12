/**
 * Twitch API Response Schemas
 * Validation schemas for Twitch API responses
 */
import { z } from 'zod'

/**
 * Twitch OAuth Token Response
 */
export const TwitchTokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  scope: z.array(z.string()).optional(),
  token_type: z.string(),
  id_token: z.string().optional()
})

export type TwitchTokenResponse = z.infer<typeof TwitchTokenResponseSchema>

/**
 * Twitch Token Validation Response
 */
export const TwitchValidateResponseSchema = z.object({
  user_id: z.string(),
  login: z.string(),
  client_id: z.string(),
  scopes: z.array(z.string()).optional(),
  expires_in: z.number()
})

export type TwitchValidateResponse = z.infer<typeof TwitchValidateResponseSchema>

/**
 * Twitch Users API Response
 */
export const TwitchUsersResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      login: z.string(),
      display_name: z.string().optional()
    })
  )
})

export type TwitchUsersResponse = z.infer<typeof TwitchUsersResponseSchema>

/**
 * Twitch Moderators API Response
 */
export const TwitchModeratorsResponseSchema = z.object({
  data: z.array(
    z.object({
      user_id: z.string(),
      user_login: z.string(),
      user_name: z.string().optional()
    })
  )
})

export type TwitchModeratorsResponse = z.infer<typeof TwitchModeratorsResponseSchema>
