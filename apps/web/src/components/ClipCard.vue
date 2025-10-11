<template>
  <Card class="max-w-2xs shrink-0 overflow-hidden text-left">
    <template #header>
      <img
        class="aspect-video w-full"
        :alt="clip.title"
        :src="clip.thumbnailUrl"
        @error="emit('remove')"
      />
    </template>
    <template #title>
      <span :title="clip.title" class="line-clamp-1 font-normal">{{ clip.title }}</span>
    </template>
    <template #subtitle>
      <span :title="subtitle" class="line-clamp-1">{{ subtitle }}</span>
    </template>
    <template #content>
      <div class="text-surface-400 text-xs">
        <p class="line-clamp-1">
          {{ m.submitter_name({ name: clip.submitters[0] ?? '' }) }}
        </p>
        <p class="line-clamp-1">
          {{ m.creator_name({ name: clip.creator ?? m.unknown() }) }}
        </p>
        <div class="flex items-center gap-1">
          <p>{{ m.platform_colon() }}</p>
          <PlatformName :platform="clip.platform" class="font-normal" />
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-between gap-2">
        <SecondaryButton
          class="grow"
          icon="pi pi-play"
          :label="m.play()"
          size="small"
          @click="emit('play')"
        >
        </SecondaryButton>
        <DangerButton
          class="grow"
          icon="pi pi-trash"
          :label="m.remove()"
          size="small"
          @click="emit('remove')"
        >
        </DangerButton>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { computed, toRefs } from 'vue'

import type { Clip } from '@cq/platforms'
import { Card, DangerButton, SecondaryButton } from '@cq/ui'

import PlatformName from '@/components/PlatformName.vue'
import * as m from '@/paraglide/messages'

export interface Props {
  clip: Clip
}

const props = defineProps<Props>()
const { clip } = toRefs(props)

const subtitle = computed(() => {
  if (clip.value.category) {
    return `${clip.value.channel} - ${clip.value.category}`
  }
  return clip.value.channel
})

const emit = defineEmits<{
  (e: 'play'): void
  (e: 'remove'): void
  (e: 'add'): void
}>()
</script>
