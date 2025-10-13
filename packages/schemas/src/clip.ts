/**
 * Clip domain types
 * Shared across backend (schema.ts) and platform implementations
 */
import { z } from 'zod'

/**
 * Enumeration of clip platforms.
 */
export enum Platform {
  /**
   * Kick.com clips.
   */
  KICK = 'kick',
  /**
   * Twitch.tv clips.
   */
  TWITCH = 'twitch'
}

/**
 * A clip.
 */
export interface Clip {
  /**
   * The platform of the clip.
   */
  platform: Platform
  /**
   * The ID of the clip.
   */
  id: string
  /**
   * The URL of the clip.
   */
  url: string
  /**
   * The embed URL of the clip.
   */
  embedUrl: string
  /**
   * The direct video URL (optional).
   * - Twitch: undefined (fetched client-side on-demand)
   * - Kick: populated from API (URLs don't expire)
   */
  videoUrl?: string
  /**
   * The thumbnail URL of the clip.
   */
  thumbnailUrl: string
  /**
   * The title of the clip.
   */
  title: string
  /**
   * The channel of the clip.
   */
  channel: string
  /**
   * The creator of the clip.
   */
  creator: string
  /**
   * The submitters of the clip.
   */
  submitters: string[]
  /**
   * The category of the clip.
   */
  category?: string
  /**
   * The created at time of the clip.
   */
  createdAt?: string
}

/**
 * Zod schema for runtime validation of clips
 */
export const ClipSchema = z.object({
  platform: z.nativeEnum(Platform),
  id: z.string(),
  url: z.string().url(),
  embedUrl: z.string().url(),
  videoUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url(),
  title: z.string(),
  channel: z.string(),
  creator: z.string(),
  submitters: z.array(z.string()).default([]),
  category: z.string().optional(),
  createdAt: z.string().optional()
})
