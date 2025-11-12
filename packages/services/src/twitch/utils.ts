import { ContentType } from '@cq/schemas/clip'
import { extractIdFromPath } from '@cq/utils'

const CLIP_HOSTNAMES = ['clips.twitch.tv']
const TWITCH_HOSTNAME = 'twitch.tv'
const CLIP_SUFFIX = '/clip/'
const VIDEO_PREFIX = '/videos/'

/**
 * Check if a URL is a Twitch clip URL.
 * @param url - The URL to check.
 * @returns True if the URL is a Twitch clip URL.
 */
function isClipUrl(url: string): boolean {
  try {
    const uri = new URL(url)
    if (CLIP_HOSTNAMES.includes(uri.hostname)) {
      return true
    }
    if (uri.hostname.endsWith(TWITCH_HOSTNAME)) {
      if (uri.pathname.includes(CLIP_SUFFIX)) {
        return true
      }
    }
    return false
  } catch {
    return false
  }
}

/**
 * Get a clip ID from a Twitch clip URL.
 * @param url - The Twitch clip URL.
 * @returns The clip ID or undefined if the URL is invalid.
 */
export function getClipIdFromUrl(url: string): string | undefined {
  if (!isClipUrl(url)) {
    return
  }
  try {
    const uri = new URL(url)
    return extractIdFromPath(uri.pathname)
  } catch {
    return
  }
}

/**
 * Convert a key and values to URLSearchParams.
 * @param key - The key to use in the URLSearchParams.
 * @param values - The values to append to the URLSearchParams.
 * @returns The URLSearchParams.
 */
export function toURLParams(key: string, values: string[]): URLSearchParams {
  const params = new URLSearchParams()
  values.forEach((v) => params.append(key, v))
  return params
}

/**
 * Get content type from a Twitch URL.
 * @param url - The Twitch URL.
 * @returns The content type or undefined if invalid.
 */
export function getContentTypeFromUrl(url: string): ContentType | undefined {
  try {
    const uri = new URL(url)

    // Check for clips
    if (CLIP_HOSTNAMES.includes(uri.hostname) || uri.pathname.includes(CLIP_SUFFIX)) {
      return ContentType.CLIP
    }

    // Check for VODs/highlights
    if (uri.pathname.startsWith(VIDEO_PREFIX)) {
      const isHighlight = uri.searchParams.get('filter') === 'highlights'
      return isHighlight ? ContentType.HIGHLIGHT : ContentType.VOD
    }

    return undefined
  } catch {
    return undefined
  }
}

/**
 * Get video ID from a Twitch VOD/highlight URL.
 * @param url - The Twitch video URL.
 * @returns The video ID or undefined if invalid.
 */
export function getVideoIdFromUrl(url: string): string | undefined {
  try {
    const uri = new URL(url)
    if (uri.pathname.startsWith(VIDEO_PREFIX)) {
      const match = uri.pathname.match(/\/videos\/(\d+)/)
      return match?.[1]
    }
    return undefined
  } catch {
    return undefined
  }
}

/**
 * Parse Twitch duration string to seconds.
 * @param duration - Duration string (e.g., "1h23m45s", "45m30s", "2h15s", "30s").
 * @returns Duration in seconds.
 */
export function parseDuration(duration: string): number {
  let seconds = 0
  const hoursMatch = duration.match(/(\d+)h/)
  const minutesMatch = duration.match(/(\d+)m/)
  const secondsMatch = duration.match(/(\d+)s/)

  if (hoursMatch?.[1]) seconds += parseInt(hoursMatch[1], 10) * 3600
  if (minutesMatch?.[1]) seconds += parseInt(minutesMatch[1], 10) * 60
  if (secondsMatch?.[1]) seconds += parseInt(secondsMatch[1], 10)

  return seconds
}

/**
 * Get timestamp from a Twitch video URL query parameter.
 * @param url - The Twitch video URL (e.g., "https://www.twitch.tv/videos/123?t=0h12m0s").
 * @returns Timestamp in seconds, or undefined if not present.
 */
export function getTimestampFromUrl(url: string): number | undefined {
  try {
    const uri = new URL(url)
    const timestampParam = uri.searchParams.get('t')
    if (!timestampParam) {
      return undefined
    }
    return parseDuration(timestampParam)
  } catch {
    return undefined
  }
}

export default {
  getClipIdFromUrl,
  getContentTypeFromUrl,
  getVideoIdFromUrl,
  parseDuration,
  getTimestampFromUrl
}
