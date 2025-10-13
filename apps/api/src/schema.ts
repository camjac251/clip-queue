/**
 * Drizzle ORM Schema and Zod Validation
 *
 * Defines database schema with type-safe queries and runtime validation.
 *
 * IMPORTANT: This file imports clip types from @cq/schemas (not @cq/platforms)
 * to avoid transitive ESM dependencies that break drizzle-kit's CommonJS loader.
 */

import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  CommandSettingsSchema,
  QueueSettingsSchema,
  LoggerSettingsSchema,
  AppSettingsSchema,
  type CommandSettings,
  type QueueSettings,
  type LoggerSettings,
  type AppSettings
} from '@cq/schemas/settings'
import { Platform, type Clip } from '@cq/schemas/clip'

export type {
  CommandSettings,
  QueueSettings,
  LoggerSettings,
  AppSettings
} from '@cq/schemas/settings'
export {
  CommandSettingsSchema,
  QueueSettingsSchema,
  LoggerSettingsSchema,
  AppSettingsSchema
}

// Re-export clip types for convenience
export { Platform, type Clip }

/**
 * Clips Table
 *
 * Normalized clip data with proper columns for efficient querying.
 */
export const clips = sqliteTable(
  'clips',
  {
    id: text('id').primaryKey(), // UUID format: "platform:clip_id"
    platform: text('platform', { enum: ['twitch', 'kick'] }).notNull(),
    clipId: text('clip_id').notNull(), // The actual clip ID from platform
    url: text('url').notNull(),
    embedUrl: text('embed_url').notNull(),
    videoUrl: text('video_url'), // Direct video URL (Kick only - Twitch fetches client-side)
    thumbnailUrl: text('thumbnail_url').notNull(),
    title: text('title').notNull(),
    channel: text('channel').notNull(),
    creator: text('creator').notNull(),
    category: text('category'),
    createdAt: text('created_at'), // ISO date string from platform
    status: text('status', {
      enum: ['approved', 'pending', 'rejected', 'played']
    })
      .notNull()
      .default('approved'),
    submittedAt: integer('submitted_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    playedAt: integer('played_at', { mode: 'timestamp' })
  },
  (table) => ({
    platformIdx: index('idx_clips_platform').on(table.platform),
    statusIdx: index('idx_clips_status').on(table.status),
    channelIdx: index('idx_clips_channel').on(table.channel),
    playedAtIdx: index('idx_clips_played_at').on(table.playedAt),
    statusSubmittedIdx: index('idx_clips_status_submitted').on(table.status, table.submittedAt)
  })
)

/**
 * Clip Submitters Table (many-to-many)
 *
 * Tracks who submitted each clip (allows multiple submitters per clip).
 */
export const clipSubmitters = sqliteTable(
  'clip_submitters',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    clipId: text('clip_id')
      .notNull()
      .references(() => clips.id, { onDelete: 'cascade' }),
    submitter: text('submitter').notNull(),
    submittedAt: integer('submitted_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`)
  },
  (table) => ({
    clipIdIdx: index('idx_submitters_clip_id').on(table.clipId),
    uniqueSubmission: uniqueIndex('unique_clip_submitter').on(table.clipId, table.submitter)
  })
)

/**
 * Settings Table
 *
 * Single-row table for application settings.
 */
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey().notNull().default(1),
  version: integer('version').notNull().default(1), // Schema version for migrations
  commands: text('commands', { mode: 'json' }).notNull(), // JSON: CommandSettings
  queue: text('queue', { mode: 'json' }).notNull(), // JSON: QueueSettings
  logger: text('logger', { mode: 'json' }).notNull(), // JSON: LoggerSettings
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
})

/**
 * Zod Validation Schemas
 */

// Clip validation schema (matches @cq/platforms types exactly)
export const ClipSchema = z.object({
  platform: z.nativeEnum(Platform),
  id: z.string(),
  url: z.string().url(),
  embedUrl: z.string().url(),
  videoUrl: z.string().url().optional(), // Direct video URL (Kick only - Twitch fetches client-side)
  thumbnailUrl: z.string().url(),
  title: z.string(),
  channel: z.string(),
  creator: z.string(),
  submitters: z.array(z.string()).default([]),
  category: z.string().optional(),
  createdAt: z.string().optional() // ISO date string
})

/**
 * Default Settings (validated)
 */
export const DEFAULT_SETTINGS: AppSettings = {
  commands: {
    prefix: '!cq',
    allowed: [
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
    ]
  },
  queue: {
    hasAutoModerationEnabled: true,
    limit: null,
    platforms: ['twitch', 'kick']
  },
  logger: {
    level: 'WARN',
    limit: 100
  }
}

// Validate defaults at module load
AppSettingsSchema.parse(DEFAULT_SETTINGS)
