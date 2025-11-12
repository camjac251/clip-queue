import type { Clip } from '@cq/schemas/clip'
import { Platform } from '@cq/schemas/clip'

/**
 * Platform and Clip types imported from @cq/schemas
 * (single source of truth for domain types)
 */

// Re-export for consumers
export { Platform, type Clip }

/**
 * The format of the player.
 */
export type PlayerFormat = 'iframe' | 'video' | 'unknown'

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
   * @returns The player source (or undefined if it should be fetched client-side).
   */
  public abstract getPlayerSource(clip: Clip): string | undefined
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
  /**
   * The application client ID (platform-specific).
   */
  clientId?: string
}

/**
 * Clip platform context callback.
 */
export type PlatformCtxCallback = () => PlatformCtx | Promise<PlatformCtx>
