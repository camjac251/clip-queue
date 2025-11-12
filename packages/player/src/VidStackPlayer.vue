<template>
  <div class="cq-player-wrapper">
    <media-player
      ref="playerElement"
      class="cq-player"
      :title
      :src="currentVideoUrl"
      :autoplay
      playsinline
      @provider-change="handleProviderChange"
      @can-play="handleCanPlay"
      @playing="handlePlaying"
      @ended="emit('ended')"
      @error="handleError"
      @volume-change="handleVolumeChange"
    >
      <media-provider>
        <media-poster v-if="poster" class="vds-poster" :src="poster" :alt="title" />
      </media-provider>
    </media-player>

    <!-- Play button overlay when autoplay is disabled -->
    <div
      v-if="!autoplay && !hasStartedPlaying && isPlayerReady"
      class="cq-play-overlay"
      @click="handlePlayClick"
    >
      <div class="cq-play-button">
        <svg
          width="80"
          height="80"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="10" fill="rgba(139, 92, 246, 0.9)" />
          <path d="M9.5 8.5L16.5 12L9.5 15.5V8.5Z" fill="white" />
        </svg>
      </div>
      <p class="cq-play-text">Click to play</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import 'vidstack/player/styles/default/theme.css'
import 'vidstack/player/styles/default/layouts/video.css'
import 'vidstack/player'
import 'vidstack/player/layouts'
import 'vidstack/player/ui'

import type { MediaPlayerElement } from 'vidstack/elements'
import { onMounted, ref, toRefs, watch } from 'vue'

import twitch, { getDirectVideoUrl } from '@cq/services/twitch'

export interface Props {
  poster: string | undefined
  source: string | undefined
  autoplay?: boolean
  title?: string
  clipId?: string
  clipPlatform?: string
  contentType?: string
  timestamp?: number
  apiUrl?: string
}

const props = withDefaults(defineProps<Props>(), {
  autoplay: true,
  title: undefined,
  clipId: undefined,
  clipPlatform: undefined,
  contentType: undefined,
  timestamp: undefined,
  apiUrl: 'http://localhost:3000'
})
const { poster, source, autoplay, title, clipId, clipPlatform, contentType, timestamp, apiUrl } =
  toRefs(props)

const emit = defineEmits<{
  (e: 'ended'): void
  (e: 'error', error: string): void
}>()

const playerElement = ref<MediaPlayerElement>()
const hasRefreshed = ref(false)
const currentVideoUrl = ref<string | { src: string; type: 'application/x-mpegurl' } | undefined>(
  undefined
)
const isPlayerReady = ref(false)
const pendingPlay = ref(false)
const hasStartedPlaying = ref(false)
const currentFetchAbort = ref<AbortController | null>(null)

// Expose player API for external controls
defineExpose({
  get player() {
    return playerElement.value
  },
  get paused() {
    return playerElement.value?.paused ?? true
  },
  get currentTime() {
    return playerElement.value?.currentTime ?? 0
  },
  get duration() {
    return playerElement.value?.duration ?? 0
  },
  get volume() {
    return playerElement.value?.volume ?? 1
  },
  get muted() {
    return playerElement.value?.muted ?? false
  },
  async play() {
    await playerElement.value?.play()
  },
  pause() {
    playerElement.value?.pause()
  },
  togglePlay() {
    if (playerElement.value?.paused) {
      playerElement.value?.play()
    } else {
      playerElement.value?.pause()
    }
  },
  seek(time: number) {
    if (playerElement.value) {
      playerElement.value.currentTime = time
    }
  },
  setVolume(volume: number) {
    if (playerElement.value) {
      playerElement.value.volume = Math.max(0, Math.min(1, volume))
    }
  },
  toggleMute() {
    if (playerElement.value) {
      playerElement.value.muted = !playerElement.value.muted
    }
  }
})

// Volume persistence
const VOLUME_STORAGE_KEY = 'cq-player-volume'
const DEFAULT_VOLUME = 1.0

/**
 * Fetches direct video URL for Twitch content client-side
 * - Clips: MP4 URL via GraphQL ClipsDownloadButton query (returned as string)
 * - VODs/Highlights: HLS playlist URL via GraphQL VideoPlaybackAccessToken query (returned as object with type)
 */
async function fetchTwitchVideoUrl(): Promise<
  string | { src: string; type: 'application/x-mpegurl' } | undefined
> {
  if (!clipId?.value || clipPlatform?.value !== 'twitch') {
    return undefined
  }

  try {
    const type = contentType?.value || 'clip'
    console.log(`[VidStack] Fetching direct video URL for Twitch ${type}: ${clipId.value}`)

    let url: string | undefined

    // Clips use MP4 URLs (GraphQL ClipsDownloadButton query)
    if (type === 'clip') {
      url = await getDirectVideoUrl(clipId.value)

      if (!url) {
        console.error(`[VidStack] Failed to fetch Twitch ${type} URL`)
        return undefined
      }

      console.log(`[VidStack] Successfully fetched Twitch ${type} URL`)
      return url // Return as string for MP4
    }
    // VODs and highlights use HLS playlist URLs (GraphQL VideoPlaybackAccessToken query)
    else if (type === 'vod' || type === 'highlight') {
      url = await twitch.getVideoDirectUrl(clipId.value)

      // Wrap HLS URLs with CORS proxy (Twitch blocks direct browser access)
      if (url && url.includes('usher.ttvnw.net')) {
        url = `${apiUrl.value}/api/proxy/hls?url=${encodeURIComponent(url)}`
        console.log('[VidStack] Wrapped HLS URL with CORS proxy')
      }

      if (!url) {
        console.error(`[VidStack] Failed to fetch Twitch ${type} URL`)
        emit('error', `Failed to load ${type} video URL. Please try again.`)
        return undefined
      }

      console.log(`[VidStack] Successfully fetched Twitch ${type} URL`)
      // Return as object with explicit HLS type (Vidstack needs this for proxied URLs)
      return {
        src: url,
        type: 'application/x-mpegurl'
      }
    }

    return undefined
  } catch (error) {
    const type = contentType?.value || 'clip'
    console.error('[VidStack] Error fetching Twitch video URL:', error)
    emit('error', `Failed to load ${type} video: ${error}`)
    return undefined
  }
}

/**
 * Refreshes expired Twitch video URL
 */
async function refreshVideoUrl(): Promise<
  string | { src: string; type: 'application/x-mpegurl' } | undefined
> {
  if (clipPlatform?.value !== 'twitch') {
    return undefined
  }

  if (hasRefreshed.value) {
    console.warn('[VidStack] Already attempted refresh, not retrying')
    return undefined
  }

  console.log('[VidStack] Refreshing expired video URL')
  hasRefreshed.value = true

  return await fetchTwitchVideoUrl()
}

/**
 * Handle player errors (network failures, expired URLs, etc.)
 */
async function handleError(event: { detail?: { code?: number; message?: string } }) {
  const error = event?.detail
  if (!error) return

  console.warn('[VidStack] Player error:', error)

  // MediaError codes:
  // 1 = MEDIA_ERR_ABORTED
  // 2 = MEDIA_ERR_NETWORK
  // 3 = MEDIA_ERR_DECODE
  // 4 = MEDIA_ERR_SRC_NOT_SUPPORTED

  // Try to refresh URL for network/source errors (likely expired token)
  if (error.code === 2 || error.code === 4) {
    const newUrl = await refreshVideoUrl()

    if (newUrl) {
      console.log('[VidStack] Retrying playback with refreshed URL')
      isPlayerReady.value = false
      currentVideoUrl.value = newUrl

      if (autoplay.value) {
        // Mark that we need to play once ready
        pendingPlay.value = true
      }
    } else {
      emit('error', 'Video URL expired and refresh failed')
    }
  } else {
    emit('error', `Video playback error: ${error.message}`)
  }
}

/**
 * Load saved volume from localStorage
 */
function loadSavedVolume(): number {
  try {
    const saved = localStorage.getItem(VOLUME_STORAGE_KEY)
    if (saved !== null) {
      const volume = parseFloat(saved)
      if (!isNaN(volume) && volume >= 0 && volume <= 1) {
        return volume
      }
    }
  } catch (error) {
    console.warn('[VidStack] Failed to load saved volume:', error)
  }
  return DEFAULT_VOLUME
}

/**
 * Save volume to localStorage
 */
function saveVolume(volume: number): void {
  try {
    localStorage.setItem(VOLUME_STORAGE_KEY, volume.toString())
  } catch (error) {
    console.warn('[VidStack] Failed to save volume:', error)
  }
}

/**
 * Handle volume changes and persist to localStorage
 */
function handleVolumeChange(): void {
  if (playerElement.value) {
    const volume = playerElement.value.volume
    saveVolume(volume)
  }
}

function handleProviderChange() {
  console.log('[VidStack] Provider changed')
  isPlayerReady.value = false
}

function handlePlaying() {
  hasStartedPlaying.value = true
  // Reset refresh flag to allow retry on next error (e.g., mid-playback expiration)
  hasRefreshed.value = false
}

async function handleCanPlay() {
  console.log('[VidStack] Media can play')
  isPlayerReady.value = true

  // Restore saved volume when player is ready
  if (playerElement.value) {
    const savedVolume = loadSavedVolume()
    playerElement.value.volume = savedVolume
    console.log(`[VidStack] Restored volume: ${savedVolume}`)
  }

  // Seek to timestamp if provided (e.g., from URL ?t=0h12m0s)
  if (timestamp?.value && playerElement.value) {
    console.log(`[VidStack] Seeking to timestamp: ${timestamp.value}s`)
    playerElement.value.currentTime = timestamp.value
  }

  // If we have a pending play request (from error recovery), execute it now
  if (pendingPlay.value && playerElement.value) {
    pendingPlay.value = false
    try {
      await playerElement.value.play()
    } catch (playError) {
      console.error('[VidStack] Failed to resume playback:', playError)
      emit('error', 'Failed to resume playback after URL refresh')
    }
  }
}

async function handlePlayClick() {
  if (!playerElement.value) {
    return
  }

  // Ensure player is ready before attempting to play
  if (!isPlayerReady.value) {
    console.warn('[VidStack] Play clicked but player not ready, waiting...')
    // Set pending play flag so it plays when ready
    pendingPlay.value = true
    return
  }

  try {
    await playerElement.value.play()
  } catch (error) {
    console.error('[VidStack] Failed to start playback:', error)
    emit('error', 'Failed to start playback')
  }
}

// Watch for source, clipId, or contentType changes
watch(
  [source, clipId, clipPlatform, contentType],
  async ([newSource, newClipId, newPlatform]) => {
    // Abort previous fetch to prevent race conditions on rapid advances
    if (currentFetchAbort.value) {
      console.warn('[VidStack] Aborting previous fetch (race condition prevented)')
      currentFetchAbort.value.abort()
      currentFetchAbort.value = null
    }

    hasRefreshed.value = false
    isPlayerReady.value = false
    pendingPlay.value = false
    hasStartedPlaying.value = false

    // If no source provided but we have a Twitch content ID, fetch it
    if (!newSource && newClipId && newPlatform === 'twitch') {
      currentFetchAbort.value = new AbortController()
      currentVideoUrl.value = await fetchTwitchVideoUrl()
      currentFetchAbort.value = null
    } else {
      currentVideoUrl.value = newSource
    }
  },
  { immediate: false }
)

onMounted(async () => {
  hasRefreshed.value = false
  isPlayerReady.value = false
  pendingPlay.value = false
  hasStartedPlaying.value = false

  // If no source provided but we have a Twitch content ID, fetch it
  if (!source.value && clipId?.value && clipPlatform?.value === 'twitch') {
    currentVideoUrl.value = await fetchTwitchVideoUrl()
  } else {
    currentVideoUrl.value = source.value
  }
})
</script>

<!-- eslint-disable-next-line custom/no-vue-style-blocks -->
<!-- Style block required for third-party library (Vidstack CSS variable API) -->
<style>
/* Custom purple/violet theme - matches Queue/Timeline design */
.cq-player-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
}

.cq-player {
  /* Brand colors (violet-500: rgb(139 92 246)) */
  --brand-color: rgb(139 92 246);
  --focus-color: rgb(139 92 246);

  /* Video layout theme variables */
  --video-brand: var(--brand-color);
  --video-focus-ring-color: var(--focus-color);
  --video-border-radius: 0px;

  /* Aspect ratio and sizing - strict 16:9 */
  width: 100%;
  aspect-ratio: 16 / 9;

  /* Match Queue page player styling */
  background: linear-gradient(to bottom, rgb(0 0 0 / 0.95), rgb(0 0 0 / 0.98));
  box-shadow:
    0 10px 15px -3px rgb(0 0 0 / 0.2),
    0 4px 6px -4px rgb(0 0 0 / 0.2),
    0 0 0 1px rgb(255 255 255 / 0.05);
}

/* Play button overlay for manual playback */
.cq-play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  cursor: pointer;
  transition: background 0.3s ease;
  z-index: 10;
}

.cq-play-overlay:hover {
  background: rgba(0, 0, 0, 0.8);
}

.cq-play-button {
  transition: transform 0.2s ease;
}

.cq-play-overlay:hover .cq-play-button {
  transform: scale(1.1);
}

.cq-play-text {
  margin-top: 1rem;
  color: white;
  font-size: 1.125rem;
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}
</style>
