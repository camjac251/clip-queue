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
   * Sora.com videos (OpenAI).
   */
  SORA = 'sora',
  /**
   * Streamable.com videos.
   */
  STREAMABLE = 'streamable',
  /**
   * Twitch.tv clips.
   */
  TWITCH = 'twitch'
}

/**
 * Enumeration of content types.
 */
export enum ContentType {
  /**
   * Short clips (15-60s highlights).
   */
  CLIP = 'clip',
  /**
   * Full VODs (complete stream recordings).
   */
  VOD = 'vod',
  /**
   * Highlights (user-curated segments from VODs).
   */
  HIGHLIGHT = 'highlight',
  /**
   * Sora videos with cameos (persona appearances).
   */
  CAMEO = 'cameo',
  /**
   * Generic video content (e.g., Streamable).
   */
  VIDEO = 'video'
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
   * The content type of the clip.
   */
  contentType: ContentType
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
   * The thumbnail URL of the clip (optional).
   */
  thumbnailUrl?: string
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
  /**
   * Duration in seconds (for VODs and highlights).
   */
  duration?: number
  /**
   * Start time in seconds (from URL timestamp parameter like ?t=0h12m0s).
   */
  timestamp?: number
  /**
   * Cameo usernames (Sora only, lowercase for case-insensitive matching).
   */
  cameos?: string[]
}

/**
 * Zod schema for runtime validation of clips
 */
export const ClipSchema = z.object({
  platform: z.nativeEnum(Platform),
  contentType: z.nativeEnum(ContentType),
  id: z.string(),
  url: z.string().url(),
  embedUrl: z.string().url(),
  videoUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  title: z.string(),
  channel: z.string(),
  creator: z.string(),
  submitters: z.array(z.string()).default([]),
  category: z.string().optional(),
  createdAt: z.string().optional(),
  duration: z.number().int().positive().optional(),
  timestamp: z.number().int().nonnegative().optional(),
  cameos: z.array(z.string()).optional()
})
