import type { Ref } from 'vue'
import { readonly, ref, watchEffect } from 'vue'

import type ClipPlayer from '@/components/ClipPlayer.vue'

export function usePlayerState(playerRef: Ref<InstanceType<typeof ClipPlayer> | null>) {
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(100)
  const isPlaying = ref(false)
  const isMuted = ref(false)

  watchEffect((onCleanup) => {
    const player = playerRef.value
    if (!player) return

    const interval = setInterval(() => {
      currentTime.value = player.currentTime ?? 0
      duration.value = player.duration ?? 0
      volume.value = Math.round((player.volume ?? 1) * 100)
      isPlaying.value = !(player.paused ?? true)
      isMuted.value = player.muted ?? false
    }, 100)

    onCleanup(() => clearInterval(interval))
  })

  function togglePlayPause() {
    playerRef.value?.togglePlay()
  }

  function seek(time: number) {
    playerRef.value?.seek(time)
  }

  function setVolume(vol: number) {
    playerRef.value?.setVolume(vol / 100)
  }

  function toggleMute() {
    playerRef.value?.toggleMute()
  }

  return {
    // Readonly state
    currentTime: readonly(currentTime),
    duration: readonly(duration),
    volume: readonly(volume),
    isPlaying: readonly(isPlaying),
    isMuted: readonly(isMuted),

    // Control methods
    togglePlayPause,
    seek,
    setVolume,
    toggleMute
  }
}
