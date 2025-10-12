<template>
  <div class="grid-container">
    <div class="player-section">
      <div class="player-wrapper">
        <ClipPlayer
          v-if="queue.current && queue.current.id"
          :key="toClipUUID(queue.current)"
          :clip="queue.current"
          @ended="handleNext()"
        />
        <div v-else-if="settings.queue.platforms.length === 0" class="empty-state">
          <i class="pi pi-exclamation-circle empty-state-icon"></i>
          <p class="empty-state-text">{{ m.message_no_clip_platforms_enabled() }}</p>
        </div>
        <div v-else class="empty-state">
          <i class="pi pi-play-circle empty-state-icon"></i>
          <p class="empty-state-text">{{ m.queue() }} {{ queue.isOpen ? m.open() : m.close() }}</p>
          <p class="empty-state-subtext">
            {{
              queue.upcoming.size() > 0
                ? `${queue.upcoming.size()} clips waiting`
                : 'No clips in queue'
            }}
          </p>
        </div>
      </div>

      <div class="mt-2">
        <div class="flex items-center justify-between">
          <div
            v-if="queue.current && queue.current.id"
            class="text-surface-500 flex items-center gap-2 text-2xl font-bold"
          >
            <span>{{ queue.current.title }}</span>
            <a
              v-if="queue.current.url"
              :href="queue.current.url"
              target="_blank"
              rel="noreferrer"
              class="hover:text-surface-600 dark:hover:text-surface-200 text-base no-underline"
            >
              <i class="pi pi-external-link"></i>
            </a>
          </div>
          <div v-if="user.canControlQueue" class="control-buttons">
            <div class="autoplay-control">
              <ToggleSwitch v-model="preferences.preferences.autoplay" input-id="autoplay" />
              <label for="autoplay" class="autoplay-label">{{ m.autoplay() }}</label>
            </div>
            <div class="button-separator"></div>
            <div class="navigation-controls">
              <SecondaryButton
                v-tooltip.bottom="m.previous()"
                icon="pi pi-backward"
                text
                rounded
                :disabled="queue.history.size() === 0"
                @click="handlePrevious()"
              />
              <SecondaryButton
                v-tooltip.bottom="m.next()"
                icon="pi pi-forward"
                text
                rounded
                @click="handleNext()"
              />
            </div>
          </div>
        </div>
        <div
          v-if="queue.current && queue.current.id"
          class="text-surface-400 flex flex-col gap-1 text-sm font-normal"
        >
          <span>
            {{ queue.current.channel }}
            <span v-if="queue.current.category"> - {{ queue.current.category }} </span>
            <span v-if="queue.current.creator">
              - {{ m.creator_name({ name: queue.current.creator }) }}</span
            >
            <span v-if="queue.current.submitters[0]">
              - {{ m.submitter_name({ name: queue.current.submitters[0] }) }}</span
            >
          </span>
          <PlatformName :platform="queue.current.platform" />
        </div>
      </div>
    </div>

    <div class="queue-section">
      <ClipQueue
        :title="m.upcoming_clips()"
        :clips="queue.upcoming.toArray()"
        :is-open="queue.isOpen"
        :can-control="user.canControlQueue"
        :can-manage="user.isBroadcaster"
        @open="queue.open()"
        @close="queue.close()"
        @remove="handleRemove"
        @play="handlePlay"
        @clear="handleClear()"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Clip } from '@cq/platforms'
import { toClipUUID } from '@cq/platforms'
import { SecondaryButton, ToggleSwitch } from '@cq/ui'

import ClipPlayer from '@/components/ClipPlayer.vue'
import ClipQueue from '@/components/ClipQueue.vue'
import PlatformName from '@/components/PlatformName.vue'
import { useKeydown } from '@/composables/keydown'
import * as m from '@/paraglide/messages'
import { useLogger } from '@/stores/logger'
import { usePreferences } from '@/stores/preferences'
import { useQueueServer as useQueue } from '@/stores/queue-server'
import { useSettings } from '@/stores/settings'
import { useUser } from '@/stores/user'

const queue = useQueue()
const settings = useSettings()
const logger = useLogger()
const user = useUser()
const preferences = usePreferences()

useKeydown((event) => {
  // Check permissions before handling keyboard shortcuts
  if (!user.canControlQueue) return

  if (event.key === 'ArrowLeft') {
    logger.debug('[Queue]: left arrow pressed.')
    handlePrevious()
  } else if (event.key === 'ArrowRight') {
    logger.debug('[Queue]: right arrow pressed.')
    handleNext()
  }
})

async function handlePrevious() {
  try {
    await queue.previous()
  } catch (error) {
    logger.error(`[Queue]: Failed to go to previous clip: ${error}`)
  }
}

async function handleNext() {
  try {
    await queue.advance()
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

<style scoped>
.grid-container {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 1.5rem;
  padding: 1.5rem;
  height: 100vh;
}

.player-section {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.player-wrapper {
  position: relative;
  background: linear-gradient(to bottom, rgb(0 0 0 / 0.95), rgb(0 0 0 / 0.98));
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.1),
    0 2px 4px -2px rgb(0 0 0 / 0.1),
    0 0 0 1px rgb(255 255 255 / 0.05);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  aspect-ratio: 16 / 9;
  color: rgb(161 161 170);
  background: linear-gradient(135deg, rgb(24 24 27 / 0.8) 0%, rgb(39 39 42 / 0.6) 100%);
}

.empty-state-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.6;
}

.empty-state-text {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: rgb(212 212 216);
}

.empty-state-subtext {
  font-size: 0.875rem;
  margin: 0;
  opacity: 0.7;
}

.control-buttons {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0.75rem;
  background: rgb(39 39 42 / 0.5);
  border-radius: 0.5rem;
  backdrop-filter: blur(8px);
}

.autoplay-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.autoplay-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(212 212 216);
  user-select: none;
  cursor: pointer;
}

.button-separator {
  width: 1px;
  height: 1.5rem;
  background: rgb(82 82 91 / 0.5);
}

.navigation-controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.queue-section {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  max-height: calc(100vh - 3rem);
  background: rgb(24 24 27 / 0.4);
  border-radius: 0.75rem;
  padding: 1rem;
  border: 1px solid rgb(63 63 70 / 0.3);
}

@media (max-width: 1024px) {
  .grid-container {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
    gap: 1rem;
    padding: 1rem;
  }

  .queue-section {
    max-height: none;
  }

  .control-buttons {
    flex-wrap: wrap;
  }
}
</style>
