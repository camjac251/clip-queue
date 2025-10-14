import type { Ref } from 'vue'
import { readonly, ref, watchEffect } from 'vue'

import type ClipPlayer from '@/components/ClipPlayer.vue'

const VOLUME_STORAGE_KEY = 'cq-player-volume'
const DEFAULT_VOLUME = 1.0

/**
 * Load saved volume from localStorage
 */
function loadSavedVolume(): number {
  try {
    const saved = localStorage.getItem(VOLUME_STORAGE_KEY)
    if (saved !== null) {
      const volume = parseFloat(saved)
      if (!isNaN(volume) && volume >= 0 && volume <= 1) {
        return Math.round(volume * 100)
      }
    }
  } catch (error) {
    console.warn('[PlayerState] Failed to load saved volume:', error)
  }
  return Math.round(DEFAULT_VOLUME * 100)
}

export function usePlayerState(playerRef: Ref<InstanceType<typeof ClipPlayer> | null>) {
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(loadSavedVolume())
  const isPlaying = ref(false)
  const isMuted = ref(false)

  watchEffect((onCleanup) => {
    const player = playerRef.value
    if (!player) return

    let lastPlayerTime = 0
    let lastUpdateTimestamp = performance.now()
    let animationFrameId: number | null = null
    let intervalId: ReturnType<typeof setInterval> | null = null

    // Smooth animation loop for currentTime (60fps)
    function updateCurrentTime() {
      const now = performance.now()
      const elapsed = (now - lastUpdateTimestamp) / 1000

      if (isPlaying.value && duration.value > 0) {
        // Interpolate time when playing
        const interpolatedTime = lastPlayerTime + elapsed
        currentTime.value = Math.min(interpolatedTime, duration.value)
      } else {
        // Use exact player time when paused
        currentTime.value = lastPlayerTime
      }

      animationFrameId = requestAnimationFrame(updateCurrentTime)
    }

    // Periodic sync with actual player state (250ms)
    intervalId = setInterval(() => {
      lastPlayerTime = player.currentTime ?? 0
      lastUpdateTimestamp = performance.now()
      duration.value = player.duration ?? 0
      volume.value = Math.round((player.volume ?? 1) * 100)
      isPlaying.value = !(player.paused ?? true)
      isMuted.value = player.muted ?? false
    }, 250)

    // Start animation loop
    animationFrameId = requestAnimationFrame(updateCurrentTime)

    onCleanup(() => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }
      if (intervalId !== null) {
        clearInterval(intervalId)
      }
    })
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
