import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { Clip, PlayerFormat } from '@cq/providers'
import { ClipProvider, providers as ps } from '@cq/providers'

import { useLogger } from '@/stores/logger'
import { useSettings } from '@/stores/settings'
import { useUser } from '@/stores/user'

/**
 * Providers Store
 *
 * Provides display metadata (SVG icons, names) and player configuration for clip providers.
 * Clip fetching is handled by the backend via EventSub.
 */
export const useProviders = defineStore('providers', () => {
  const settings = useSettings()
  const logger = useLogger()

  const providers = ref(
    ps.all({
      [ClipProvider.TWITCH]: () => {
        const user = useUser()
        return user.ctx
      }
    })
  )

  const svg = computed(() => {
    return (provider: ClipProvider) => {
      return providers.value[provider].svg
    }
  })

  const displayName = computed(() => {
    return (provider: ClipProvider) => {
      return providers.value[provider].displayName
    }
  })

  const isExperimental = computed(() => {
    return (provider: ClipProvider) => {
      return providers.value[provider].isExperimental
    }
  })

  function getPlayerFormat(clip: Clip): PlayerFormat | undefined {
    if (!settings.queue.providers.includes(clip.provider)) {
      logger.warn(
        `[Providers]: Attempted to get player format for clip from disabled provider: ${clip.provider}.`
      )
      return
    }
    const provider = providers.value[clip.provider]
    return provider.getPlayerFormat(clip)
  }

  function getPlayerSource(clip: Clip): string | undefined {
    if (!settings.queue.providers.includes(clip.provider)) {
      logger.warn(
        `[Providers]: Attempted to get player source for clip from disabled provider: ${clip.provider}.`
      )
      return
    }
    const provider = providers.value[clip.provider]
    return provider.getPlayerSource(clip)
  }

  return {
    svg,
    displayName,
    isExperimental,
    getPlayerFormat,
    getPlayerSource
  }
})
