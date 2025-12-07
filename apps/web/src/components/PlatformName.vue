<template>
  <div class="flex items-center gap-2" :class="containerClass">
    <component :is="platformIcon" :class="iconClass" />
    <div :class="textClass">{{ displayName }}</div>
    <StatusAlertTriangle
      v-if="platforms.isExperimental(platform)"
      :title="m.experimental()"
      :size="size === 'small' ? 12 : size === 'large' ? 16 : 14"
      class="text-yellow-600 dark:text-yellow-500"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, toRefs } from 'vue'

import type { Platform } from '@cq/platforms'
import { Platform as PlatformEnum } from '@cq/platforms'

import {
  BrandKick,
  BrandSora,
  BrandStreamable,
  BrandTwitch,
  StatusAlertTriangle
} from '@/composables/icons'
import * as m from '@/paraglide/messages'
import { usePlatforms } from '@/stores/platforms'

export interface Props {
  platform: Platform
  size?: 'small' | 'medium' | 'large'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium'
})
const { platform, size } = toRefs(props)

const platforms = usePlatforms()

const platformIcon = computed(() => {
  switch (platform.value) {
    case PlatformEnum.TWITCH:
      return BrandTwitch
    case PlatformEnum.KICK:
      return BrandKick
    case PlatformEnum.SORA:
      return BrandSora
    case PlatformEnum.STREAMABLE:
      return BrandStreamable
    default:
      return BrandTwitch
  }
})

const displayName = computed(() => platforms.displayName(platform.value))

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
