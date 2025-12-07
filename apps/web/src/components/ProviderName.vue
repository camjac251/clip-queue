<template>
  <div class="flex items-center gap-2" :class="containerClass">
    <component :is="platformIcon" :class="iconClass" />
    <div :class="textClass">{{ displayName }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, toRefs } from 'vue'

import type { Provider } from '@cq/schemas/settings'
import { Platform } from '@cq/platforms'

import { BrandKick, BrandOpenAI, BrandTwitch } from '@/composables/icons'
import * as m from '@/paraglide/messages'

export interface Props {
  provider: Provider
  size?: 'small' | 'medium' | 'large'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium'
})
const { provider, size } = toRefs(props)

/**
 * Parse provider into platform and content type.
 */
function parseProvider(p: Provider): { platform: Platform; contentType: string } {
  const parts = p.split(':')
  return {
    platform: parts[0] as Platform,
    contentType: parts[1] ?? 'clip'
  }
}

const platformIcon = computed(() => {
  const { platform } = parseProvider(provider.value)
  switch (platform) {
    case Platform.TWITCH:
      return BrandTwitch
    case Platform.KICK:
      return BrandKick
    case Platform.SORA:
      return BrandOpenAI
    default:
      return BrandTwitch
  }
})

const displayName = computed(() => {
  const { platform, contentType } = parseProvider(provider.value)

  // Get platform display name
  let platformName: string
  switch (platform) {
    case Platform.TWITCH:
      platformName = 'Twitch'
      break
    case Platform.KICK:
      platformName = 'Kick'
      break
    case Platform.SORA:
      platformName = 'Sora'
      break
    default:
      platformName = platform
  }

  // Get content type display name using i18n
  let contentTypeName: string
  switch (contentType) {
    case 'clip':
      contentTypeName = m.content_type_clip()
      break
    case 'vod':
      contentTypeName = m.content_type_vod()
      break
    case 'highlight':
      contentTypeName = m.content_type_highlight()
      break
    default:
      contentTypeName = contentType
  }

  return `${platformName} ${contentTypeName}`
})

const containerClass = computed(() => {
  switch (size.value) {
    case 'small':
      return 'gap-1'
    case 'large':
      return 'gap-3'
    default:
      return 'gap-2'
  }
})

const iconClass = computed(() => {
  switch (size.value) {
    case 'small':
      return 'h-3 w-3'
    case 'large':
      return 'h-7 w-7'
    default:
      return 'h-5 w-5'
  }
})

const textClass = computed(() => {
  switch (size.value) {
    case 'small':
      return 'text-xs'
    case 'large':
      return 'text-lg'
    default:
      return 'text-base'
  }
})
</script>
