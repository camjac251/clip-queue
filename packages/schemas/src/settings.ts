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
 * Queue Settings Schema
 * Controls queue behavior and platform filtering
 */
export const QueueSettingsSchema = z.object({
  hasAutoModerationEnabled: z.boolean(),
  limit: z.number().int().positive().nullable(),
  platforms: z.array(z.enum(['twitch', 'kick']))
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
