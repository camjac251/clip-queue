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
 * Get direct video URL for a Twitch clip using GraphQL API.
 * @param id - The clip ID.
 * @param clientId - The Twitch client ID.
 * @returns The direct video URL.
 * @throws Will throw an error if the fetch fails or clip not found.
 */
export async function getDirectUrl(id: string, clientId: string): Promise<string> {
  if (!clientId) {
    throw new Error('Client ID is required.')
  }

  const data = [
    {
      operationName: 'ClipsDownloadButton',
      variables: {
        slug: id
      },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: '6e465bb8446e2391644cf079851c0cb1b96928435a240f07ed4b240f0acc6f1b'
        }
      }
    }
  ]

  const response = await fetch('https://gql.twitch.tv/gql', {
    method: 'POST',
    headers: {
      'Client-Id': clientId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch direct URL for clip ${id}: ${response.statusText}`)
  }

  const responseData = await response.json()
  const [respData] = responseData
  const playbackAccessToken = respData.data.clip.playbackAccessToken
  const url =
    respData.data.clip.videoQualities[0].sourceURL +
    '?sig=' +
    playbackAccessToken.signature +
    '&token=' +
    encodeURIComponent(playbackAccessToken.value)

  return url
}

export default {
  getClips,
  getGames,
  getUsers,
  getDirectUrl
}
