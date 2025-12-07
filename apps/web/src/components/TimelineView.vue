<template>
  <div :class="compact ? 'p-2' : 'border-border bg-card rounded-lg border p-2 sm:p-3 lg:p-4'">
    <!-- Header (hidden in compact mode - stats shown externally) -->
    <div
      v-if="!compact"
      class="mb-2 grid grid-cols-3 items-center gap-2 text-center sm:mb-3 sm:gap-4 lg:mb-4"
    >
      <div
        class="text-muted-foreground flex items-center justify-start gap-1 text-[10px] font-semibold tracking-wide uppercase sm:gap-1.5 sm:text-xs"
      >
        <NavHistory :size="12" class="sm:hidden" />
        <NavHistory :size="14" class="hidden sm:block" />
        <span class="hidden sm:inline">{{ m.history() }} ({{ historyClips.length }})</span>
        <span class="sm:hidden">{{ historyClips.length }}</span>
      </div>
      <div
        class="text-brand flex items-center justify-center gap-1 text-xs font-bold tracking-wide uppercase sm:gap-1.5 sm:text-sm"
      >
        <ActionPlayCircle :size="14" class="sm:hidden" />
        <ActionPlayCircle :size="16" class="hidden sm:block" />
        <span class="hidden md:inline">{{ m.now_playing() }}</span>
        <span class="md:hidden">Now</span>
      </div>
      <div
        class="text-muted-foreground flex items-center justify-end gap-1 text-[10px] font-semibold tracking-wide uppercase sm:gap-1.5 sm:text-xs"
      >
        <StatusClock :size="12" class="sm:hidden" />
        <StatusClock :size="14" class="hidden sm:block" />
        <span class="hidden sm:inline">{{ m.upcoming_clips() }} ({{ upcomingClips.length }})</span>
        <span class="sm:hidden">{{ upcomingClips.length }}</span>
      </div>
    </div>

    <!-- Scrollable timeline -->
    <div
      ref="timelineRef"
      class="scrollbar-thin scrollbar-thumb-muted-foreground scrollbar-track-transparent hover:scrollbar-thumb-foreground -webkit-overflow-scrolling-touch [scroll-snap-type:x_proximity] overflow-x-auto overflow-y-hidden scroll-smooth"
      @scroll="handleScroll"
    >
      <div
        class="flex min-w-min py-1"
        :class="compact ? 'gap-1.5 sm:gap-2' : 'gap-2 sm:gap-3 sm:py-2'"
      >
        <!-- History clips with TransitionGroup -->
        <TransitionGroup name="timeline-clip">
          <div
            v-for="(clip, index) in historyClips"
            :key="`history-${toClipUUID(clip)}`"
            class="scroll-snap-align-center relative flex flex-shrink-0 flex-col transition-all duration-200"
            :class="[
              compact
                ? 'w-[100px] gap-1 sm:w-[120px] lg:w-[140px]'
                : 'w-[140px] gap-1.5 sm:w-[180px] sm:gap-2 lg:w-[200px]',
              canControl && 'cursor-pointer hover:scale-105'
            ]"
            @click="handleHistoryClick(clip)"
          >
            <div
              class="bg-muted relative aspect-video w-full overflow-hidden shadow-md"
              :class="compact ? 'rounded' : 'rounded-md sm:rounded-lg'"
            >
              <img
                :src="clip.thumbnailUrl"
                :alt="clip.title"
                class="h-full w-full object-cover opacity-60 transition-opacity duration-200"
                :class="canControl && 'hover:opacity-100'"
              />
              <div
                v-if="canControl"
                class="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity duration-200 hover:opacity-100"
              >
                <ActionRotateCcw :size="compact ? 14 : 16" class="sm:hidden" />
                <ActionRotateCcw :size="compact ? 16 : 20" class="hidden sm:block" />
              </div>
              <div
                class="absolute top-1 left-1 rounded bg-black/75 px-1 py-0.5 font-semibold text-white"
                :class="
                  compact ? 'text-[9px]' : 'text-[10px] sm:top-2 sm:left-2 sm:px-1.5 sm:text-xs'
                "
              >
                -{{ historyClips.length - index }}
              </div>
            </div>
            <div
              v-if="!compact"
              class="text-foreground line-clamp-2 text-[10px] leading-tight font-medium sm:text-xs"
            >
              {{ clip.title }}
            </div>
          </div>
        </TransitionGroup>

        <!-- Current clip -->
        <div
          v-if="currentClip"
          :key="`current-${toClipUUID(currentClip)}`"
          ref="currentClipRef"
          class="scroll-snap-align-center relative flex flex-shrink-0 flex-col"
          :class="
            compact
              ? 'w-[100px] gap-1 sm:w-[120px] lg:w-[140px]'
              : 'w-[140px] gap-1.5 sm:w-[180px] sm:gap-2 lg:w-[200px]'
          "
        >
          <div
            class="bg-muted relative aspect-video w-full overflow-hidden border-2 border-violet-600 shadow-[0_0_0_1px_rgb(124_58_237),0_0_20px_rgb(124_58_237_/_0.3)] dark:border-violet-500 dark:shadow-[0_0_0_1px_rgb(139_92_246),0_0_20px_rgb(139_92_246_/_0.3)]"
            :class="compact ? 'rounded' : 'rounded-md sm:rounded-lg'"
          >
            <img
              :src="currentClip.thumbnailUrl"
              :alt="currentClip.title"
              class="h-full w-full object-cover"
            />
            <!-- Navigation badge (when viewing history) -->
            <div
              v-if="isNavigatingHistory"
              class="absolute top-1 right-1 flex items-center gap-0.5 rounded bg-amber-500/90 px-1 py-0.5 font-bold text-white"
              :class="
                compact
                  ? 'text-[8px]'
                  : 'text-[9px] sm:top-2 sm:right-2 sm:gap-1 sm:px-1.5 sm:text-[10px]'
              "
            >
              <ActionRotateCcw :size="compact ? 8 : 10" class="sm:hidden" />
              <ActionRotateCcw :size="compact ? 10 : 12" class="hidden sm:block" />
              <span v-if="!compact" class="hidden sm:inline">VIEWING HISTORY</span>
              <span v-if="!compact" class="sm:hidden">HIST</span>
            </div>
            <div
              class="pointer-events-none absolute inset-0 flex items-center justify-center bg-violet-600/20 text-white dark:bg-violet-500/20"
            >
              <div
                class="absolute animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite] rounded-full border-2 border-white motion-reduce:animate-none"
                :class="compact ? 'h-6 w-6 sm:h-8 sm:w-8' : 'h-10 w-10 sm:h-12 sm:w-12'"
              ></div>
              <ActionPlay :size="compact ? 16 : 24" class="sm:hidden" />
              <ActionPlay :size="compact ? 20 : 32" class="hidden sm:block" />
            </div>
          </div>
          <div
            v-if="!compact"
            class="text-foreground line-clamp-2 text-[10px] leading-tight font-semibold sm:text-xs"
          >
            {{ currentClip.title }}
          </div>
        </div>

        <!-- Empty state for no current clip -->
        <div
          v-else
          ref="currentClipRef"
          class="scroll-snap-align-center relative flex flex-shrink-0 flex-col"
          :class="
            compact
              ? 'w-[100px] gap-1 sm:w-[120px] lg:w-[140px]'
              : 'w-[140px] gap-1.5 sm:w-[180px] sm:gap-2 lg:w-[200px]'
          "
        >
          <div
            class="bg-muted relative aspect-video w-full overflow-hidden border-2 border-violet-600 shadow-[0_0_0_1px_rgb(124_58_237),0_0_20px_rgb(124_58_237_/_0.3)] dark:border-violet-500 dark:shadow-[0_0_0_1px_rgb(139_92_246),0_0_20px_rgb(139_92_246_/_0.3)]"
            :class="compact ? 'rounded' : 'rounded-md sm:rounded-lg'"
          >
            <div class="text-muted-foreground flex h-full w-full items-center justify-center">
              <ActionPlayCircle
                :size="compact ? 16 : 24"
                class="animate-pulse motion-reduce:animate-none sm:hidden"
              />
              <ActionPlayCircle
                :size="compact ? 20 : 32"
                class="hidden animate-pulse motion-reduce:animate-none sm:block"
              />
            </div>
          </div>
          <div
            v-if="!compact"
            class="text-muted-foreground text-[10px] leading-tight font-medium italic sm:text-xs"
          >
            {{ m.no_clip_playing() }}
          </div>
        </div>

        <!-- Upcoming clips with TransitionGroup -->
        <TransitionGroup name="timeline-clip">
          <div
            v-for="(clip, index) in upcomingClips"
            :key="`queue-${toClipUUID(clip)}`"
            class="scroll-snap-align-center relative flex flex-shrink-0 flex-col transition-all duration-200"
            :class="[
              compact
                ? 'w-[100px] gap-1 sm:w-[120px] lg:w-[140px]'
                : 'w-[140px] gap-1.5 sm:w-[180px] sm:gap-2 lg:w-[200px]',
              canControl && 'cursor-pointer hover:scale-105'
            ]"
            @click="handleQueueClick(clip)"
          >
            <div
              class="bg-muted relative aspect-video w-full overflow-hidden shadow-md"
              :class="compact ? 'rounded' : 'rounded-md sm:rounded-lg'"
            >
              <img
                :src="clip.thumbnailUrl"
                :alt="clip.title"
                class="h-full w-full object-cover opacity-80 transition-opacity duration-200"
                :class="canControl && 'hover:opacity-100'"
              />
              <div
                v-if="canControl"
                class="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity duration-200 hover:opacity-100"
              >
                <ActionPlay :size="compact ? 14 : 16" class="sm:hidden" />
                <ActionPlay :size="compact ? 16 : 20" class="hidden sm:block" />
              </div>
              <div
                class="absolute top-1 left-1 rounded bg-black/75 px-1 py-0.5 font-semibold text-white"
                :class="
                  compact ? 'text-[9px]' : 'text-[10px] sm:top-2 sm:left-2 sm:px-1.5 sm:text-xs'
                "
              >
                +{{ index + 1 }}
              </div>
              <div
                v-if="clip.submitters.length > 1"
                class="absolute top-1 right-1 rounded bg-violet-600/90 px-1 py-0.5 font-semibold text-white dark:bg-violet-500/90"
                :class="
                  compact ? 'text-[9px]' : 'text-[10px] sm:top-2 sm:right-2 sm:px-1.5 sm:text-xs'
                "
              >
                {{ clip.submitters.length }}x
              </div>
            </div>
            <div
              v-if="!compact"
              class="text-foreground line-clamp-2 text-[10px] leading-tight font-medium sm:text-xs"
            >
              {{ clip.title }}
            </div>
          </div>

          <!-- Empty state for empty queue (inside TransitionGroup for consistent layout) -->
          <div
            v-if="upcomingClips.length === 0"
            key="empty-queue"
            class="scroll-snap-align-center relative flex flex-shrink-0 flex-col"
            :class="
              compact
                ? 'w-[100px] gap-1 sm:w-[120px] lg:w-[140px]'
                : 'w-[140px] gap-1.5 sm:w-[180px] sm:gap-2 lg:w-[200px]'
            "
          >
            <div
              class="bg-muted relative aspect-video w-full overflow-hidden shadow-md"
              :class="compact ? 'rounded' : 'rounded-md sm:rounded-lg'"
            >
              <div
                class="text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-1"
              >
                <NavInbox
                  :size="compact ? 16 : 24"
                  class="animate-bounce motion-reduce:animate-none sm:hidden"
                  style="animation-duration: 2s"
                />
                <NavInbox
                  :size="compact ? 20 : 32"
                  class="hidden animate-bounce motion-reduce:animate-none sm:block"
                  style="animation-duration: 2s"
                />
              </div>
            </div>
            <div
              v-if="!compact"
              class="text-muted-foreground text-[10px] leading-tight font-medium italic sm:text-xs"
            >
              {{ m.no_upcoming_clips() }}
            </div>
          </div>
        </TransitionGroup>
      </div>
    </div>

    <!-- Navigation dots indicator (hidden in compact mode) -->
    <div v-if="!compact" class="mt-2 flex justify-center gap-1 sm:mt-3 sm:gap-1.5">
      <div
        v-for="section in 3"
        :key="section"
        class="bg-muted h-1 w-1 rounded-full transition-all duration-300 sm:h-1.5 sm:w-1.5"
        :class="currentSection === section - 1 && 'bg-brand scale-150'"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useThrottleFn } from '@vueuse/core'
import { nextTick, onMounted, ref, watch } from 'vue'

import type { Clip } from '@cq/platforms'
import { toClipUUID } from '@cq/platforms'

import {
  ActionPlay,
  ActionPlayCircle,
  ActionRotateCcw,
  NavHistory,
  NavInbox,
  StatusClock
} from '@/composables/icons'
import * as m from '@/paraglide/messages'

export interface Props {
  currentClip: Clip | undefined
  historyClips: Clip[]
  upcomingClips: Clip[]
  canControl?: boolean
  isNavigatingHistory?: boolean
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  canControl: false,
  isNavigatingHistory: false,
  compact: false
})

const emit = defineEmits<{
  (e: 'replay', clip: Clip): void
  (e: 'play', clip: Clip): void
}>()

const timelineRef = ref<HTMLElement | null>(null)
const currentClipRef = ref<HTMLElement | null>(null)
const currentSection = ref(1) // 0=history, 1=current, 2=queue

function handleHistoryClick(clip: Clip) {
  if (props.canControl) {
    emit('replay', clip)
  }
}

function handleQueueClick(clip: Clip) {
  if (props.canControl) {
    emit('play', clip)
  }
}

// Throttle scroll handler for better performance
const handleScroll = useThrottleFn(() => {
  if (!timelineRef.value) return

  const scrollLeft = timelineRef.value.scrollLeft
  const scrollWidth = timelineRef.value.scrollWidth
  const clientWidth = timelineRef.value.clientWidth

  // Determine which section is most visible
  const scrollProgress = scrollLeft / (scrollWidth - clientWidth)
  if (scrollProgress < 0.33) {
    currentSection.value = 0 // History
  } else if (scrollProgress < 0.66) {
    currentSection.value = 1 // Current
  } else {
    currentSection.value = 2 // Queue
  }
}, 100)

async function scrollToCurrentClip() {
  await nextTick()
  if (!timelineRef.value || !currentClipRef.value) return

  const container = timelineRef.value
  const currentElement = currentClipRef.value

  const containerWidth = container.clientWidth
  const elementLeft = currentElement.offsetLeft
  const elementWidth = currentElement.clientWidth

  // Center the current clip
  const scrollTarget = elementLeft - containerWidth / 2 + elementWidth / 2

  container.scrollTo({
    left: scrollTarget,
    behavior: 'smooth'
  })
}

// Auto-scroll to current clip on mount and when it changes
onMounted(() => {
  scrollToCurrentClip()
})

watch(() => props.currentClip, scrollToCurrentClip)
</script>

<style scoped>
/* Timeline clip transitions for add/remove animations */
.timeline-clip-enter-active,
.timeline-clip-leave-active {
  transition: all 0.3s ease;
}

.timeline-clip-enter-from {
  opacity: 0;
  transform: scale(0.8) translateX(20px);
}

.timeline-clip-leave-to {
  opacity: 0;
  transform: scale(0.8) translateX(-20px);
}

/* Ensure smooth movement when items are added/removed */
.timeline-clip-move {
  transition: transform 0.3s ease;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .timeline-clip-enter-active,
  .timeline-clip-leave-active,
  .timeline-clip-move {
    transition: none;
  }

  .timeline-clip-enter-from,
  .timeline-clip-leave-to {
    transform: none;
  }
}
</style>
