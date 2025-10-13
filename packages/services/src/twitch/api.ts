import { createAuthHeaders } from '@cq/utils'

import type {
  TwitchClip,
  TwitchGame,
  TwitchPagedResponse,
  TwitchResponse,
  TwitchUser,
  TwitchUserCtx
} from './types'
import { toURLParams } from './utils'

const BASE_URL = 'https://api.twitch.tv/helix'

/**
 * Get clips from Twitch.
 * @param ctx - The Twitch user context.
 * @param ids - The clip IDs to fetch.
 * @returns The clips.
 * @throws Will throw an error if no clip IDs are provided or the fetch fails.
 */
export async function getClips(ctx: TwitchUserCtx, ids: string[]): Promise<TwitchClip[]> {
  if (ids.length <= 0) {
    throw new Error('Clip IDs were not provided.')
  }
  if (!ctx.token) {
    throw new Error('Authentication token is required.')
  }
  const response = await fetch(`${BASE_URL}/clips?${toURLParams('id', ids)}`, {
    headers: createAuthHeaders(ctx.token, ctx.id)
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch clips with IDs ${ids.join(' ')}: ${response.statusText}`)
  }
  const data: TwitchPagedResponse<TwitchClip[]> = await response.json()
  return data.data
}

/**
 * Get games from Twitch.
 * @param ctx - The Twitch user context.
 * @param ids - The game IDs to fetch.
 * @returns The games.
 */
export async function getGames(ctx: TwitchUserCtx, ids: string[]): Promise<TwitchGame[]> {
  if (ids.length <= 0) {
    throw new Error('Game IDs were not provided.')
  }
  if (!ctx.token) {
    throw new Error('Authentication token is required.')
  }
  const response = await fetch(`${BASE_URL}/games?${toURLParams('id', ids)}`, {
    headers: createAuthHeaders(ctx.token, ctx.id)
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch games with IDs ${ids.join(' ')}: ${response.statusText}`)
  }
  const data: TwitchResponse<TwitchGame[]> = await response.json()
  return data.data
}

/**
 * Get users from Twitch.
 * @param ctx - The Twitch user context.
 * @param ids - The user IDs to fetch.
 * @returns The users.
 */
export async function getUsers(ctx: TwitchUserCtx, ids: string[]): Promise<TwitchUser[]> {
  if (!ctx.token) {
    throw new Error('Authentication token is required.')
  }
  const response = await fetch(`${BASE_URL}/users?${toURLParams('id', ids)}`, {
    headers: createAuthHeaders(ctx.token, ctx.id)
  })
  if (!response.ok) {
    throw new Error(`Failed to users with IDs ${ids.join(' ')}: ${response.statusText}`)
  }
  const data: TwitchResponse<TwitchUser[]> = await response.json()
  return data.data
}

/**
 * Get direct video URL for a Twitch clip using Helix API.
 * Note: Helix API returns thumbnail_url which can be converted to video URL.
 * Format: https://clips-media-assets2.twitch.tv/{hash}/{clipId}-offset-{offset}.mp4
 *
 * @param id - The clip ID (slug).
 * @param clientId - The Twitch client ID.
 * @param accessToken - Optional OAuth access token for authenticated requests.
 * @returns The direct video URL.
 * @throws Will throw an error if the fetch fails or clip not found.
 */
export async function getDirectUrl(
  id: string,
  clientId: string,
  accessToken?: string
): Promise<string> {
  if (!clientId) {
    throw new Error('Client ID is required.')
  }

  // Validate and trim client ID
  const trimmedClientId = clientId.trim()
  if (!trimmedClientId || trimmedClientId.length !== 30) {
    throw new Error(
      `Invalid Client-ID format. Expected 30 characters, got ${trimmedClientId.length}. Value: "${trimmedClientId}"`
    )
  }

  console.log(`[Twitch API] Fetching clip data for: ${id}`)
  console.log(
    `[Twitch API] Client-ID: ${trimmedClientId.substring(0, 10)}... (${trimmedClientId.length} chars)`
  )

  // Use Helix API to get clip metadata
  const url = `https://api.twitch.tv/helix/clips?id=${id}`
  const headers: Record<string, string> = {
    'Client-Id': trimmedClientId
  }

  // Add Authorization header if access token provided (improves rate limits)
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const response = await fetch(url, { headers })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'No error details')
    throw new Error(
      `Failed to fetch clip ${id}: ${response.status} ${response.statusText} - ${errorText}`
    )
  }

  const data = await response.json()

  if (!data.data || data.data.length === 0) {
    throw new Error(`Clip ${id} not found or has been deleted.`)
  }

  const clip = data.data[0]

  // Extract video URL from thumbnail URL
  // Thumbnail format: https://clips-media-assets2.twitch.tv/{hash}/{clipId}-preview-{resolution}.jpg
  // Video format: https://clips-media-assets2.twitch.tv/{hash}/{clipId}.mp4
  const thumbnailUrl = clip.thumbnail_url

  if (!thumbnailUrl) {
    throw new Error(`Clip ${id} has no thumbnail URL. It may not be available.`)
  }

  // Convert thumbnail URL to video URL by removing "-preview-480x272.jpg" and adding ".mp4"
  const videoUrl = thumbnailUrl.replace(/-preview-\d+x\d+\.jpg$/, '.mp4')

  console.log(`[Twitch API] Converted thumbnail to video URL`)
  console.log(`[Twitch API] Thumbnail: ${thumbnailUrl}`)
  console.log(`[Twitch API] Video: ${videoUrl}`)

  return videoUrl
}

export default {
  getClips,
  getGames,
  getUsers,
  getDirectUrl
}
