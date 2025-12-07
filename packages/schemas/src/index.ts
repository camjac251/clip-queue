/**
 * Shared Schemas Package
 * Centralized Zod schemas for consistent validation across backend and frontend
 */

// Settings
export {
  CommandSettingsSchema,
  QueueSettingsSchema,
  LoggerSettingsSchema,
  AppSettingsSchema,
  SoraSettingsSchema,
  PROVIDERS,
  ProviderSchema,
  type CommandSettings,
  type QueueSettings,
  type LoggerSettings,
  type AppSettings,
  type SoraSettings,
  type Provider
} from './settings.js'

// Auth
export { UserRoleSchema, type UserRole, type AuthenticatedUser } from './auth.js'

// Twitch
export {
  TwitchTokenResponseSchema,
  TwitchValidateResponseSchema,
  TwitchUsersResponseSchema,
  TwitchModeratorsResponseSchema,
  type TwitchTokenResponse,
  type TwitchValidateResponse,
  type TwitchUsersResponse,
  type TwitchModeratorsResponse
} from './twitch.js'

// Clip
export { Platform, ClipSchema, type Clip } from './clip.js'
