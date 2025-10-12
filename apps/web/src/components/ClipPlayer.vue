<template>
  <div class="player-container">
    <Player
      :title="clip.title"
      :format="playerFormat"
      :source="playerSource"
      :thumbnail-url="clip.thumbnailUrl"
      :clip-id="clip.id"
      :clip-platform="clip.platform"
      @ended="handleVideoEnded"
      @error="handleVideoError"
    >
      <template #unsupported>{{ m.unsupported_clip() }}</template>
    </Player>
  </div>
</template>

<script setup lang="ts">
import { computed, toRefs } from 'vue'

import type { Clip, PlayerFormat } from '@cq/platforms'
import { Player } from '@cq/player'

import * as m from '@/paraglide/messages'
import { useLogger } from '@/stores/logger'
import { usePlatforms } from '@/stores/platforms'
import { usePreferences } from '@/stores/preferences'

export interface Props {
  clip: Clip
}

const props = defineProps<Props>()
const { clip } = toRefs(props)

const logger = useLogger()
const preferences = usePreferences()

const emit = defineEmits<{
  (e: 'ended'): void
}>()

function handleVideoEnded() {
  logger.debug('[Player]: Video ended')
  if (preferences.preferences.autoplay) {
    logger.debug('[Player]: Autoplay enabled, advancing to next clip')
    emit('ended')
  }
}

function handleVideoError(error: string) {
  logger.error(`[Player]: ${error}`)
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
