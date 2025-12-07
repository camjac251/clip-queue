/**
 * Streamable video file format.
 */
export interface StreamableFile {
  /**
   * Processing status (2 = complete).
   */
  status: number
  /**
   * Signed URL for the video file (expires automatically).
   */
  url: string
  /**
   * Video framerate.
   */
  framerate: number
  /**
   * Video height in pixels.
   */
  height: number
  /**
   * Video width in pixels.
   */
  width: number
  /**
   * Video bitrate in bits per second.
   */
  bitrate: number
  /**
   * File size in bytes.
   */
  size: number
  /**
   * Video duration in seconds.
   */
  duration: number
}

/**
 * Streamable original file metadata.
 */
export interface StreamableOriginal {
  /**
   * Video framerate.
   */
  framerate: number
  /**
   * Video bitrate in bits per second.
   */
  bitrate: number
  /**
   * File size in bytes.
   */
  size: number
  /**
   * Video duration in seconds.
   */
  duration: number
  /**
   * Video height in pixels.
   */
  height: number
  /**
   * Video width in pixels.
   */
  width: number
}

/**
 * Streamable video files container.
 */
export interface StreamableFiles {
  /**
   * MP4 file (highest quality).
   */
  mp4?: StreamableFile
  /**
   * Mobile-optimized MP4 file.
   */
  'mp4-mobile'?: StreamableFile
  /**
   * Original file metadata.
   */
  original?: StreamableOriginal
}

/**
 * Streamable video API response.
 */
export interface StreamableVideo {
  /**
   * Processing status (2 = complete).
   */
  status: number
  /**
   * Processing percentage (100 = complete).
   */
  percent: number
  /**
   * Video URL (without protocol).
   */
  url: string
  /**
   * HTML embed code.
   */
  embed_code: string
  /**
   * Error message if processing failed.
   */
  message: string | null
  /**
   * Video files in different formats.
   */
  files: StreamableFiles
  /**
   * Thumbnail URL.
   */
  thumbnail_url: string
  /**
   * Video title.
   */
  title: string
  /**
   * Source URL (if video was imported).
   */
  source: string | null
}
