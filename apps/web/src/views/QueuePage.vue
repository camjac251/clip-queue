<template>
  <div class="queue-page">
    <!-- Main Player Section -->
    <div class="player-container">
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

      <!-- Player Info and Controls -->
      <div class="player-info">
        <div class="info-content">
          <div class="clip-details">
            <h1 v-if="queue.current && queue.current.id" class="clip-title">
              {{ queue.current.title }}
              <a
                v-if="queue.current.url"
                :href="queue.current.url"
                target="_blank"
                rel="noreferrer"
                class="external-link"
              >
                <i class="pi pi-external-link"></i>
              </a>
            </h1>
            <div v-if="queue.current && queue.current.id" class="clip-metadata">
              <PlatformName :platform="queue.current.platform" />
              <span class="metadata-separator">•</span>
              <span>{{ queue.current.channel }}</span>
              <span v-if="queue.current.category" class="metadata-separator">•</span>
              <span v-if="queue.current.category">{{ queue.current.category }}</span>
              <span v-if="queue.current.creator" class="metadata-separator">•</span>
              <span v-if="queue.current.creator" class="metadata-creator">
                {{ m.creator_name({ name: queue.current.creator }) }}
              </span>
              <span v-if="queue.current.submitters[0]" class="metadata-separator">•</span>
              <span v-if="queue.current.submitters[0]" class="metadata-submitter">
                {{ m.submitter_name({ name: queue.current.submitters[0] }) }}
              </span>
            </div>
          </div>

          <!-- Controls -->
          <div v-if="user.canControlQueue" class="player-controls">
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
                size="large"
                :disabled="queue.history.size() === 0"
                @click="handlePrevious()"
              />
              <SecondaryButton
                v-tooltip.bottom="m.next()"
                icon="pi pi-forward"
                text
                rounded
                size="large"
                @click="handleNext()"
              />
            </div>
            <div class="button-separator"></div>
            <div class="queue-management">
              <SecondaryButton
                v-if="user.isBroadcaster"
                :icon="queue.isOpen ? 'pi pi-lock' : 'pi pi-lock-open'"
                :label="queue.isOpen ? m.close() : m.open()"
                :severity="queue.isOpen ? 'danger' : 'success'"
                size="small"
                @click="queue.isOpen ? handleClose() : handleOpen()"
              />
              <SecondaryButton
                v-if="user.isBroadcaster"
                icon="pi pi-trash"
                :label="m.clear()"
                severity="danger"
                size="small"
                :disabled="queue.upcoming.size() === 0"
                @click="handleClear()"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Timeline View -->
    <TimelineView
      :current-clip="queue.current"
      :history-clips="queue.history.toArray().slice().reverse()"
      :upcoming-clips="queue.upcoming.toArray()"
      :can-control="user.canControlQueue"
      @replay="handleReplay"
      @play="handlePlay"
    />

    <!-- Queue Stats Footer -->
    <div class="queue-stats">
      <div class="stat-item">
        <i class="pi pi-history stat-icon"></i>
        <span class="stat-label">{{ m.history() }}</span>
        <span class="stat-value">{{ queue.history.size() }}</span>
      </div>
      <div class="stat-separator"></div>
      <div class="stat-item">
        <i class="pi pi-clock stat-icon"></i>
        <span class="stat-label">{{ m.upcoming_clips() }}</span>
        <span class="stat-value">{{ queue.upcoming.size() }}</span>
      </div>
      <div class="stat-separator"></div>
      <div class="stat-item">
        <i class="pi pi-info-circle stat-icon"></i>
        <span class="stat-label">{{ m.queue() }}</span>
        <span class="stat-value">{{ queue.isOpen ? m.open() : m.close() }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Clip } from '@cq/platforms'
import { toClipUUID } from '@cq/platforms'
import { SecondaryButton, ToggleSwitch } from '@cq/ui'

import ClipPlayer from '@/components/ClipPlayer.vue'
import PlatformName from '@/components/PlatformName.vue'
import TimelineView from '@/components/TimelineView.vue'
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

async function handleReplay(clip: Clip) {
  try {
    await queue.replayFromHistory(toClipUUID(clip))
    logger.info(`[Queue]: Replaying clip from history: ${clip.title}`)
  } catch (error) {
    logger.error(`[Queue]: Failed to replay clip: ${error}`)
  }
}

async function handlePlay(clip: Clip) {
  try {
    await queue.play(toClipUUID(clip))
    logger.info(`[Queue]: Playing clip from queue: ${clip.title}`)
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

async function handleOpen() {
  try {
    await queue.open()
  } catch (error) {
    logger.error(`[Queue]: Failed to open queue: ${error}`)
  }
}

async function handleClose() {
  try {
    await queue.close()
  } catch (error) {
    logger.error(`[Queue]: Failed to close queue: ${error}`)
  }
}
</script>

<style scoped>
.queue-page {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 2rem;
  max-width: 1920px;
  margin: 0 auto;
  min-height: 100vh;
  background: linear-gradient(to bottom, rgb(9 9 11) 0%, rgb(24 24 27) 100%);
}

/* Player Container */
.player-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.player-wrapper {
  position: relative;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  background: linear-gradient(to bottom, rgb(0 0 0 / 0.95), rgb(0 0 0 / 0.98));
  border-radius: 1rem;
  overflow: hidden;
  box-shadow:
    0 20px 25px -5px rgb(0 0 0 / 0.3),
    0 8px 10px -6px rgb(0 0 0 / 0.3),
    0 0 0 1px rgb(255 255 255 / 0.05),
    0 0 40px rgb(139 92 246 / 0.1);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 500px;
  aspect-ratio: 16 / 9;
  color: rgb(161 161 170);
  background: linear-gradient(135deg, rgb(24 24 27 / 0.8) 0%, rgb(39 39 42 / 0.6) 100%);
}

.empty-state-icon {
  font-size: 5rem;
  margin-bottom: 1.5rem;
  opacity: 0.5;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 0.8;
  }
}

.empty-state-text {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.75rem 0;
  color: rgb(228 228 231);
}

.empty-state-subtext {
  font-size: 1rem;
  margin: 0;
  opacity: 0.7;
}

/* Player Info */
.player-info {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.info-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 2rem;
  padding: 1.5rem;
  background: rgb(24 24 27 / 0.6);
  border-radius: 0.75rem;
  border: 1px solid rgb(63 63 70 / 0.5);
  backdrop-filter: blur(8px);
}

.clip-details {
  flex: 1;
  min-width: 0;
}

.clip-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0 0 0.75rem 0;
  color: rgb(244 244 245);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  line-height: 1.2;
}

.external-link {
  color: rgb(161 161 170);
  text-decoration: none;
  font-size: 1.25rem;
  transition: color 0.2s ease;
}

.external-link:hover {
  color: rgb(139 92 246);
}

.clip-metadata {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  font-size: 0.875rem;
  color: rgb(161 161 170);
}

.metadata-separator {
  color: rgb(82 82 91);
}

.metadata-creator {
  color: rgb(139 92 246);
  font-weight: 500;
}

.metadata-submitter {
  color: rgb(168 85 247);
  font-weight: 500;
}

/* Player Controls */
.player-controls {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1rem 1.5rem;
  background: rgb(39 39 42 / 0.6);
  border-radius: 0.75rem;
  border: 1px solid rgb(63 63 70 / 0.5);
  backdrop-filter: blur(8px);
}

.autoplay-control {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.autoplay-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(212 212 216);
  user-select: none;
  cursor: pointer;
  white-space: nowrap;
}

.button-separator {
  width: 1px;
  height: 2rem;
  background: rgb(82 82 91 / 0.5);
}

.navigation-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.queue-management {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: auto;
}

/* Queue Stats */
.queue-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  padding: 1.5rem;
  background: rgb(24 24 27 / 0.6);
  border-radius: 0.75rem;
  border: 1px solid rgb(63 63 70 / 0.5);
  backdrop-filter: blur(8px);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.stat-icon {
  font-size: 1.25rem;
  color: rgb(139 92 246);
}

.stat-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(161 161 170);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: rgb(228 228 231);
}

.stat-separator {
  width: 1px;
  height: 2rem;
  background: rgb(82 82 91 / 0.5);
}

/* Responsive Design */
@media (max-width: 1200px) {
  .info-content {
    flex-direction: column;
    gap: 1.5rem;
  }

  .player-controls {
    width: 100%;
    justify-content: space-between;
  }

  .queue-management {
    margin-left: 0;
  }
}

@media (max-width: 768px) {
  .queue-page {
    padding: 1rem;
    gap: 1.5rem;
  }

  .player-wrapper {
    border-radius: 0.75rem;
  }

  .clip-title {
    font-size: 1.25rem;
  }

  .player-controls {
    flex-wrap: wrap;
    padding: 1rem;
  }

  .button-separator {
    display: none;
  }

  .autoplay-control,
  .navigation-controls,
  .queue-management {
    width: 100%;
    justify-content: center;
  }

  .queue-stats {
    flex-direction: column;
    gap: 1rem;
  }

  .stat-separator {
    display: none;
  }
}

@media (max-width: 480px) {
  .clip-metadata {
    font-size: 0.75rem;
  }

  .stat-label {
    font-size: 0.75rem;
  }

  .stat-value {
    font-size: 1rem;
  }
}
</style>
