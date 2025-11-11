import type { BasePlatform, PlatformCtxCallback } from './types'
import { KickPlatform } from './kick'
import { SoraPlatform } from './sora'
import { TwitchPlatform } from './twitch'
import { Platform } from './types'

export * from './clip-list'
export * from './kick'
export * from './sora'
export * from './twitch'
export * from './types'
export * from './utils'

/**
 * The platforms.
 */
export const platforms = {
  /**
   * Get all platforms.
   * @param callbacks - The callbacks.
   * @returns The platforms.
   */
  all: (
    callbacks: Partial<Record<Platform, PlatformCtxCallback>>
  ): Record<Platform, BasePlatform> => ({
    [Platform.KICK]: new KickPlatform(),
    [Platform.SORA]: new SoraPlatform(),
    [Platform.TWITCH]: new TwitchPlatform(callbacks[Platform.TWITCH])
  })
}
