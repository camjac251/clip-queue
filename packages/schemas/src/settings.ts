/**
 * Shared Settings Schemas
 * Used by both backend and frontend to ensure consistent validation
 */
import { z } from 'zod'

/**
 * Command Settings Schema
 * Controls chat command prefix and allowed commands
 */
export const CommandSettingsSchema = z.object({
  prefix: z.string().min(1),
  allowed: z.array(
    z.enum([
      'open',
      'close',
      'clear',
      'setlimit',
      'removelimit',
      'prev',
      'next',
      'removebysubmitter',
      'removebyplatform',
      'enableplatform',
      'disableplatform',
      'enableautomod',
      'disableautomod',
      'purgecache',
      'purgehistory'
    ])
  )
})

export type CommandSettings = z.infer<typeof CommandSettingsSchema>

/**
 * Valid provider identifiers (platform:contentType combinations)
 * Each provider represents a specific type of content from a specific platform.
 *
 * Sora providers:
 * - sora:clip = Sora videos without cameos (persona appearances)
 * - sora:cameo = Sora videos with cameos (can filter by specific usernames)
 */
export const PROVIDERS = [
  'twitch:clip',
  'twitch:vod',
  'twitch:highlight',
  'kick:clip',
  'sora:clip',
  'sora:cameo'
] as const

export type Provider = (typeof PROVIDERS)[number]

export const ProviderSchema = z.enum(PROVIDERS)

/**
 * Sora-specific Settings Schema
 * Controls Sora cameo content filtering
 */
export const SoraSettingsSchema = z.object({
  /**
   * Allowed cameo usernames (case-insensitive, stored lowercase).
   * Only applies when sora:cameo provider is enabled.
   * Empty array = allow all cameos.
   */
  allowedCameos: z.array(z.string().min(1)).default([])
})

export type SoraSettings = z.infer<typeof SoraSettingsSchema>

/**
 * Queue Settings Schema
 * Controls queue behavior and platform filtering
 */
export const QueueSettingsSchema = z.object({
  hasAutoModerationEnabled: z.boolean(),
  limit: z.number().int().positive().nullable(),
  providers: z.array(ProviderSchema).default([...PROVIDERS]),
  /** Sora-specific filtering settings (cameo username allowlist) */
  sora: SoraSettingsSchema.default({ allowedCameos: [] })
})

export type QueueSettings = z.infer<typeof QueueSettingsSchema>

/**
 * Logger Settings Schema
 * Controls logging level and message limit
 */
export const LoggerSettingsSchema = z.object({
  level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']),
  limit: z.number().int().positive()
})

export type LoggerSettings = z.infer<typeof LoggerSettingsSchema>

/**
 * App Settings Schema
 * Top-level settings container
 */
export const AppSettingsSchema = z.object({
  commands: CommandSettingsSchema,
  queue: QueueSettingsSchema,
  logger: LoggerSettingsSchema
})

export type AppSettings = z.infer<typeof AppSettingsSchema>
