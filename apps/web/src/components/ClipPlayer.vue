<template>
  <div class="player-container">
    <Player
      :title="clip.title"
      :format="playerFormat"
      :source="playerSource"
      :thumbnail-url="clip.thumbnailUrl"
      @ended="handleVideoEnded"
    >
      <template #unsupported>{{ m.unsupported_clip() }}</template>
    </Player>
    <div class="mt-2 text-left">
      <div class="flex items-center justify-between">
        <div class="text-surface-500 flex items-center gap-2 text-2xl font-bold">
          <span>{{ clip.title }}</span>
          <a
            v-if="clip.url"
            :href="clip.url"
            target="_blank"
            rel="noreferrer"
            class="hover:text-surface-600 dark:hover:text-surface-200 text-base no-underline"
          >
            <i class="pi pi-external-link"></i>
          </a>
        </div>
        <div v-if="canControl" class="flex items-center gap-2">
          <div class="flex items-center gap-2">
            <ToggleSwitch v-model="preferences.preferences.autoplay" input-id="autoplay" />
            <label for="autoplay" class="text-surface-700 dark:text-surface-300 text-sm">{{
              m.autoplay()
            }}</label>
          </div>
          <SecondaryButton
            icon="pi pi-backward"
            :label="m.previous()"
            size="small"
            :disabled="previousDisabled"
            @click="emit('previous')"
          >
          </SecondaryButton>
          <SecondaryButton
            icon="pi pi-forward"
            icon-pos="right"
            :label="m.next()"
            size="small"
            @click="emit('next')"
          >
          </SecondaryButton>
        </div>
      </div>
      <div class="text-surface-400 flex flex-col gap-1 text-sm font-normal">
        <span>
          {{ clip.channel }}
          <span v-if="clip.category"> - {{ clip.category }} </span>
          <span v-if="clip.creator"> - {{ m.creator_name({ name: clip.creator }) }}</span>
          <span v-if="clip.submitters[0]">
            - {{ m.submitter_name({ name: clip.submitters[0] }) }}</span
          >
        </span>
        <PlatformName :platform="clip.platform" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, toRefs } from 'vue'

import type { Clip, PlayerFormat } from '@cq/platforms'
import { Player } from '@cq/player'
import { SecondaryButton, ToggleSwitch } from '@cq/ui'

import PlatformName from '@/components/PlatformName.vue'
import { useKeydown } from '@/composables/keydown'
import * as m from '@/paraglide/messages'
import { useLogger } from '@/stores/logger'
import { usePlatforms } from '@/stores/platforms'
import { usePreferences } from '@/stores/preferences'

export interface Props {
  clip: Clip
  previousDisabled?: boolean
  canControl?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  previousDisabled: false,
  canControl: false
})
const { clip, previousDisabled, canControl } = toRefs(props)

const logger = useLogger()
const preferences = usePreferences()

useKeydown((event) => {
  // Check permissions before handling keyboard shortcuts
  if (!canControl.value) return

  if (event.key === 'ArrowLeft') {
    logger.debug('[Player]: left arrow pressed.')
    emit('previous')
  } else if (event.key === 'ArrowRight') {
    logger.debug('[Player]: right arrow pressed.')
    emit('next')
  }
})

const emit = defineEmits<{
  (e: 'previous'): void
  (e: 'next'): void
}>()

function handleVideoEnded() {
  logger.debug('[Player]: Video ended')
  if (preferences.preferences.autoplay) {
    logger.debug('[Player]: Autoplay enabled, advancing to next clip')
    emit('next')
  }
}

const platforms = usePlatforms()

const playerFormat = computed<PlayerFormat | undefined>(() => {
  return platforms.getPlayerFormat(clip.value)
})

const playerSource = computed<string | undefined>(() => {
  return platforms.getPlayerSource(clip.value)
})
</script>

<style scoped>
.player-container {
  grid-area: player;
}
</style>
