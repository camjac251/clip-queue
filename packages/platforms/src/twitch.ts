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
      const response: Clip = {
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
        platform: this.name,
        submitters: []
      }
      this.cache[id] = response
      return response
    } catch (error) {
      throw new Error(`[${this.name}]: ${error}`)
    }
  }

  public getPlayerFormat(): PlayerFormat {
    return 'video'
  }

  public getPlayerSource(clip: Clip): string | undefined {
    // Return undefined so VidStack fetches direct URL client-side
    // (Twitch signed URLs expire after ~24h, client-side fetching avoids backend expiration handling)
    return clip.videoUrl
  }
}
