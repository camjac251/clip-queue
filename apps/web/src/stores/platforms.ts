import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { Clip, PlayerFormat } from '@cq/platforms'
import { Platform, platforms as ps } from '@cq/platforms'

import { useLogger } from '@/stores/logger'
import { useSettings } from '@/stores/settings'

/**
 * Platforms Store
 *
 * Provides display metadata (SVG icons, names) and player configuration for clip platforms.
 * Clip fetching is handled by the backend via EventSub.
 */
export const usePlatforms = defineStore('platforms', () => {
  const settings = useSettings()
  const logger = useLogger()

  // Note: Clip fetching is handled by backend, so no user context needed
  // Platform instances only used for display metadata (SVG, player config)
  const platforms = ref(ps.all({}))

  const svg = computed(() => {
    return (platform: Platform) => {
      return platforms.value[platform].svg
    }
  })

  const displayName = computed(() => {
    return (platform: Platform) => {
      return platforms.value[platform].displayName
    }
  })

  const isExperimental = computed(() => {
    return (platform: Platform) => {
      return platforms.value[platform].isExperimental
    }
  })

  function getPlayerFormat(clip: Clip): PlayerFormat | undefined {
    if (!settings.queue.platforms.includes(clip.platform)) {
      logger.warn(
        `[Platforms]: Attempted to get player format for clip from disabled platform: ${clip.platform}.`
      )
      return
    }
    const platform = platforms.value[clip.platform]
    return platform.getPlayerFormat(clip)
  }

  function getPlayerSource(clip: Clip): string | undefined {
    if (!settings.queue.platforms.includes(clip.platform)) {
      logger.warn(
        `[Platforms]: Attempted to get player source for clip from disabled platform: ${clip.platform}.`
      )
      return
    }
    const platform = platforms.value[clip.platform]
    return platform.getPlayerSource(clip)
  }

  return {
    svg,
    displayName,
    isExperimental,
    getPlayerFormat,
    getPlayerSource
  }
})
