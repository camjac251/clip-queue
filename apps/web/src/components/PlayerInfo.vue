<template>
  <div class="border-border bg-card rounded-lg border p-2 sm:p-3 lg:p-4">
    <h2
      class="text-foreground m-0 mb-1.5 flex items-center gap-1.5 text-base leading-tight font-bold sm:mb-2 sm:gap-2 sm:text-lg lg:text-xl"
    >
      <span class="line-clamp-2 sm:line-clamp-1">{{ clip.title }}</span>
      <a
        v-if="clip.url"
        :href="clip.url"
        target="_blank"
        rel="noreferrer"
        class="text-muted-foreground flex-shrink-0 no-underline transition-colors duration-200 hover:text-violet-600 dark:hover:text-violet-500"
      >
        <ActionExternalLink :size="14" class="sm:hidden" />
        <ActionExternalLink :size="16" class="hidden sm:block lg:hidden" />
        <ActionExternalLink :size="18" class="hidden lg:block" />
      </a>
    </h2>
    <div
      class="text-muted-foreground flex flex-wrap items-center gap-1.5 text-[10px] sm:gap-2 sm:text-xs"
    >
      <PlatformName :platform="clip.platform" />
      <span class="opacity-40">•</span>
      <span class="max-w-[120px] truncate sm:max-w-none">{{ clip.channel }}</span>
      <template v-if="clip.category">
        <span class="hidden opacity-40 sm:inline">•</span>
        <span class="hidden truncate sm:inline">{{ clip.category }}</span>
      </template>
      <template v-if="clip.creator">
        <span class="hidden opacity-40 sm:inline">•</span>
        <span class="hidden truncate font-medium text-violet-600 sm:inline dark:text-violet-500">
          {{ m.creator_name({ name: clip.creator }) }}
        </span>
      </template>
      <template v-if="clip.submitters[0]">
        <span class="opacity-40">•</span>
        <span class="truncate font-medium text-violet-600 dark:text-violet-500">
          {{ m.submitter_name({ name: clip.submitters[0] }) }}
        </span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Clip } from '@cq/platforms'

import PlatformName from '@/components/PlatformName.vue'
import { ActionExternalLink } from '@/composables/icons'
import * as m from '@/paraglide/messages'

export interface Props {
  clip: Clip
}

defineProps<Props>()
</script>
