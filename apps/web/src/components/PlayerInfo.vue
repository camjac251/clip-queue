<template>
  <div class="border-border bg-card rounded-lg border p-3 shadow-sm sm:p-4 lg:p-5">
    <h2
      class="text-foreground m-0 mb-2 flex items-center gap-2 text-lg leading-tight font-bold sm:mb-2.5 sm:gap-2.5 sm:text-xl lg:text-2xl"
    >
      <span class="line-clamp-2 sm:line-clamp-1">{{ clip.title }}</span>
      <a
        v-if="clip.url"
        :href="clip.url"
        target="_blank"
        rel="noreferrer"
        class="text-muted-foreground hover:text-brand flex-shrink-0 no-underline transition-colors duration-200"
      >
        <ActionExternalLink :size="16" class="sm:hidden" />
        <ActionExternalLink :size="18" class="hidden sm:block lg:hidden" />
        <ActionExternalLink :size="20" class="hidden lg:block" />
      </a>
    </h2>
    <div
      class="text-muted-foreground flex flex-wrap items-center gap-2 text-xs sm:gap-2.5 sm:text-sm"
    >
      <PlatformName :platform="clip.platform" />
      <span class="opacity-40">•</span>
      <span class="max-w-[120px] truncate font-medium sm:max-w-none">{{ clip.channel }}</span>
      <template v-if="clip.category">
        <span class="hidden opacity-40 sm:inline">•</span>
        <span class="hidden truncate sm:inline">{{ clip.category }}</span>
      </template>
      <template v-if="clip.creator">
        <span class="hidden opacity-40 sm:inline">•</span>
        <span class="text-brand hidden truncate font-semibold sm:inline">
          {{ m.creator_name({ name: clip.creator }) }}
        </span>
      </template>
      <template v-if="clip.submitters[0]">
        <span class="opacity-40">•</span>
        <span class="text-brand truncate font-semibold">
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
