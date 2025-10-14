<template>
  <div class="bg-background flex min-h-screen flex-col">
    <!-- Player Section -->
    <div class="relative w-full bg-black">
      <div class="mx-auto aspect-video w-full max-w-[1920px]">
        <ClipPlayer
          v-if="queue.current && queue.current.id"
          ref="clipPlayerRef"
          :key="toClipUUID(queue.current)"
          :clip="queue.current"
          :autoplay="preferences.preferences.autoplay"
          @ended="handleNext()"
        />
        <div
          v-else-if="settings.queue.platforms.length === 0"
          class="text-muted-foreground flex h-full w-full flex-col items-center justify-center bg-black px-4"
        >
          <div class="mb-4 sm:mb-6">
            <StatusAlertCircle
              class="animate-[pulse_2s_ease-in-out_infinite] opacity-50 sm:hidden"
              :size="60"
            />
            <StatusAlertCircle
              class="hidden animate-[pulse_2s_ease-in-out_infinite] opacity-50 sm:block"
              :size="80"
            />
          </div>
          <p
            class="text-foreground m-0 mb-2 text-center text-lg font-bold sm:mb-3 sm:text-xl lg:text-2xl"
          >
            {{ m.message_no_clip_platforms_enabled() }}
          </p>
        </div>
        <div
          v-else
          class="text-muted-foreground flex h-full w-full flex-col items-center justify-center bg-black px-4"
        >
          <div class="mb-4 sm:mb-6">
            <ActionPlayCircle
              class="animate-[pulse_2s_ease-in-out_infinite] opacity-50 sm:hidden"
              :size="60"
            />
            <ActionPlayCircle
              class="hidden animate-[pulse_2s_ease-in-out_infinite] opacity-50 sm:block"
              :size="80"
            />
          </div>
          <p
            class="text-foreground m-0 mb-2 text-center text-lg font-bold sm:mb-3 sm:text-xl lg:text-2xl"
          >
            {{ m.queue() }} {{ queue.isOpen ? m.open() : m.closed() }}
          </p>
          <p class="m-0 text-center text-sm opacity-70 sm:text-base">
            {{
              queue.upcoming.size() > 0
                ? `${queue.upcoming.size()} clips waiting`
                : 'No clips in queue'
            }}
          </p>
        </div>
      </div>
    </div>

    <!-- Control Panel -->
    <div class="border-border bg-card border-b shadow-sm">
      <div class="mx-auto max-w-[1920px] px-4 py-2.5 sm:px-6 sm:py-3">
        <!-- Progress Bar -->
        <div class="mb-3 flex flex-col gap-1">
          <Slider
            :model-value="currentTime"
            :max="duration"
            :step="0.016"
            class="w-full"
            @update:model-value="handleSeek"
          />
          <div class="text-muted-foreground flex justify-between text-[10px] font-medium">
            <span>{{ formatTime(currentTime) }}</span>
            <span>{{ formatTime(duration) }}</span>
          </div>
        </div>

        <!-- Controls Container -->
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          <!-- Left: Transport Controls -->
          <div class="flex items-center justify-center gap-1 lg:justify-start">
            <Button
              v-if="user.canControlQueue"
              variant="ghost"
              size="icon"
              class="h-9 w-9 shrink-0"
              :disabled="queue.history.size() === 0"
              :aria-label="m.previous()"
              @click="handlePrevious()"
            >
              <ActionSkipBack :size="20" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="h-11 w-11 shrink-0"
              :aria-label="isPlaying ? 'Pause' : 'Play'"
              @click="togglePlayPause"
            >
              <template v-if="isPlaying">
                <ActionPause :size="26" class="text-primary" />
              </template>
              <template v-else>
                <ActionPlay :size="26" class="text-primary" />
              </template>
            </Button>
            <Button
              v-if="user.canControlQueue"
              variant="ghost"
              size="icon"
              class="h-9 w-9 shrink-0"
              :aria-label="m.next()"
              @click="handleNext()"
            >
              <ActionSkipForward :size="20" />
            </Button>
          </div>

          <!-- Center: Volume Controls -->
          <div class="flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              class="h-9 w-9 shrink-0"
              :aria-label="isMuted ? 'Unmute' : 'Mute'"
              @click="toggleMute"
            >
              <template v-if="isMuted">
                <MediaVolumeMute :size="20" />
              </template>
              <template v-else>
                <MediaVolume :size="20" />
              </template>
            </Button>
            <Slider
              :model-value="volume"
              :max="100"
              :step="1"
              class="w-20 sm:w-24"
              @update:model-value="handleVolumeChange"
            />
            <span class="text-muted-foreground min-w-[2.5ch] text-xs font-medium">{{
              volume
            }}</span>
          </div>

          <!-- Right: Queue Controls -->
          <div class="flex flex-wrap items-center justify-center gap-2 lg:justify-end">
            <div
              v-if="user.canControlQueue"
              class="border-border bg-muted/30 flex items-center gap-1.5 rounded-md border px-2.5 py-1.5"
            >
              <Switch
                id="autoplay-controls"
                v-model="preferences.preferences.autoplay"
                class="scale-90"
              />
              <label
                for="autoplay-controls"
                class="text-foreground cursor-pointer text-xs font-medium select-none"
              >
                {{ m.autoplay() }}
              </label>
            </div>
            <div v-if="user.isBroadcaster" class="flex items-center gap-1.5">
              <Button
                :variant="queue.isOpen ? 'destructive' : 'default'"
                size="sm"
                class="h-8 gap-1.5 px-2.5 text-xs font-medium"
                @click="queue.isOpen ? handleClose() : handleOpen()"
              >
                <template v-if="queue.isOpen">
                  <StatusLock :size="14" />
                </template>
                <template v-else>
                  <StatusLockOpen :size="14" />
                </template>
                <span class="inline-block min-w-[3.5rem]">{{
                  queue.isOpen ? m.close() : m.open()
                }}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                class="h-8 w-8 shrink-0 p-0"
                :disabled="queue.upcoming.size() === 0"
                :aria-label="m.clear()"
                @click="handleClear()"
              >
                <ActionTrash :size="14" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Content Area -->
    <div class="flex-1 overflow-y-auto">
      <div
        class="mx-auto max-w-[1920px] space-y-3 px-3 py-3 sm:space-y-4 sm:px-6 sm:py-4 lg:space-y-6 lg:py-6"
      >
        <!-- Player Info -->
        <PlayerInfo v-if="queue.current && queue.current.id" :clip="queue.current" />

        <!-- Timeline -->
        <TimelineView
          :current-clip="queue.current"
          :history-clips="queue.history.toArray().slice().reverse()"
          :upcoming-clips="queue.upcoming.toArray()"
          :can-control="user.canControlQueue"
          @replay="handleReplay"
          @play="handlePlay"
        />

        <!-- Queue Stats -->
        <div
          class="border-border bg-card flex flex-wrap items-center justify-center gap-3 rounded-lg border p-3 text-center sm:gap-4 sm:p-4 md:gap-6 lg:gap-8"
        >
          <div class="flex items-center gap-1.5 sm:gap-2">
            <NavHistory :size="16" class="text-violet-600 sm:hidden dark:text-violet-500" />
            <NavHistory :size="18" class="hidden text-violet-600 sm:block dark:text-violet-500" />
            <span
              class="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase sm:text-xs"
            >
              {{ m.history() }}
            </span>
            <span class="text-foreground text-base font-bold sm:text-lg">{{
              queue.history.size()
            }}</span>
          </div>
          <Separator orientation="vertical" class="h-4 sm:h-5 lg:h-6" />
          <div class="flex items-center gap-1.5 sm:gap-2">
            <StatusClock :size="16" class="text-violet-600 sm:hidden dark:text-violet-500" />
            <StatusClock :size="18" class="hidden text-violet-600 sm:block dark:text-violet-500" />
            <span
              class="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase sm:text-xs"
            >
              {{ m.upcoming_clips() }}
            </span>
            <span class="text-foreground text-base font-bold sm:text-lg">{{
              queue.upcoming.size()
            }}</span>
          </div>
          <Separator orientation="vertical" class="h-4 sm:h-5 lg:h-6" />
          <div class="flex items-center gap-1.5 sm:gap-2">
            <NavInfo :size="16" class="text-violet-600 sm:hidden dark:text-violet-500" />
            <NavInfo :size="18" class="hidden text-violet-600 sm:block dark:text-violet-500" />
            <span
              class="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase sm:text-xs"
            >
              {{ m.queue() }}
            </span>
            <span
              class="text-foreground inline-block min-w-[4.5rem] text-base font-bold sm:text-lg"
            >
              {{ queue.isOpen ? m.open() : m.closed() }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import type { Clip } from '@cq/platforms'
import { toClipUUID } from '@cq/platforms'
import { Button, Separator, Slider, Switch } from '@cq/ui'

import ClipPlayer from '@/components/ClipPlayer.vue'
import PlayerInfo from '@/components/PlayerInfo.vue'
import TimelineView from '@/components/TimelineView.vue'
import {
  ActionPause,
  ActionPlay,
  ActionPlayCircle,
  ActionSkipBack,
  ActionSkipForward,
  ActionTrash,
  MediaVolume,
  MediaVolumeMute,
  NavHistory,
  NavInfo,
  StatusAlertCircle,
  StatusClock,
  StatusLock,
  StatusLockOpen
} from '@/composables/icons'
import { useKeydown } from '@/composables/keydown'
import { usePlayerState } from '@/composables/player-state'
import * as m from '@/paraglide/messages'
import { useLogger } from '@/stores/logger'
import { usePreferences } from '@/stores/preferences'
import { useQueueServer as useQueue } from '@/stores/queue-server'
import { useSettings } from '@/stores/settings'
import { useUser } from '@/stores/user'

const clipPlayerRef = ref<InstanceType<typeof ClipPlayer> | null>(null)

// Player state management
const {
  currentTime,
  duration,
  volume,
  isPlaying,
  isMuted,
  togglePlayPause,
  toggleMute,
  seek: playerSeek,
  setVolume: playerSetVolume
} = usePlayerState(clipPlayerRef)

// Wrapper functions for slider value handling
function handleSeek(value: number | number[] | undefined) {
  if (value === undefined) return
  const time = Array.isArray(value) ? value[0] : value
  if (time !== undefined) {
    playerSeek(time)
  }
}

function handleVolumeChange(value: number | number[] | undefined) {
  if (value === undefined) return
  const vol = Array.isArray(value) ? value[0] : value
  if (vol !== undefined) {
    playerSetVolume(vol)
  }
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

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
