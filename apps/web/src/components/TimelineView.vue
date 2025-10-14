<template>
  <div class="border-border bg-card rounded-lg border p-2 sm:p-3 lg:p-4">
    <!-- Header -->
    <div class="mb-2 grid grid-cols-3 items-center gap-2 text-center sm:mb-3 sm:gap-4 lg:mb-4">
      <div
        class="text-muted-foreground flex items-center justify-start gap-1 text-[10px] font-semibold tracking-wide uppercase sm:gap-1.5 sm:text-xs"
      >
        <NavHistory :size="12" class="sm:hidden" />
        <NavHistory :size="14" class="hidden sm:block" />
        <span class="hidden sm:inline">{{ m.history() }} ({{ historyClips.length }})</span>
        <span class="sm:hidden">{{ historyClips.length }}</span>
      </div>
      <div
        class="flex items-center justify-center gap-1 text-xs font-bold tracking-wide text-violet-600 uppercase sm:gap-1.5 sm:text-sm dark:text-violet-500"
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
      <div class="flex min-w-min gap-2 py-1 sm:gap-3 sm:py-2">
        <!-- History clips -->
        <div
          v-for="(clip, index) in historyClips"
          :key="`history-${toClipUUID(clip)}`"
          class="scroll-snap-align-center relative flex w-[140px] flex-shrink-0 flex-col gap-1.5 transition-all duration-200 sm:w-[180px] sm:gap-2 lg:w-[200px]"
          :class="canControl && 'cursor-pointer hover:scale-105'"
          @click="handleHistoryClick(clip)"
        >
          <div
            class="bg-muted relative aspect-video w-full overflow-hidden rounded-md shadow-md sm:rounded-lg"
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
              <ActionRotateCcw :size="16" class="sm:hidden" />
              <ActionRotateCcw :size="20" class="hidden sm:block" />
            </div>
            <div
              class="absolute top-1 left-1 rounded bg-black/75 px-1 py-0.5 text-[10px] font-semibold text-white sm:top-2 sm:left-2 sm:px-1.5 sm:text-xs"
            >
              -{{ historyClips.length - index }}
            </div>
          </div>
          <div
            class="text-foreground line-clamp-2 text-[10px] leading-tight font-medium sm:text-xs"
          >
            {{ clip.title }}
          </div>
        </div>

        <!-- Current clip -->
        <div
          v-if="currentClip"
          :key="`current-${toClipUUID(currentClip)}`"
          ref="currentClipRef"
          class="scroll-snap-align-center relative flex w-[140px] flex-shrink-0 flex-col gap-1.5 sm:w-[180px] sm:gap-2 lg:w-[200px]"
        >
          <div
            class="bg-muted relative aspect-video w-full overflow-hidden rounded-md border-2 border-violet-600 shadow-[0_0_0_1px_rgb(124_58_237),0_0_20px_rgb(124_58_237_/_0.3)] sm:rounded-lg dark:border-violet-500 dark:shadow-[0_0_0_1px_rgb(139_92_246),0_0_20px_rgb(139_92_246_/_0.3)]"
          >
            <img
              :src="currentClip.thumbnailUrl"
              :alt="currentClip.title"
              class="h-full w-full object-cover"
            />
            <div
              class="pointer-events-none absolute inset-0 flex items-center justify-center bg-violet-600/20 text-white dark:bg-violet-500/20"
            >
              <div
                class="absolute h-10 w-10 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite] rounded-full border-2 border-white sm:h-12 sm:w-12"
              ></div>
              <ActionPlay :size="24" class="sm:hidden" />
              <ActionPlay :size="32" class="hidden sm:block" />
            </div>
          </div>
          <div
            class="text-foreground line-clamp-2 text-[10px] leading-tight font-semibold sm:text-xs"
          >
            {{ currentClip.title }}
          </div>
        </div>

        <!-- Empty state for no current clip -->
        <div
          v-else
          class="scroll-snap-align-center relative flex w-[140px] flex-shrink-0 flex-col gap-1.5 sm:w-[180px] sm:gap-2 lg:w-[200px]"
        >
          <div
            class="bg-muted relative aspect-video w-full overflow-hidden rounded-md border-2 border-violet-600 shadow-[0_0_0_1px_rgb(124_58_237),0_0_20px_rgb(124_58_237_/_0.3)] sm:rounded-lg dark:border-violet-500 dark:shadow-[0_0_0_1px_rgb(139_92_246),0_0_20px_rgb(139_92_246_/_0.3)]"
          >
            <div class="text-muted-foreground flex h-full w-full items-center justify-center">
              <ActionPlayCircle :size="24" class="sm:hidden" />
              <ActionPlayCircle :size="32" class="hidden sm:block" />
            </div>
          </div>
          <div
            class="text-muted-foreground text-[10px] leading-tight font-medium italic sm:text-xs"
          >
            {{ m.no_clip_playing() }}
          </div>
        </div>

        <!-- Upcoming clips -->
        <div
          v-for="(clip, index) in upcomingClips"
          :key="`queue-${toClipUUID(clip)}`"
          class="scroll-snap-align-center relative flex w-[140px] flex-shrink-0 flex-col gap-1.5 transition-all duration-200 sm:w-[180px] sm:gap-2 lg:w-[200px]"
          :class="canControl && 'cursor-pointer hover:scale-105'"
          @click="handleQueueClick(clip)"
        >
          <div
            class="bg-muted relative aspect-video w-full overflow-hidden rounded-md shadow-md sm:rounded-lg"
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
              <ActionPlay :size="16" class="sm:hidden" />
              <ActionPlay :size="20" class="hidden sm:block" />
            </div>
            <div
              class="absolute top-1 left-1 rounded bg-black/75 px-1 py-0.5 text-[10px] font-semibold text-white sm:top-2 sm:left-2 sm:px-1.5 sm:text-xs"
            >
              +{{ index + 1 }}
            </div>
            <div
              v-if="clip.submitters.length > 1"
              class="absolute top-1 right-1 rounded bg-violet-600/90 px-1 py-0.5 text-[10px] font-semibold text-white sm:top-2 sm:right-2 sm:px-1.5 sm:text-xs dark:bg-violet-500/90"
            >
              {{ clip.submitters.length }}×
            </div>
          </div>
          <div
            class="text-foreground line-clamp-2 text-[10px] leading-tight font-medium sm:text-xs"
          >
            {{ clip.title }}
          </div>
        </div>

        <!-- Empty state for empty queue -->
        <div
          v-if="upcomingClips.length === 0"
          class="scroll-snap-align-center relative flex w-[140px] flex-shrink-0 flex-col gap-1.5 sm:w-[180px] sm:gap-2 lg:w-[200px]"
        >
          <div
            class="bg-muted relative aspect-video w-full overflow-hidden rounded-md shadow-md sm:rounded-lg"
          >
            <div class="text-muted-foreground flex h-full w-full items-center justify-center">
              <NavInbox :size="24" class="sm:hidden" />
              <NavInbox :size="32" class="hidden sm:block" />
            </div>
          </div>
          <div
            class="text-muted-foreground text-[10px] leading-tight font-medium italic sm:text-xs"
          >
            {{ m.no_upcoming_clips() }}
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation dots indicator -->
    <div class="mt-2 flex justify-center gap-1 sm:mt-3 sm:gap-1.5">
      <div
        v-for="section in 3"
        :key="section"
        class="bg-muted h-1 w-1 rounded-full transition-all duration-300 sm:h-1.5 sm:w-1.5"
        :class="currentSection === section - 1 && 'scale-150 bg-violet-600 dark:bg-violet-500'"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
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
}

const props = withDefaults(defineProps<Props>(), {
  canControl: false
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

function handleScroll() {
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
}

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
