import type { StreamableVideo } from './types'

export * from './types'

/**
 * Streamable logo SVG as a string.
 * Infinity-like interlocked loops symbol.
 */
export const logo = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <title>Streamable</title>
    <path d="M7.5 6C4.46 6 2 8.46 2 11.5S4.46 17 7.5 17c1.52 0 2.9-.62 3.9-1.62L12 14.78l.6.6c1 1 2.38 1.62 3.9 1.62 3.04 0 5.5-2.46 5.5-5.5S19.54 6 16.5 6c-1.52 0-2.9-.62-3.9 1.62L12 8.22l-.6-.6C10.4 6.62 9.02 6 7.5 6zm0 2.5c.66 0 1.26.27 1.7.7L12 12l2.8-2.8c.44-.43 1.04-.7 1.7-.7 1.38 0 2.5 1.12 2.5 2.5s-1.12 2.5-2.5 2.5c-.66 0-1.26-.27-1.7-.7L12 10l-2.8 2.8c-.44.43-1.04.7-1.7.7-1.38 0-2.5-1.12-2.5-2.5S6.12 8.5 7.5 8.5z"/>
  </svg>
`

const ALLOWED_STREAMABLE_HOSTS = ['streamable.com', 'www.streamable.com']

/**
 * Get a Streamable video by shortcode.
 * @param shortcode - The Streamable video shortcode.
 * @returns The Streamable video metadata.
 * @throws Will throw an error if no shortcode is provided or the fetch fails.
 */
export async function getVideo(shortcode: string): Promise<StreamableVideo> {
  if (shortcode.length <= 0) {
    throw new Error('Video shortcode was not provided.')
  }
  const response = await fetch(`https://api.streamable.com/videos/${shortcode}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch video with shortcode ${shortcode}: ${response.statusText}.`)
  }
  const data: StreamableVideo = await response.json()
  return data
}

/**
 * Get a video shortcode from a Streamable URL.
 * @param url - The Streamable video URL.
 * @returns The video shortcode or undefined if the URL is invalid.
 *
 * Supported URL formats:
 * - https://streamable.com/abc123
 * - https://streamable.com/e/abc123 (embed)
 * - https://streamable.com/o/abc123 (old embed)
 * - https://www.streamable.com/abc123
 */
export function getVideoIdFromUrl(url: string): string | undefined {
  try {
    const uri = new URL(url)
    if (!ALLOWED_STREAMABLE_HOSTS.includes(uri.hostname)) {
      return undefined
    }

    // Extract shortcode from pathname
    // Handles: /abc123, /e/abc123, /o/abc123
    const pathParts = uri.pathname.split('/').filter(Boolean)
    if (pathParts.length === 0) {
      return undefined
    }

    // Last non-empty part is the shortcode
    const shortcode = pathParts[pathParts.length - 1]

    // Shortcodes are typically 4-12 alphanumeric characters
    if (shortcode && /^[a-zA-Z0-9]{4,12}$/.test(shortcode)) {
      return shortcode
    }

    return undefined
  } catch {
    return undefined
  }
}

export default {
  logo,
  getVideo,
  getVideoIdFromUrl
}
