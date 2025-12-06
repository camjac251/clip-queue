import { createAuthHeaders } from '@cq/utils'

import type {
  TwitchClip,
  TwitchGame,
  TwitchPagedResponse,
  TwitchResponse,
  TwitchUser,
  TwitchUserCtx,
  TwitchVideo
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
 * Get videos (VODs/highlights) from Twitch.
 * @param ctx - The Twitch user context.
 * @param ids - The video IDs to fetch.
 * @returns The videos.
 * @throws Will throw an error if no video IDs are provided or the fetch fails.
 */
export async function getVideos(ctx: TwitchUserCtx, ids: string[]): Promise<TwitchVideo[]> {
  if (ids.length <= 0) {
    throw new Error('Video IDs were not provided.')
  }
  if (!ctx.token) {
    throw new Error('Authentication token is required.')
  }
  const response = await fetch(`${BASE_URL}/videos?${toURLParams('id', ids)}`, {
    headers: createAuthHeaders(ctx.token, ctx.id)
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch videos with IDs ${ids.join(' ')}: ${response.statusText}`)
  }
  const data: TwitchResponse<TwitchVideo[]> = await response.json()
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

  return videoUrl
}

// Public client ID used by Twitch web player (safe to expose)
const TWITCH_PUBLIC_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko'

/**
 * Get VOD playback access token using Twitch GraphQL API.
 * Required to construct HLS playlist URLs for direct video playback.
 *
 * @param videoId - The video ID (numeric string).
 * @param signal - Optional AbortSignal for request cancellation.
 * @returns Object with token value and signature.
 * @throws Will throw an error if the fetch fails.
 */
async function getVideoAccessToken(
  videoId: string,
  signal?: AbortSignal
): Promise<{ value: string; signature: string }> {
  const query = `
    query PlaybackAccessToken($id: ID!) {
      videoPlaybackAccessToken(id: $id, params: {platform: "web", playerBackend: "mediaplayer", playerType: "site"}) {
        value
        signature
      }
    }
  `

  const response = await fetch('https://gql.twitch.tv/gql', {
    method: 'POST',
    headers: {
      'Client-Id': TWITCH_PUBLIC_CLIENT_ID,
      'Content-Type': 'application/json'
    },
    signal,
    body: JSON.stringify({
      query,
      variables: { id: videoId }
    })
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'No error details')
    throw new Error(`Failed to fetch video access token: ${response.status} - ${errorText}`)
  }

  const data = await response.json()

  if (!data.data?.videoPlaybackAccessToken) {
    throw new Error(`Failed to get access token for video ${videoId}`)
  }

  return {
    value: data.data.videoPlaybackAccessToken.value,
    signature: data.data.videoPlaybackAccessToken.signature
  }
}

/**
 * Get direct HLS playlist URL for a Twitch VOD/highlight.
 * Uses GraphQL API to get access token, then constructs Usher API URL.
 *
 * @param videoId - The video ID (numeric string).
 * @param signal - Optional AbortSignal for request cancellation.
 * @returns The HLS playlist URL (.m3u8).
 * @throws Will throw an error if unable to get access token.
 */
export async function getVideoDirectUrl(videoId: string, signal?: AbortSignal): Promise<string> {
  const { value, signature } = await getVideoAccessToken(videoId, signal)

  // Construct Usher API URL with access token
  const params = new URLSearchParams({
    token: value,
    sig: signature,
    allow_source: 'true',
    allow_audio_only: 'true'
  })

  return `https://usher.ttvnw.net/vod/${videoId}.m3u8?${params.toString()}`
}

export default {
  getClips,
  getGames,
  getUsers,
  getVideos,
  getDirectUrl,
  getVideoDirectUrl
}
