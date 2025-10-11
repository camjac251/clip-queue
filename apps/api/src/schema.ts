/**
 * Drizzle ORM Schema and Zod Validation
 *
 * Defines database schema with type-safe queries and runtime validation.
 */

import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { ClipProvider, type Clip as ProviderClip } from '@cq/providers'

/**
 * Clips Table
 *
 * Normalized clip data with proper columns for efficient querying.
 */
export const clips = sqliteTable(
  'clips',
  {
    id: text('id').primaryKey(), // UUID format: "provider:clip_id"
    provider: text('provider', { enum: ['twitch', 'kick'] }).notNull(),
    clipId: text('clip_id').notNull(), // The actual clip ID from provider
    url: text('url').notNull(),
    embedUrl: text('embed_url').notNull(),
    thumbnailUrl: text('thumbnail_url').notNull(),
    title: text('title').notNull(),
    channel: text('channel').notNull(),
    creator: text('creator').notNull(),
    category: text('category'),
    createdAt: text('created_at'), // ISO date string from provider
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
    providerIdx: index('idx_clips_provider').on(table.provider),
    statusIdx: index('idx_clips_status').on(table.status),
    channelIdx: index('idx_clips_channel').on(table.channel),
    playedAtIdx: index('idx_clips_played_at').on(table.playedAt)
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

// Clip validation schema (matches @cq/providers types exactly)
export const ClipSchema = z.object({
  provider: z.nativeEnum(ClipProvider),
  id: z.string(),
  url: z.string().url(),
  embedUrl: z.string().url(),
  thumbnailUrl: z.string().url(),
  title: z.string(),
  channel: z.string(),
  creator: z.string(),
  submitters: z.array(z.string()).default([]),
  category: z.string().optional(),
  createdAt: z.string().optional() // ISO date string
})

// Use the Clip type from @cq/providers for type compatibility
export type Clip = ProviderClip

// Command settings validation
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
      'removebyprovider',
      'enableprovider',
      'disableprovider',
      'enableautomod',
      'disableautomod',
      'purgecache',
      'purgehistory'
    ])
  )
})

export type CommandSettings = z.infer<typeof CommandSettingsSchema>

// Queue settings validation
export const QueueSettingsSchema = z.object({
  hasAutoModerationEnabled: z.boolean(),
  limit: z.number().int().positive().nullable(),
  providers: z.array(z.enum(['twitch', 'kick']))
})

export type QueueSettings = z.infer<typeof QueueSettingsSchema>

// Logger settings validation
export const LoggerSettingsSchema = z.object({
  level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']),
  limit: z.number().int().positive()
})

export type LoggerSettings = z.infer<typeof LoggerSettingsSchema>

// App settings validation (composite)
export const AppSettingsSchema = z.object({
  commands: CommandSettingsSchema,
  queue: QueueSettingsSchema,
  logger: LoggerSettingsSchema
})

export type AppSettings = z.infer<typeof AppSettingsSchema>

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
      'removebyprovider',
      'enableprovider',
      'disableprovider',
      'enableautomod',
      'disableautomod',
      'purgecache',
      'purgehistory'
    ]
  },
  queue: {
    hasAutoModerationEnabled: true,
    limit: null,
    providers: ['twitch', 'kick']
  },
  logger: {
    level: 'WARN',
    limit: 100
  }
}

// Validate defaults at module load
AppSettingsSchema.parse(DEFAULT_SETTINGS)
