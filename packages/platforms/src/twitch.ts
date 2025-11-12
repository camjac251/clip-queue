import { ContentType } from '@cq/schemas/clip'
import twitch from '@cq/services/twitch'

import type { Clip, PlatformCtxCallback, PlayerFormat } from './types'
import { BasePlatform, Platform } from './types'

/**
 * The Twitch platform.
 */
export class TwitchPlatform extends BasePlatform {
  public name = Platform.TWITCH
  public displayName = 'Twitch'
  public svg = twitch.logo

  private ctx: PlatformCtxCallback = () => ({ id: '' })

  public constructor(callback?: PlatformCtxCallback) {
    super()
    if (callback) {
      this.ctx = callback
    }
  }

  public async getClip(url: string): Promise<Clip> {
    const contentType = twitch.getContentTypeFromUrl(url)
    if (!contentType) {
      throw new Error(`[${this.name}]: Invalid Twitch URL.`)
    }

    switch (contentType) {
      case ContentType.CLIP:
        return this.getClipContent(url)
      case ContentType.VOD:
      case ContentType.HIGHLIGHT:
        return this.getVideoContent(url, contentType)
      default:
        throw new Error(`[${this.name}]: Unsupported content type: ${contentType}`)
    }
  }

  private async getClipContent(url: string): Promise<Clip> {
    const id = twitch.getClipIdFromUrl(url)
    if (!id) {
      throw new Error(`[${this.name}]: Invalid clip URL.`)
    }
    if (this.cache[id]) {
      return this.cache[id]
    }
    try {
      const ctx = await this.ctx()
      const clips = await twitch.getClips(ctx, [id])
      const clip = clips[0]
      if (!clip) {
        throw new Error(`[${this.name}]: Clip not found for ID ${id}.`)
      }
      const games = await twitch.getGames(ctx, [clip.game_id])

      // Extract timestamp from URL if present (rare for clips, but supported)
      const timestamp = twitch.getTimestampFromUrl(url)

      const response: Clip = {
        platform: this.name,
        contentType: ContentType.CLIP,
        id: clip.id,
        title: clip.title,
        channel: clip.broadcaster_name,
        creator: clip.creator_name,
        category: games[0]?.name,
        createdAt: clip.created_at,
        url,
        embedUrl: clip.embed_url,
        videoUrl: undefined, // Fetched client-side to avoid backend URL expiration handling
        thumbnailUrl: clip.thumbnail_url,
        timestamp, // Start time from URL parameter
        submitters: []
      }
      this.cache[id] = response
      return response
    } catch (error) {
      throw new Error(`[${this.name}]: ${error}`)
    }
  }

  private async getVideoContent(url: string, contentType: ContentType): Promise<Clip> {
    const id = twitch.getVideoIdFromUrl(url)
    if (!id) {
      throw new Error(`[${this.name}]: Invalid video URL.`)
    }
    if (this.cache[id]) {
      return this.cache[id]
    }
    try {
      const ctx = await this.ctx()
      const videos = await twitch.getVideos(ctx, [id])
      const video = videos[0]
      if (!video) {
        throw new Error(`[${this.name}]: Video not found for ID ${id}.`)
      }

      // Fetched client-side to avoid backend URL expiration handling (consistent with clips)
      const videoUrl = undefined

      // Extract timestamp from URL (e.g., ?t=0h12m0s)
      const timestamp = twitch.getTimestampFromUrl(url)

      const response: Clip = {
        platform: this.name,
        contentType,
        id: video.id,
        title: video.title,
        channel: video.user_name,
        creator: video.user_name,
        category: undefined, // Videos don't have direct category mapping
        createdAt: video.created_at,
        url,
        embedUrl: `https://player.twitch.tv/?video=${id}&parent=localhost`,
        videoUrl, // Direct HLS URL for direct playback
        thumbnailUrl: video.thumbnail_url.replace('%{width}', '480').replace('%{height}', '272'),
        duration: twitch.parseDuration(video.duration),
        timestamp, // Start time from URL parameter
        submitters: []
      }
      this.cache[id] = response
      return response
    } catch (error) {
      throw new Error(`[${this.name}]: ${error}`)
    }
  }

  public getPlayerFormat(): PlayerFormat {
    // All content types now use direct video player (HLS for VODs/highlights)
    return 'video'
  }

  public getPlayerSource(clip: Clip): string | undefined {
    // All Twitch content types return undefined (fetched client-side to avoid expiration)
    // - Clips: MP4 URL (fetched via GraphQL)
    // - VODs/Highlights: HLS playlist URL (fetched via GraphQL)
    return clip.videoUrl
  }
}
