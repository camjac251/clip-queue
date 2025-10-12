<template>
  <video ref="videoElement" :title class="video-js vjs-default-skin vjs-big-play-centered"></video>
</template>

<script setup lang="ts">
import videojs from 'video.js'
import { onBeforeUnmount, onMounted, toRefs, useTemplateRef } from 'vue'

import 'video.js/dist/video-js.css'

export interface Props {
  poster: string | undefined
  source: string | undefined
  autoplay?: boolean
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  autoplay: true,
  title: undefined
})
const { poster, source, autoplay, title } = toRefs(props)

const emit = defineEmits<{
  (e: 'ended'): void
}>()

const videoElement = useTemplateRef('videoElement')

// TODO(jordan): fix typing once video.js is updated.
// ref: https://github.com/videojs/video.js/issues/8242
let player: ReturnType<typeof videojs> | undefined = undefined

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
  }
})

onBeforeUnmount(() => {
  if (player) {
    player.dispose()
  }
})
</script>
