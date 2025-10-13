<template>
  <video ref="videoElement" :title class="video-js vjs-default-skin vjs-big-play-centered"></video>
</template>

<script setup lang="ts">
import videojs from 'video.js'
import { onBeforeUnmount, onMounted, ref, toRefs, useTemplateRef, watch } from 'vue'

import { getDirectVideoUrl } from '@cq/services/twitch'

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
const fetchedVideoUrl = ref<string | undefined>(undefined)

/**
 * Fetches direct video URL for Twitch clips client-side
 * Uses Twitch GraphQL API with public Client-ID
 */
async function fetchTwitchVideoUrl(): Promise<string | undefined> {
  if (!clipId?.value || clipPlatform?.value !== 'twitch') {
    return undefined
  }

  try {
    console.log(`[VideoJS] Fetching direct video URL for Twitch clip: ${clipId.value}`)
    const url = await getDirectVideoUrl(clipId.value)

    if (!url) {
      console.error('[VideoJS] Failed to fetch Twitch video URL')
      return undefined
    }

    console.log('[VideoJS] Successfully fetched Twitch video URL')
    return url
  } catch (error) {
    console.error('[VideoJS] Error fetching Twitch video URL:', error)
    return undefined
  }
}

/**
 * Refreshes expired Twitch video URL
 */
async function refreshVideoUrl(): Promise<string | undefined> {
  if (clipPlatform?.value !== 'twitch') {
    return undefined
  }

  // Prevent infinite retry loop
  if (hasRefreshed.value) {
    console.warn('[VideoJS] Already attempted refresh, not retrying')
    return undefined
  }

  console.log('[VideoJS] Refreshing expired video URL')
  hasRefreshed.value = true

  return await fetchTwitchVideoUrl()
}

/**
 * Initializes or updates the video.js player with a source URL
 */
function initializePlayer(videoUrl: string | undefined) {
  if (!videoElement.value || !videoUrl) return

  if (player) {
    // Update existing player source
    player.src({
      src: videoUrl,
      type: videoUrl.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'
    })
    player.load()
    return
  }

  // Create new player
  player = videojs(
    videoElement.value,
    {
      autoplay: autoplay.value,
      title: title.value,
      controls: true,
      fluid: true,
      poster: poster.value,
      sources: [
        {
          src: videoUrl,
          type: videoUrl.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'
        }
      ]
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

// Watch for source or clipId changes
watch(
  [source, clipId, clipPlatform],
  async ([newSource, newClipId, newPlatform]) => {
    // Reset refresh flag when clip changes
    hasRefreshed.value = false

    let videoUrl: string | undefined = newSource

    // If no source provided but we have a Twitch clip ID, fetch it
    if (!videoUrl && newClipId && newPlatform === 'twitch') {
      videoUrl = await fetchTwitchVideoUrl()
    }

    if (videoUrl) {
      fetchedVideoUrl.value = videoUrl
      initializePlayer(videoUrl)
    }
  },
  { immediate: false }
)

onMounted(async () => {
  // Reset refresh flag
  hasRefreshed.value = false

  let videoUrl: string | undefined = source.value

  // If no source provided but we have a Twitch clip ID, fetch it
  if (!videoUrl && clipId?.value && clipPlatform?.value === 'twitch') {
    videoUrl = await fetchTwitchVideoUrl()
  }

  if (videoUrl) {
    fetchedVideoUrl.value = videoUrl
    initializePlayer(videoUrl)
  }
})

onBeforeUnmount(() => {
  if (player) {
    player.dispose()
  }
})
</script>
