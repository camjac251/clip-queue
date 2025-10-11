/**
 * Enumeration of clip platforms.
 */
export enum Platform {
  /**
   * Kick.com clips.
   */
  KICK = 'kick',
  /**
   * Twitch.tv clips.
   */
  TWITCH = 'twitch'
}

/**
 * The format of the player.
 */
export type PlayerFormat = 'iframe' | 'video' | 'unknown'

/**
 * A clip.
 */
export interface Clip {
  /**
   * The platform of the clip.
   */
  platform: Platform
  /**
   * The ID of the clip.
   */
  id: string
  /**
   * The URL of the clip.
   */
  url: string
  /**
   * The embed URL of the clip.
   */
  embedUrl: string
  /**
   * The thumbnail URL of the clip.
   */
  thumbnailUrl: string
  /**
   * The title of the clip.
   */
  title: string
  /**
   * The channel of the clip.
   */
  channel: string
  /**
   * The creator of the clip.
   */
  creator: string
  /**
   * The submitters of the clip.
   */
  submitters: string[]
  /**
   * The category of the clip.
   */
  category?: string
  /**
   * The created at time of the clip.
   */
  createdAt?: string
}

/**
 * The base clip platform.
 */
export abstract class BasePlatform {
  /**
   * The identifier of the platform (lowercase).
   */
  public abstract name: Platform
  /**
   * The display name of the platform.
   */
  public abstract displayName: string
  /**
   * The SVG of the platform.
   */
  public abstract svg: string
  /**
   * Whether the platform is experimental.
   */
  public isExperimental = false
  protected cache: Record<string, Clip> = {}
  /**
   * Whether the platform has cached data.
   */
  public get hasCachedData(): boolean {
    return Object.keys(this.cache).length > 0
  }
  /**
   * Clear the cache.
   */
  public clearCache(): void {
    this.cache = {}
  }
  /**
   * Get a clip.
   * @param url - The URL of the clip.
   * @returns The clip or undefined.
   */
  public abstract getClip(url: string): Promise<Clip>
  /**
   * Get the player format.
   * @param clip - The clip.
   * @returns
   */
  public abstract getPlayerFormat(clip: Clip): PlayerFormat
  /**
   * Get the player source.
   * @param clip - The clip.
   * @returns The player source.
   */
  public abstract getPlayerSource(clip: Clip): string
}

/**
 * Clip platform context.
 */
export interface PlatformCtx {
  /**
   * The ID of the user.
   */
  id: string
  /**
   * The token of the user.
   */
  token?: string
}

/**
 * Clip platform context callback.
 */
export type PlatformCtxCallback = () => PlatformCtx | Promise<PlatformCtx>
