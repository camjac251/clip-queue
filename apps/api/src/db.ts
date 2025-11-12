/**
 * Database Layer - Drizzle ORM
 *
 * Type-safe database operations with transactions and validation.
 */

import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

import Database from 'better-sqlite3'
import { asc, desc, eq, inArray } from 'drizzle-orm'
import { BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

import type { AppSettings, Clip } from './schema.js'
import { resolveFromRoot } from './paths.js'
import {
  AppSettingsSchema,
  clips,
  ClipSchema,
  clipSubmitters,
  DEFAULT_SETTINGS,
  playLog,
  settings
} from './schema.js'

export type DbClient = BetterSQLite3Database<{
  clips: typeof clips
  clipSubmitters: typeof clipSubmitters
  playLog: typeof playLog
  settings: typeof settings
}>

let dbInstance: DbClient | null = null

/**
 * Initialize database with migrations and WAL mode
 */
export function initDatabase(dbPath?: string): DbClient {
  if (dbInstance) return dbInstance

  const path = dbPath || resolveFromRoot('apps', 'api', 'data', 'clips.db')

  // Ensure directory exists
  const dir = dirname(path)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  // Create SQLite connection
  const sqlite = new Database(path)

  // Enable WAL mode for better concurrency
  sqlite.pragma('journal_mode = WAL')

  // Create Drizzle client
  dbInstance = drizzle(sqlite, {
    schema: { clips, clipSubmitters, playLog, settings }
  })

  // Run migrations
  try {
    migrate(dbInstance, { migrationsFolder: resolveFromRoot('apps', 'api', 'drizzle') })
    console.log('[Database] Migrations applied successfully')
  } catch (error) {
    console.error('[Database] Migration failed:', error)
    throw error
  }

  console.log('[Database] Initialized SQLite database at:', path)
  return dbInstance
}

/**
 * Get database instance (must call initDatabase first)
 */
export function getDb(): DbClient {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return dbInstance
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (dbInstance) {
    try {
      // Get underlying SQLite instance and close it
      // @ts-expect-error - accessing internal property
      const sqlite = dbInstance._.session?.db as Database.Database | undefined
      if (sqlite) {
        sqlite.close()
        console.log('[Database] Connection closed')
      }
    } catch (error) {
      console.error('[Database] Error closing connection:', error)
    } finally {
      dbInstance = null
    }
  }
}

/**
 * Settings Operations
 */

/**
 * Initialize settings with defaults if not exists
 */
export function initSettings(db: DbClient): AppSettings {
  const existing = db.select().from(settings).where(eq(settings.id, 1)).get()

  if (existing) {
    // Validate existing settings
    try {
      const validated: AppSettings = {
        commands: AppSettingsSchema.shape.commands.parse(existing.commands),
        queue: AppSettingsSchema.shape.queue.parse(existing.queue),
        logger: AppSettingsSchema.shape.logger.parse(existing.logger)
      }
      return validated
    } catch (error) {
      console.error('[Database] Invalid settings in database, using defaults:', error)
      // Fall through to reset with defaults
    }
  }

  // Insert defaults
  db.insert(settings)
    .values({
      id: 1,
      version: 1,
      commands: DEFAULT_SETTINGS.commands as unknown,
      queue: DEFAULT_SETTINGS.queue as unknown,
      logger: DEFAULT_SETTINGS.logger as unknown
    })
    .run()

  console.log('[Database] Initialized default settings')
  return DEFAULT_SETTINGS
}

/**
 * Update settings (with validation)
 */
export function updateSettings(db: DbClient, newSettings: AppSettings): void {
  // Validate before updating
  const validated = AppSettingsSchema.parse(newSettings)

  db.update(settings)
    .set({
      commands: validated.commands as unknown,
      queue: validated.queue as unknown,
      logger: validated.logger as unknown,
      updatedAt: new Date()
    })
    .where(eq(settings.id, 1))
    .run()
}

/**
 * Get current settings (with validation)
 */
export function getSettings(db: DbClient): AppSettings {
  const row = db.select().from(settings).where(eq(settings.id, 1)).get()

  if (!row) {
    return initSettings(db)
  }

  try {
    return {
      commands: AppSettingsSchema.shape.commands.parse(row.commands),
      queue: AppSettingsSchema.shape.queue.parse(row.queue),
      logger: AppSettingsSchema.shape.logger.parse(row.logger)
    }
  } catch (error) {
    console.error('[Database] Invalid settings, reinitializing:', error)
    return initSettings(db)
  }
}

/**
 * Clip Operations
 */

/**
 * Add or update clip (with submitter merge logic)
 * Uses transaction to prevent race conditions
 */
export function upsertClip(
  db: DbClient,
  clipId: string,
  clipData: Clip,
  status: 'approved' | 'pending' | 'rejected' | 'played' = 'approved'
): Clip {
  return db.transaction((tx) => {
    // Validate clip data
    const validated = ClipSchema.parse(clipData)

    // Check if clip exists
    const existing = tx.select().from(clips).where(eq(clips.id, clipId)).get()

    if (existing) {
      // Update clip metadata (in case it changed)
      tx.update(clips)
        .set({
          contentType: validated.contentType,
          title: validated.title,
          thumbnailUrl: validated.thumbnailUrl,
          videoUrl: validated.videoUrl,
          category: validated.category,
          duration: validated.duration,
          timestamp: validated.timestamp
        })
        .where(eq(clips.id, clipId))
        .run()

      // Add new submitters (unique constraint prevents duplicates)
      for (const submitter of validated.submitters) {
        try {
          tx.insert(clipSubmitters)
            .values({
              clipId,
              submitter
            })
            .run()
        } catch (error) {
          // Only ignore duplicate constraint violations (SQLITE_CONSTRAINT)
          if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
            // Submitter already exists for this clip, skip
            continue
          }
          // Re-throw other errors
          throw error
        }
      }

      // Fetch all submitters
      const allSubmitters = tx
        .select({ submitter: clipSubmitters.submitter })
        .from(clipSubmitters)
        .where(eq(clipSubmitters.clipId, clipId))
        .all()

      return {
        ...validated,
        submitters: allSubmitters.map((s) => s.submitter)
      }
    } else {
      // Insert new clip
      tx.insert(clips)
        .values({
          id: clipId,
          platform: validated.platform,
          contentType: validated.contentType,
          clipId: validated.id,
          url: validated.url,
          embedUrl: validated.embedUrl,
          videoUrl: validated.videoUrl,
          thumbnailUrl: validated.thumbnailUrl,
          title: validated.title,
          channel: validated.channel,
          creator: validated.creator,
          category: validated.category,
          createdAt: validated.createdAt,
          duration: validated.duration,
          timestamp: validated.timestamp,
          status
        })
        .run()

      // Insert submitters
      for (const submitter of validated.submitters) {
        tx.insert(clipSubmitters)
          .values({
            clipId,
            submitter
          })
          .run()
      }

      return validated
    }
  })
}

/**
 * Get clip by ID (with submitters)
 */
export function getClip(db: DbClient, clipId: string): Clip | null {
  const row = db.select().from(clips).where(eq(clips.id, clipId)).get()

  if (!row) return null

  // Fetch submitters
  const submitterRows = db
    .select({ submitter: clipSubmitters.submitter })
    .from(clipSubmitters)
    .where(eq(clipSubmitters.clipId, clipId))
    .all()

  try {
    return ClipSchema.parse({
      platform: row.platform,
      contentType: row.contentType || 'clip', // Fallback to 'clip' for old data
      id: row.clipId,
      url: row.url,
      embedUrl: row.embedUrl,
      videoUrl: row.videoUrl ?? undefined,
      thumbnailUrl: row.thumbnailUrl,
      title: row.title,
      channel: row.channel,
      creator: row.creator ?? row.channel, // Fallback to channel if creator is missing
      category: row.category || undefined, // Convert empty string to undefined
      createdAt: row.createdAt ?? undefined,
      duration: row.duration ?? undefined,
      timestamp: row.timestamp ?? undefined,
      submitters: submitterRows.map((s) => s.submitter)
    })
  } catch (error) {
    console.error(`[Database] Invalid clip data for ${clipId}:`, error)
    return null
  }
}

/**
 * Get clips by status (with submitters)
 * Optimized to avoid N+1 queries
 */
export function getClipsByStatus(
  db: DbClient,
  status: 'approved' | 'pending' | 'rejected' | 'played',
  limit?: number
): Clip[] {
  let query = db.select().from(clips).where(eq(clips.status, status))

  if (status === 'approved') {
    query = query.orderBy(asc(clips.submittedAt)) as unknown as typeof query
  } else if (status === 'played') {
    query = query.orderBy(desc(clips.submittedAt)).limit(limit ?? 50) as unknown as typeof query
  }

  const rows = query.all()

  if (rows.length === 0) return []

  // Fetch all submitters in one query (avoid N+1)
  const clipIds = rows.map((r) => r.id)
  const allSubmitters = db
    .select()
    .from(clipSubmitters)
    .where(inArray(clipSubmitters.clipId, clipIds))
    .all()

  // Group submitters by clipId
  const submittersByClip = new Map<string, string[]>()
  for (const sub of allSubmitters) {
    const existing = submittersByClip.get(sub.clipId) || []
    existing.push(sub.submitter)
    submittersByClip.set(sub.clipId, existing)
  }

  return rows
    .map((row) => {
      try {
        return ClipSchema.parse({
          platform: row.platform,
          contentType: row.contentType || 'clip', // Fallback to 'clip' for old data
          id: row.clipId,
          url: row.url,
          embedUrl: row.embedUrl,
          videoUrl: row.videoUrl ?? undefined,
          thumbnailUrl: row.thumbnailUrl,
          title: row.title,
          channel: row.channel,
          creator: row.creator ?? row.channel, // Fallback to channel if creator is missing
          category: row.category || undefined, // Convert empty string to undefined
          createdAt: row.createdAt ?? undefined,
          duration: row.duration ?? undefined,
          timestamp: row.timestamp ?? undefined,
          submitters: submittersByClip.get(row.id) || []
        })
      } catch (error) {
        console.error(`[Database] Invalid clip data for ${row.id}:`, error)
        return null
      }
    })
    .filter((clip): clip is Clip => clip !== null)
}

/**
 * Update clip status
 */
export function updateClipStatus(
  db: DbClient,
  clipId: string,
  status: 'approved' | 'pending' | 'rejected' | 'played'
): void {
  try {
    db.update(clips).set({ status }).where(eq(clips.id, clipId)).run()
  } catch (error) {
    console.error(`[DB] Failed to update clip status: ${error}`)
    throw error
  }
}

/**
 * Delete clips by status
 */
export function deleteClipsByStatus(
  db: DbClient,
  status: 'approved' | 'pending' | 'rejected' | 'played'
): void {
  try {
    db.delete(clips).where(eq(clips.status, status)).run()
  } catch (error) {
    console.error(`[DB] Failed to delete clips by status: ${error}`)
    throw error
  }
}

/**
 * Delete clip by ID
 */
export function deleteClip(db: DbClient, clipId: string): void {
  try {
    db.delete(clips).where(eq(clips.id, clipId)).run()
  } catch (error) {
    console.error(`[DB] Failed to delete clip: ${error}`)
    throw error
  }
}

/**
 * Play Log Operations
 */

/**
 * Insert a play log entry
 * @returns The ID of the inserted play log entry
 */
export function insertPlayLog(db: DbClient, clipId: string, playedAt?: Date): number {
  try {
    const result = db
      .insert(playLog)
      .values({
        clipId,
        playedAt: playedAt ?? new Date()
      })
      .run()

    return Number(result.lastInsertRowid)
  } catch (error) {
    console.error(`[DB] Failed to insert play log: ${error}`)
    throw error
  }
}

/**
 * Get all play log entries (with clips) ordered by playedAt
 * @param limit - Maximum number of entries to return (default: 50)
 */
export function getPlayLogs(
  db: DbClient,
  limit: number = 50
): Array<{
  id: number
  clip: Clip
  playedAt: Date
  playedFor?: number
  completedAt?: Date
}> {
  try {
    const rows = db
      .select({
        id: playLog.id,
        clipId: playLog.clipId,
        playedAt: playLog.playedAt,
        playedFor: playLog.playedFor,
        completedAt: playLog.completedAt
      })
      .from(playLog)
      .orderBy(asc(playLog.playedAt))
      .limit(limit)
      .all()

    // Fetch clips for each play log entry
    return rows.map((row) => {
      const clip = getClip(db, row.clipId)
      if (!clip) {
        throw new Error(`Clip not found for play log entry: ${row.clipId}`)
      }
      return {
        id: row.id,
        clip,
        playedAt: new Date(row.playedAt),
        playedFor: row.playedFor ?? undefined,
        completedAt: row.completedAt ? new Date(row.completedAt) : undefined
      }
    })
  } catch (error) {
    console.error(`[DB] Failed to get play logs: ${error}`)
    throw error
  }
}

/**
 * Delete all play log entries for clips with specified status
 */
export function deletePlayLogsByClipStatus(db: DbClient, status: 'played'): void {
  try {
    // Get all clip IDs with the specified status
    const clipIds = db
      .select({ id: clips.id })
      .from(clips)
      .where(eq(clips.status, status))
      .all()
      .map((row) => row.id)

    if (clipIds.length === 0) return

    // Delete play log entries for those clips
    db.delete(playLog).where(inArray(playLog.clipId, clipIds)).run()
  } catch (error) {
    console.error(`[DB] Failed to delete play logs by clip status: ${error}`)
    throw error
  }
}

/**
 * Delete all play log entries
 */
export function deleteAllPlayLogs(db: DbClient): void {
  try {
    db.delete(playLog).run()
  } catch (error) {
    console.error(`[DB] Failed to delete all play logs: ${error}`)
    throw error
  }
}

/**
 * Re-export types and schemas
 */
export {
  clips,
  clipSubmitters,
  playLog,
  settings,
  type Clip,
  type AppSettings,
  ClipSchema,
  AppSettingsSchema,
  DEFAULT_SETTINGS
}
