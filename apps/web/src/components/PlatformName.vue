<template>
  <div class="flex items-center gap-2">
    <div class="h-5">
      <!-- eslint-disable-next-line vue/no-v-html -->
      <svg v-if="svg" class="h-5 w-5" v-html="svg"></svg>
    </div>
    <div>{{ displayName }}</div>
    <i
      v-if="platforms.isExperimental(platform)"
      v-tooltip="m.experimental()"
      class="pi pi-exclamation-triangle text-yellow-600 dark:text-yellow-500"
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
}

const props = defineProps<Props>()
const { platform } = toRefs(props)

const platforms = usePlatforms()

const svg = computed(() => platforms.svg(platform.value))
const displayName = computed(() => platforms.displayName(platform.value))
</script>
