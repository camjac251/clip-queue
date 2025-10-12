<template>
  <video ref="videoElement" :title class="video-js vjs-default-skin vjs-big-play-centered"></video>
</template>

<script setup lang="ts">
import videojs from 'video.js'
import { onBeforeUnmount, onMounted, ref, toRefs, useTemplateRef } from 'vue'

import 'video.js/dist/video-js.css'

export interface Props {
  poster: string | undefined
  source: string | undefined
  autoplay?: boolean
  title?: string
  clipId?: string
  clipPlatform?: string
}

const props = withDefaults(defineProps<Props>(), {
  autoplay: true,
  title: undefined,
  clipId: undefined,
  clipPlatform: undefined
})
const { poster, source, autoplay, title, clipId, clipPlatform } = toRefs(props)

const emit = defineEmits<{
  (e: 'ended'): void
  (e: 'error', error: string): void
}>()

const videoElement = useTemplateRef('videoElement')

// TODO(jordan): fix typing once video.js is updated.
// ref: https://github.com/videojs/video.js/issues/8242
let player: ReturnType<typeof videojs> | undefined = undefined
const hasRefreshed = ref(false)

async function refreshVideoUrl(): Promise<string | null> {
  if (!clipId?.value || !clipPlatform?.value) {
    console.warn('[VideoJS] Cannot refresh URL: clipId or clipPlatform not provided')
    return null
  }

  // Only Twitch URLs expire
  if (clipPlatform.value !== 'twitch') {
    return null
  }

  // Prevent infinite retry loop
  if (hasRefreshed.value) {
    console.warn('[VideoJS] Already attempted refresh, not retrying')
    return null
  }

  try {
    // Use relative URL (works in production and development)
    // The backend must be accessible at the same origin or CORS-enabled
    const API_URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
    const clipUUID = `${clipPlatform.value.toLowerCase()}:${clipId.value.toLowerCase()}`

    console.log(`[VideoJS] Refreshing expired video URL for clip: ${clipUUID}`)

    const response = await fetch(`${API_URL}/api/queue/refresh-video-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ clipId: clipUUID })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.success && data.videoUrl) {
      hasRefreshed.value = true
      console.log('[VideoJS] Successfully refreshed video URL')
      return data.videoUrl
    }

    return null
  } catch (error) {
    console.error('[VideoJS] Failed to refresh video URL:', error)
    emit('error', `Failed to refresh video URL: ${error}`)
    return null
  }
}

onMounted(() => {
  if (videoElement.value) {
    player = videojs(
      videoElement.value,
      // https://videojs.com/guides/options/
      {
        autoplay: autoplay.value,
        title: title.value,
        controls: true,
        fluid: true,
        poster: poster.value,
        sources: source.value
          ? [
              {
                src: source.value,
                type: source.value.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'
              }
            ]
          : []
      },
      () => {}
    )

    // Listen for the ended event
    player.on('ended', () => {
      emit('ended')
    })

    // Handle video errors (expired URLs, network failures, etc.)
    player.on('error', async () => {
      const error = player?.error()
      if (!error) return

      console.warn(`[VideoJS] Player error: ${error.code} - ${error.message}`)

      // Error codes: https://html.spec.whatwg.org/multipage/media.html#error-codes
      // 1 = MEDIA_ERR_ABORTED
      // 2 = MEDIA_ERR_NETWORK
      // 3 = MEDIA_ERR_DECODE
      // 4 = MEDIA_ERR_SRC_NOT_SUPPORTED

      // Try to refresh URL for network/source errors (likely expired token)
      if (error.code === 2 || error.code === 4) {
        const newUrl = await refreshVideoUrl()

        if (newUrl && player) {
          console.log('[VideoJS] Retrying playback with refreshed URL')

          // Update source and retry
          player.src({
            src: newUrl,
            type: newUrl.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'
          })

          // Reset error state and try to play
          // @ts-expect-error - video.js types are incorrect, error(null) is valid
          player.error(null)
          player.load()

          if (autoplay.value) {
            const playPromise = player.play()
            if (playPromise) {
              playPromise.catch((playError) => {
                console.error('[VideoJS] Failed to resume playback:', playError)
                emit('error', 'Failed to resume playback after URL refresh')
              })
            }
          }
        } else {
          emit('error', 'Video URL expired and refresh failed')
        }
      } else {
        emit('error', `Video playback error: ${error.message}`)
      }
    })
  }
})

onBeforeUnmount(() => {
  if (player) {
    player.dispose()
  }
})
</script>
