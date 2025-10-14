<template>
  <div class="player player-container h-auto w-full bg-black">
    <iframe
      v-if="format === 'iframe'"
      :src="source"
      :title
      class="player h-auto w-full bg-black"
      allowfullscreen
      allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
      frameborder="0"
    ></iframe>
    <div v-else-if="format === 'video'" class="player">
      <VidStack
        ref="vidstackRef"
        :poster="thumbnailUrl"
        :source
        :title
        :clip-id="clipId"
        :clip-platform="clipPlatform"
        autoplay
        @ended="emit('ended')"
        @error="(error) => emit('error', error)"
      />
    </div>
    <div
      v-else
      class="text-surface-600 dark:text-surface-400 flex h-full items-center justify-center font-normal"
    >
      <slot name="unsupported"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import VidStack from './VidStackPlayer.vue'

export interface Props {
  format?: 'iframe' | 'video' | 'unknown'
  title?: string
  source?: string
  thumbnailUrl?: string
  clipId?: string
  clipPlatform?: string
}

const {
  format = 'unknown',
  title = undefined,
  source = undefined,
  thumbnailUrl = undefined,
  clipId = undefined,
  clipPlatform = undefined
} = defineProps<Props>()

const emit = defineEmits<{
  (e: 'ended'): void
  (e: 'error', error: string): void
}>()

const vidstackRef = ref<InstanceType<typeof VidStack> | null>(null)

// Expose player API for external controls
defineExpose({
  get player() {
    return vidstackRef.value?.player
  },
  get paused() {
    return vidstackRef.value?.paused ?? true
  },
  get currentTime() {
    return vidstackRef.value?.currentTime ?? 0
  },
  get duration() {
    return vidstackRef.value?.duration ?? 0
  },
  get volume() {
    return vidstackRef.value?.volume ?? 1
  },
  get muted() {
    return vidstackRef.value?.muted ?? false
  },
  async play() {
    await vidstackRef.value?.play()
  },
  pause() {
    vidstackRef.value?.pause()
  },
  togglePlay() {
    vidstackRef.value?.togglePlay()
  },
  seek(time: number) {
    vidstackRef.value?.seek(time)
  },
  setVolume(volume: number) {
    vidstackRef.value?.setVolume(volume)
  },
  toggleMute() {
    vidstackRef.value?.toggleMute()
  }
})
</script>

<style>
.player {
  aspect-ratio: 16 / 9;
  max-height: calc(100vh - 11rem);
}
</style>
