import { ContentType } from '@cq/schemas/clip'
import streamable from '@cq/services/streamable'

import type { Clip, PlayerFormat } from './types'
import { BasePlatform, Platform } from './types'

/**
 * The Streamable platform.
 */
export class StreamablePlatform extends BasePlatform {
  public name = Platform.STREAMABLE
  public displayName = 'Streamable'
  public svg = streamable.logo

  public async getClip(url: string): Promise<Clip> {
    const shortcode = streamable.getVideoIdFromUrl(url)
    if (!shortcode) {
      throw new Error(`[${this.name}]: Invalid Streamable URL.`)
    }
    if (this.cache[shortcode]) {
      return this.cache[shortcode]
    }
    try {
      const video = await streamable.getVideo(shortcode)

      // Check if video is ready
      if (video.status !== 2) {
        throw new Error(`[${this.name}]: Video is still processing (${video.percent}%).`)
      }

      if (!video.files) {
        throw new Error(`[${this.name}]: Video has no available files.`)
      }

      // Get the best available video file for duration metadata
      const videoFile = video.files.mp4 || video.files['mp4-mobile']

      // Get duration from file metadata
      const duration = videoFile?.duration
        ? Math.round(videoFile.duration)
        : video.files.original?.duration
          ? Math.round(video.files.original.duration)
          : undefined

      const response: Clip = {
        platform: this.name,
        contentType: ContentType.VIDEO,
        id: shortcode,
        title: video.title || 'Untitled Video',
        channel: 'Streamable', // Streamable doesn't have channels
        creator: 'Unknown', // Streamable API doesn't expose creator info
        category: undefined,
        createdAt: undefined, // Streamable API doesn't expose creation date
        url,
        embedUrl: `https://streamable.com/e/${shortcode}`,
        videoUrl: undefined, // Fetched client-side to avoid URL expiration
        thumbnailUrl: video.thumbnail_url ? `https:${video.thumbnail_url}` : undefined,
        duration,
        submitters: []
      }

      this.cache[shortcode] = response
      return response
    } catch (error) {
      throw new Error(`[${this.name}]: ${error}`)
    }
  }

  public getPlayerFormat(): PlayerFormat {
    return 'video'
  }

  public getPlayerSource(clip: Clip): string | undefined {
    return clip.videoUrl || clip.embedUrl
  }
}
