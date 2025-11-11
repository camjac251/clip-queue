import { ContentType } from '@cq/schemas/clip'
import sora from '@cq/services/sora'

import type { Clip, PlayerFormat } from './types'
import { BasePlatform, Platform } from './types'

/**
 * The Sora platform.
 */
export class SoraPlatform extends BasePlatform {
  public name = Platform.SORA
  public displayName = 'Sora'
  public svg = sora.logo

  public async getClip(url: string): Promise<Clip> {
    const id = sora.getPostIdFromUrl(url)
    if (!id) {
      throw new Error(`[${this.name}]: Invalid Sora URL.`)
    }
    if (this.cache[id]) {
      return this.cache[id]
    }
    try {
      const response = await sora.getPost(id)
      const { post, profile } = response

      if (!post) {
        throw new Error(`[${this.name}]: Post not found for ID ${id}.`)
      }

      const clip: Clip = {
        platform: this.name,
        contentType: ContentType.CLIP,
        id: post.id,
        title: post.text || 'Sora Video',
        channel: profile?.display_name || profile?.username || 'Unknown',
        creator: profile?.display_name || profile?.username || 'Unknown',
        category: undefined,
        createdAt: undefined,
        url,
        embedUrl: `https://sora.chatgpt.com/p/${id}`,
        videoUrl: post.attachments?.[0]?.downloadable_url,
        thumbnailUrl: post.attachments?.[0]?.encodings?.thumbnail?.path || post.preview_image_url,
        submitters: []
      }

      this.cache[id] = clip
      return clip
    } catch (error) {
      throw new Error(`[${this.name}]: ${error}`)
    }
  }

  public getPlayerFormat(): PlayerFormat {
    return 'video'
  }

  public getPlayerSource(clip: Clip): string | undefined {
    return clip.videoUrl
  }
}
