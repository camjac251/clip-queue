<template>
  <ClipPlayer
    v-if="queue.current && queue.current.id"
    :key="toClipUUID(queue.current)"
    :clip="queue.current"
    :previous-disabled="queue.history.size() === 0"
    @previous="handlePrevious()"
    @next="handleNext()"
  />
  <Message v-else-if="settings.queue.providers.length === 0" severity="error">
    <template #icon>
      <i class="pi pi-exclamation-circle"></i>
    </template>
    <span>{{ m.message_no_clip_providers_enabled() }}</span>
  </Message>
  <ClipQueue
    :title="m.upcoming_clips()"
    :clips="queue.upcoming.toArray()"
    :is-open="queue.isOpen"
    @open="queue.open()"
    @close="queue.close()"
    @remove="handleRemove"
    @play="handlePlay"
    @clear="handleClear()"
  />
</template>

<script setup lang="ts">
import type { Clip } from '@cq/providers'
import { toClipUUID } from '@cq/providers'
import { Message } from '@cq/ui'

import ClipPlayer from '@/components/ClipPlayer.vue'
import ClipQueue from '@/components/ClipQueue.vue'
import * as m from '@/paraglide/messages'
import { useLogger } from '@/stores/logger'
import { useQueueServer as useQueue } from '@/stores/queue-server'
import { useSettings } from '@/stores/settings'

const queue = useQueue()
const settings = useSettings()
const logger = useLogger()

async function handlePrevious() {
  try {
    await queue.previous()
  } catch (error) {
    logger.error(`[Queue]: Failed to go to previous clip: ${error}`)
  }
}

async function handleNext() {
  try {
    await queue.next()
  } catch (error) {
    logger.error(`[Queue]: Failed to advance to next clip: ${error}`)
  }
}

async function handleRemove(clip: Clip) {
  try {
    await queue.remove(toClipUUID(clip))
  } catch (error) {
    logger.error(`[Queue]: Failed to remove clip: ${error}`)
  }
}

async function handlePlay(clip: Clip) {
  try {
    await queue.play(toClipUUID(clip))
  } catch (error) {
    logger.error(`[Queue]: Failed to play clip: ${error}`)
  }
}

async function handleClear() {
  try {
    await queue.clear()
  } catch (error) {
    logger.error(`[Queue]: Failed to clear queue: ${error}`)
  }
}
</script>
