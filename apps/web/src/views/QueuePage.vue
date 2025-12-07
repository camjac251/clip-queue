<template>
  <div class="bg-background flex h-dvh flex-col overflow-hidden">
    <!-- Player Section - Takes remaining space -->
    <div class="relative min-h-0 flex-1 bg-black">
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="relative aspect-video h-full max-h-full w-full max-w-[calc(100dvh*16/9)]">
          <!-- Player content -->
          <ClipPlayer
            v-if="queue.current && queue.current.id"
            ref="clipPlayerRef"
            :key="toClipUUID(queue.current)"
            :clip="queue.current"
            :autoplay="preferences.preferences.autoplay"
            @ended="handleNext()"
          />

          <!-- Empty state: No platforms enabled -->
          <div
            v-else-if="settings.queue.platforms.length === 0"
            class="flex h-full w-full flex-col items-center justify-center px-4"
          >
            <div
              class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10"
            >
              <StatusAlertCircle class="h-8 w-8 text-amber-500" />
            </div>
            <h2 class="mb-2 text-center text-lg font-bold text-white">
              {{ m.message_no_clip_platforms_enabled() }}
            </h2>
            <p class="max-w-md text-center text-sm text-white/60">
              Enable at least one platform in settings
            </p>
          </div>

          <!-- Empty state: Queue ready -->
          <div v-else class="flex h-full w-full flex-col items-center justify-center px-4">
            <div
              class="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
              :class="queue.isOpen ? 'bg-brand/10' : 'bg-muted'"
            >
              <ActionPlayCircle
                class="h-8 w-8"
                :class="queue.isOpen ? 'text-brand' : 'text-muted-foreground'"
              />
            </div>
            <Badge
              :variant="queue.isOpen ? 'default' : 'secondary'"
              class="mb-2 px-3 py-1 text-sm font-semibold tracking-wide uppercase"
              :class="queue.isOpen && 'bg-brand text-brand-foreground'"
            >
              {{ m.queue() }} {{ queue.isOpen ? m.open() : m.closed() }}
            </Badge>
            <p class="text-sm text-white/60">
              {{
                queue.upcoming.size() > 0
                  ? `${queue.upcoming.size()} clips waiting`
                  : 'Waiting for clips...'
              }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Info Bar - Compact single row -->
    <div
      v-if="queue.current && queue.current.id"
      class="border-border/50 bg-card/90 flex flex-shrink-0 items-center gap-3 border-t px-3 py-1.5 backdrop-blur-sm"
    >
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <h2 class="text-foreground truncate text-sm font-semibold">
            {{ queue.current.title }}
          </h2>
          <a
            v-if="queue.current.url"
            :href="queue.current.url"
            target="_blank"
            rel="noreferrer"
            class="text-muted-foreground hover:text-brand flex-shrink-0 transition-colors"
            aria-label="Open in new tab"
          >
            <ActionExternalLink class="h-3.5 w-3.5" />
          </a>
        </div>
        <div class="text-muted-foreground flex items-center gap-2 text-xs">
          <PlatformName :platform="queue.current.platform" size="small" />
          <span class="text-border">|</span>
          <span>{{ queue.current.channel }}</span>
          <template v-if="queue.current.category">
            <span class="text-border hidden sm:inline">|</span>
            <span class="hidden sm:inline">{{ queue.current.category }}</span>
          </template>
        </div>
      </div>
      <div class="flex flex-shrink-0 items-center gap-2">
        <Badge v-if="queue.current.creator" variant="outline" class="gap-1 py-0.5 text-xs">
          <UiCircle class="fill-brand text-brand h-1.5 w-1.5" />
          {{ queue.current.creator }}
        </Badge>
        <Badge
          v-if="queue.current.submitters[0]"
          variant="secondary"
          class="bg-brand/10 text-brand py-0.5 text-xs"
        >
          {{ queue.current.submitters[0] }}
        </Badge>
      </div>
    </div>

    <!-- Control Bar - Compact single row -->
    <div class="border-border/50 bg-card/80 flex-shrink-0 border-t backdrop-blur-sm">
      <div class="flex items-center gap-3 px-3 py-2">
        <!-- Progress Slider -->
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <span class="text-foreground w-10 text-right text-xs font-medium tabular-nums">
            {{ formatTime(currentTime) }}
          </span>
          <Slider
            :model-value="currentTime"
            :max="duration"
            :step="0.016"
            class="flex-1"
            @update:model-value="handleSeek"
          />
          <span class="text-muted-foreground w-10 text-xs font-medium tabular-nums">
            {{ formatTime(duration) }}
          </span>
        </div>

        <!-- Transport Controls -->
        <div class="flex flex-shrink-0 items-center gap-1">
          <Button
            v-if="user.canControlQueue"
            variant="ghost"
            size="icon-sm"
            class="h-8 w-8 rounded-full"
            :disabled="queue.playHistory.length === 0"
            :aria-label="m.previous()"
            @click="handlePrevious()"
          >
            <ActionSkipBack class="h-4 w-4" />
          </Button>

          <Button
            :variant="isPlaying ? 'secondary' : 'brand'"
            size="icon"
            class="h-10 w-10 rounded-full shadow-md"
            :class="!isPlaying && 'shadow-brand/30'"
            :aria-label="isPlaying ? 'Pause' : 'Play'"
            @click="togglePlayPause"
          >
            <ActionPause v-if="isPlaying" class="h-5 w-5" />
            <ActionPlay v-else class="h-5 w-5" />
          </Button>

          <Button
            v-if="user.canControlQueue"
            variant="ghost"
            size="icon-sm"
            class="h-8 w-8 rounded-full"
            :aria-label="m.next()"
            @click="handleNext()"
          >
            <ActionSkipForward class="h-4 w-4" />
          </Button>
        </div>

        <!-- Volume Controls -->
        <div class="hidden flex-shrink-0 items-center gap-2 sm:flex">
          <Button
            variant="ghost"
            size="icon-sm"
            class="h-8 w-8 rounded-full"
            :aria-label="isMuted ? 'Unmute' : 'Mute'"
            @click="toggleMute"
          >
            <MediaVolumeMute v-if="isMuted" class="h-4 w-4" />
            <MediaVolume v-else class="h-4 w-4" />
          </Button>
          <Slider
            :model-value="volume"
            :max="100"
            :step="1"
            class="w-20"
            @update:model-value="handleVolumeChange"
          />
        </div>

        <!-- Queue Controls -->
        <div class="flex flex-shrink-0 items-center gap-2">
          <div
            v-if="user.canControlQueue"
            class="border-border bg-card/50 hidden items-center gap-1.5 rounded-full border px-2 py-1 sm:flex"
          >
            <Switch
              id="autoplay-controls"
              v-model="preferences.preferences.autoplay"
              class="scale-75"
            />
            <label
              for="autoplay-controls"
              class="text-foreground cursor-pointer text-xs font-medium select-none"
            >
              {{ m.autoplay() }}
            </label>
          </div>

          <Button
            v-if="user.isBroadcaster"
            variant="outline"
            size="icon-sm"
            class="h-8 w-8 rounded-full"
            :disabled="queue.upcoming.size() === 0"
            :aria-label="m.clear()"
            @click="handleClear()"
          >
            <ActionTrash class="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Timeline + Stats - Compact combined section -->
    <div class="border-border/50 bg-card/50 flex-shrink-0 border-t backdrop-blur-sm">
      <!-- Stats Row - Inline compact -->
      <div class="border-border/30 flex items-center justify-between border-b px-3 py-1">
        <div class="text-muted-foreground flex items-center gap-1 text-xs">
          <NavHistory class="h-3.5 w-3.5" />
          <span class="font-semibold tabular-nums">{{ queue.playHistory.length }}</span>
          <span class="hidden sm:inline">{{ m.history() }}</span>
        </div>
        <div class="flex items-center gap-1">
          <StatusLockOpen v-if="queue.isOpen" class="h-3.5 w-3.5 text-emerald-500" />
          <StatusLock v-else class="h-3.5 w-3.5 text-amber-500" />
          <span
            class="text-xs font-semibold"
            :class="queue.isOpen ? 'text-emerald-500' : 'text-amber-500'"
          >
            {{ m.queue() }} {{ queue.isOpen ? m.open() : m.closed() }}
          </span>
        </div>
        <div class="text-muted-foreground flex items-center gap-1 text-xs">
          <span class="hidden sm:inline">{{ m.upcoming_clips() }}</span>
          <span class="font-semibold tabular-nums">{{ queue.upcoming.size() }}</span>
          <StatusClock class="h-3.5 w-3.5" />
        </div>
      </div>

      <!-- Timeline - Compact -->
      <TimelineView
        :current-clip="queue.current"
        :history-clips="
          queue.playHistory
            .map((entry) => entry.clip)
            .slice()
            .reverse()
        "
        :upcoming-clips="queue.upcoming.toArray()"
        :can-control="user.canControlQueue"
        :is-navigating-history="queue.isNavigatingHistory"
        compact
        @replay="handleReplay"
        @play="handlePlay"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMagicKeys, whenever } from '@vueuse/core'
import { ref } from 'vue'

import type { Clip } from '@cq/platforms'
import { toClipUUID } from '@cq/platforms'
import { Badge, Button, Slider, Switch } from '@cq/ui'

import ClipPlayer from '@/components/ClipPlayer.vue'
import PlatformName from '@/components/PlatformName.vue'
import TimelineView from '@/components/TimelineView.vue'
import {
  ActionExternalLink,
  ActionPause,
  ActionPlay,
  ActionPlayCircle,
  ActionSkipBack,
  ActionSkipForward,
  ActionTrash,
  MediaVolume,
  MediaVolumeMute,
  NavHistory,
  StatusAlertCircle,
  StatusClock,
  StatusLock,
  StatusLockOpen,
  UiCircle
} from '@/composables/icons'
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

// Keyboard shortcuts
const keys = useMagicKeys()

// Navigation shortcuts (moderator only)
whenever(keys.ArrowLeft!, () => {
  if (!user.canControlQueue) return
  logger.debug('[Queue]: left arrow pressed.')
  handlePrevious()
})

whenever(keys.ArrowRight!, () => {
  if (!user.canControlQueue) return
  logger.debug('[Queue]: right arrow pressed.')
  handleNext()
})

// Player shortcuts (available to all users)
whenever(keys.Space!, () => {
  if (!queue.current) return
  logger.debug('[Queue]: space pressed - toggling play/pause.')
  togglePlayPause()
})

whenever(keys.m!, () => {
  if (!queue.current) return
  logger.debug('[Queue]: M pressed - toggling mute.')
  toggleMute()
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
</script>
