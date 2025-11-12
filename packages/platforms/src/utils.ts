import { ContentType } from '@cq/schemas/clip'

import type { Clip } from './types'

/**
 * Get a UUID for the provided clip.
 * Format: "platform:contentType:id" or "platform:contentType:id:timestamp"
 *
 * @param clip - A clip.
 * @returns UUID of the clip.
 *
 * @example
 * toClipUUID({ platform: Platform.TWITCH, contentType: ContentType.CLIP, id: 'abc123', ... })
 * // Returns: "twitch:clip:abc123"
 *
 * @example
 * toClipUUID({ platform: Platform.TWITCH, contentType: ContentType.VOD, id: '12345', timestamp: 630, ... })
 * // Returns: "twitch:vod:12345:630"
 */
export function toClipUUID(clip: Clip): string {
  const base = `${clip.platform.toString().toLowerCase()}:${clip.contentType.toLowerCase()}:${clip.id.toLowerCase()}`

  // For VODs and Highlights, timestamp is semantically significant (e.g., ?t=10m30s)
  // Include it in UUID to differentiate submissions with different start times
  if (
    (clip.contentType === ContentType.VOD || clip.contentType === ContentType.HIGHLIGHT) &&
    clip.timestamp !== undefined &&
    clip.timestamp > 0
  ) {
    return `${base}:${clip.timestamp}`
  }

  return base
}
