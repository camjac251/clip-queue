/**
 * Drizzle ORM Schema and Zod Validation
 *
 * Defines database schema with type-safe queries and runtime validation.
 *
 * IMPORTANT: This file imports clip types from @cq/schemas (not @cq/platforms)
 * to avoid transitive ESM dependencies that break drizzle-kit's CommonJS loader.
 */

import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import type { Clip } from '@cq/schemas/clip'
import type { AppSettings } from '@cq/schemas/settings'
import { ClipSchema, ContentType, Platform } from '@cq/schemas/clip'
import {
  AppSettingsSchema,
  CommandSettingsSchema,
  LoggerSettingsSchema,
  PROVIDERS,
  QueueSettingsSchema
} from '@cq/schemas/settings'

export type {
  CommandSettings,
  Provider,
  QueueSettings,
  LoggerSettings,
  AppSettings
} from '@cq/schemas/settings'
export {
  CommandSettingsSchema,
  PROVIDERS,
  QueueSettingsSchema,
  LoggerSettingsSchema,
  AppSettingsSchema
}

// Re-export clip types for convenience
export { Platform, ContentType, type Clip }

/**
 * Clips Table
 *
 * Normalized clip data with proper columns for efficient querying.
 */
export const clips = sqliteTable(
  'clips',
  {
    id: text('id').primaryKey(), // UUID format: "platform:contentType:clip_id"
    platform: text('platform', { enum: ['twitch', 'kick', 'sora'] }).notNull(),
    contentType: text('content_type', { enum: ['clip', 'vod', 'highlight'] })
      .notNull()
      .default('clip'),
    clipId: text('clip_id').notNull(), // The actual clip ID from platform
    url: text('url').notNull(),
    embedUrl: text('embed_url').notNull(),
    videoUrl: text('video_url'), // Direct video URL (Kick, Sora - Twitch content fetches client-side)
    thumbnailUrl: text('thumbnail_url'),
    title: text('title').notNull(),
    channel: text('channel').notNull(),
    creator: text('creator').notNull(),
    category: text('category'),
    createdAt: text('created_at'), // ISO date string from platform
    duration: integer('duration'), // Duration in seconds (for VODs/highlights)
    timestamp: integer('timestamp'), // Start time in seconds (from URL ?t= parameter)
    status: text('status', {
      enum: ['approved', 'pending', 'rejected', 'played']
    })
      .notNull()
      .default('approved'),
    submittedAt: integer('submitted_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`)
  },
  (table) => ({
    platformIdx: index('idx_clips_platform').on(table.platform),
    statusIdx: index('idx_clips_status').on(table.status),
    channelIdx: index('idx_clips_channel').on(table.channel),
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
 * Play Log Table
 *
 * Tracks every play event (allows replays, analytics, watch time tracking).
 * Each row represents a single play event with timestamps.
 */
export const playLog = sqliteTable(
  'play_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    clipId: text('clip_id')
      .notNull()
      .references(() => clips.id, { onDelete: 'cascade' }),
    playedAt: integer('played_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    playedFor: integer('played_for'), // Duration watched in seconds (optional)
    completedAt: integer('completed_at', { mode: 'timestamp' }) // When playback ended (optional)
  },
  (table) => ({
    clipIdIdx: index('idx_play_log_clip_id').on(table.clipId),
    playedAtIdx: index('idx_play_log_played_at').on(table.playedAt)
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
 * Re-export ClipSchema from @cq/schemas for validation
 */
export { ClipSchema }

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
    providers: ['twitch:clip', 'twitch:vod', 'twitch:highlight', 'kick:clip', 'sora:clip']
  },
  logger: {
    level: 'WARN',
    limit: 100
  }
}

// Validate defaults at module load
AppSettingsSchema.parse(DEFAULT_SETTINGS)
