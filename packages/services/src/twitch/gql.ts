/**
 * Twitch GraphQL API client for fetching direct video URLs
 *
 * Uses a public Client-ID that has access to the ClipsDownloadButton query.
 * This approach is used by the community since the official Helix API doesn't
 * expose direct video URLs.
 *
 * Note: Video URLs include signed tokens that expire after ~24 hours.
 */

const TWITCH_GQL_ENDPOINT = 'https://gql.twitch.tv/gql'
const TWITCH_PUBLIC_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko'

interface PlaybackAccessToken {
  signature: string
  value: string
}

interface VideoQuality {
  sourceURL: string
  quality: string
}

interface ClipData {
  clip: {
    playbackAccessToken: PlaybackAccessToken
    videoQualities: VideoQuality[]
  }
}

interface GraphQLResponse {
  data: ClipData
  errors?: Array<{ message: string }>
}

/**
 * Fetches a direct video URL for a Twitch clip
 *
 * @param clipId - Twitch clip ID (slug)
 * @returns Direct video URL with signed token, or undefined if fetch fails
 *
 * @example
 * const url = await getDirectVideoUrl('AwkwardHelplessSalamanderSwiftRage')
 * // Returns: https://...cloudfront.net/...mp4?sig=...&token=...
 */
export async function getDirectVideoUrl(clipId: string): Promise<string | undefined> {
  try {
    const response = await fetch(TWITCH_GQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': TWITCH_PUBLIC_CLIENT_ID
      },
      body: JSON.stringify([
        {
          operationName: 'ClipsDownloadButton',
          variables: {
            slug: clipId
          },
          extensions: {
            persistedQuery: {
              version: 1,
              sha256Hash: '6e465bb8446e2391644cf079851c0cb1b96928435a240f07ed4b240f0acc6f1b'
            }
          }
        }
      ])
    })

    if (!response.ok) {
      console.error(`Twitch GraphQL request failed: ${response.status} ${response.statusText}`)
      return undefined
    }

    const [data]: [GraphQLResponse] = await response.json()

    if (data.errors) {
      console.error('Twitch GraphQL errors:', data.errors)
      return undefined
    }

    const { playbackAccessToken, videoQualities } = data.data.clip

    if (!videoQualities || videoQualities.length === 0) {
      console.error('No video qualities available for clip:', clipId)
      return undefined
    }

    // Get highest quality (first in array)
    const firstQuality = videoQualities[0]
    if (!firstQuality) {
      console.error('First video quality is undefined for clip:', clipId)
      return undefined
    }

    const sourceURL = firstQuality.sourceURL
    const url = `${sourceURL}?sig=${playbackAccessToken.signature}&token=${encodeURIComponent(playbackAccessToken.value)}`

    return url
  } catch (error) {
    console.error('Failed to fetch Twitch clip video URL:', error)
    return undefined
  }
}
