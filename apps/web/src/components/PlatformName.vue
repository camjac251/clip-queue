<template>
  <div class="flex items-center gap-2" :class="containerClass">
    <div :class="iconContainerClass">
      <!-- eslint-disable-next-line vue/no-v-html -->
      <svg v-if="svg" :class="iconClass" v-html="svg"></svg>
    </div>
    <div :class="textClass">{{ displayName }}</div>
    <i
      v-if="platforms.isExperimental(platform)"
      v-tooltip="m.experimental()"
      class="pi pi-exclamation-triangle text-yellow-600 dark:text-yellow-500"
      :class="warningClass"
    ></i>
  </div>
</template>

<script setup lang="ts">
import { computed, toRefs } from 'vue'

import type { Platform } from '@cq/platforms'

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

const svg = computed(() => platforms.svg(platform.value))
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

const iconContainerClass = computed(() => {
  switch (size.value) {
    case 'small':
      return 'h-3'
    case 'large':
      return 'h-7'
    default:
      return 'h-5'
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

const warningClass = computed(() => {
  switch (size.value) {
    case 'small':
      return 'text-xs'
    case 'large':
      return 'text-base'
    default:
      return 'text-sm'
  }
})
</script>
