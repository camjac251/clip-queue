<template>
  <div class="timeline-container">
    <div class="timeline-header">
      <div class="timeline-section-label">
        <i class="pi pi-history"></i>
        <span>{{ m.history() }} ({{ historyClips.length }})</span>
      </div>
      <div class="timeline-center">
        <i class="pi pi-play-circle"></i>
        <span>{{ m.now_playing() }}</span>
      </div>
      <div class="timeline-section-label">
        <i class="pi pi-clock"></i>
        <span>{{ m.upcoming_clips() }} ({{ upcomingClips.length }})</span>
      </div>
    </div>

    <div ref="timelineRef" class="timeline-scroll" @scroll="handleScroll">
      <div class="timeline-track">
        <!-- History clips (reversed to show newest first) -->
        <div
          v-for="(clip, index) in historyClips"
          :key="`history-${toClipUUID(clip)}`"
          class="timeline-clip history-clip"
          :class="{ 'can-interact': canControl }"
          @click="handleHistoryClick(clip)"
        >
          <div class="clip-thumbnail-wrapper">
            <img :src="clip.thumbnailUrl" :alt="clip.title" class="clip-thumbnail" />
            <div class="clip-overlay">
              <i class="pi pi-replay"></i>
            </div>
            <div class="clip-index">-{{ historyClips.length - index }}</div>
          </div>
          <div class="clip-info">
            <div class="clip-title">{{ clip.title }}</div>
            <div class="clip-meta">
              <PlatformName :platform="clip.platform" size="small" />
            </div>
          </div>
        </div>

        <!-- Current clip (highlighted) -->
        <div
          v-if="currentClip"
          :key="`current-${toClipUUID(currentClip)}`"
          ref="currentClipRef"
          class="timeline-clip current-clip"
        >
          <div class="clip-thumbnail-wrapper">
            <img :src="currentClip.thumbnailUrl" :alt="currentClip.title" class="clip-thumbnail" />
            <div class="current-indicator">
              <div class="pulse-ring"></div>
              <i class="pi pi-play"></i>
            </div>
          </div>
          <div class="clip-info">
            <div class="clip-title">{{ currentClip.title }}</div>
            <div class="clip-meta">
              <PlatformName :platform="currentClip.platform" size="small" />
              <span v-if="currentClip.submitters[0]" class="submitter">
                {{ currentClip.submitters[0] }}
              </span>
            </div>
          </div>
        </div>

        <!-- Empty state for no current clip -->
        <div v-else class="timeline-clip current-clip empty-current">
          <div class="clip-thumbnail-wrapper">
            <div class="empty-thumbnail">
              <i class="pi pi-play-circle"></i>
            </div>
          </div>
          <div class="clip-info">
            <div class="clip-title">{{ m.no_clip_playing() }}</div>
          </div>
        </div>

        <!-- Upcoming clips -->
        <div
          v-for="(clip, index) in upcomingClips"
          :key="`queue-${toClipUUID(clip)}`"
          class="timeline-clip queue-clip"
          :class="{ 'can-interact': canControl }"
          @click="handleQueueClick(clip)"
        >
          <div class="clip-thumbnail-wrapper">
            <img :src="clip.thumbnailUrl" :alt="clip.title" class="clip-thumbnail" />
            <div class="clip-overlay">
              <i class="pi pi-play"></i>
            </div>
            <div class="clip-index">+{{ index + 1 }}</div>
            <div v-if="clip.submitters.length > 1" class="submitter-count">
              {{ clip.submitters.length }}×
            </div>
          </div>
          <div class="clip-info">
            <div class="clip-title">{{ clip.title }}</div>
            <div class="clip-meta">
              <PlatformName :platform="clip.platform" size="small" />
              <span v-if="clip.submitters[0]" class="submitter">
                {{ clip.submitters[0] }}
              </span>
            </div>
          </div>
        </div>

        <!-- Empty state for empty queue -->
        <div v-if="upcomingClips.length === 0" class="timeline-clip queue-clip empty-queue">
          <div class="clip-thumbnail-wrapper">
            <div class="empty-thumbnail">
              <i class="pi pi-inbox"></i>
            </div>
          </div>
          <div class="clip-info">
            <div class="clip-title">{{ m.no_upcoming_clips() }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation dots indicator -->
    <div class="timeline-indicator">
      <div
        v-for="section in 3"
        :key="section"
        class="indicator-dot"
        :class="{ active: currentSection === section - 1 }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'

import type { Clip } from '@cq/platforms'
import { toClipUUID } from '@cq/platforms'

import PlatformName from '@/components/PlatformName.vue'
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

<style scoped>
.timeline-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  background: linear-gradient(to bottom, rgb(24 24 27 / 0.95), rgb(39 39 42 / 0.98));
  border-radius: 1rem;
  box-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.2),
    0 2px 4px -2px rgb(0 0 0 / 0.1),
    0 0 0 1px rgb(255 255 255 / 0.05);
}

.timeline-header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 2rem;
  align-items: center;
  padding: 0 1rem;
}

.timeline-section-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(161 161 170);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.timeline-section-label i {
  font-size: 1rem;
}

.timeline-center {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 700;
  color: rgb(139 92 246);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  justify-self: center;
}

.timeline-center i {
  font-size: 1.25rem;
}

.timeline-scroll {
  position: relative;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: smooth;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: rgb(82 82 91) transparent;
}

.timeline-scroll::-webkit-scrollbar {
  height: 8px;
}

.timeline-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.timeline-scroll::-webkit-scrollbar-thumb {
  background: rgb(82 82 91);
  border-radius: 4px;
}

.timeline-scroll::-webkit-scrollbar-thumb:hover {
  background: rgb(113 113 122);
}

.timeline-track {
  display: flex;
  gap: 1rem;
  padding: 1rem 0;
  min-width: min-content;
}

.timeline-clip {
  flex-shrink: 0;
  width: 280px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  scroll-snap-align: center;
  transition: transform 0.2s ease;
}

.timeline-clip.can-interact {
  cursor: pointer;
}

.timeline-clip.can-interact:hover {
  transform: translateY(-4px);
}

.clip-thumbnail-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 0.75rem;
  overflow: hidden;
  background: rgb(39 39 42);
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.3);
}

.clip-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.empty-thumbnail {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgb(39 39 42) 0%, rgb(24 24 27) 100%);
  color: rgb(82 82 91);
  font-size: 3rem;
}

.clip-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 0.6);
  opacity: 0;
  transition: opacity 0.2s ease;
  font-size: 2rem;
  color: white;
}

.timeline-clip.can-interact:hover .clip-overlay {
  opacity: 1;
}

.clip-index {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  background: rgb(0 0 0 / 0.8);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 700;
  backdrop-filter: blur(8px);
}

.submitter-count {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: rgb(139 92 246 / 0.9);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 700;
  backdrop-filter: blur(8px);
}

.current-indicator {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(to bottom, rgb(139 92 246 / 0.3), rgb(124 58 237 / 0.5));
  color: white;
  font-size: 3rem;
  pointer-events: none;
}

.pulse-ring {
  position: absolute;
  width: 4rem;
  height: 4rem;
  border: 3px solid rgb(139 92 246);
  border-radius: 50%;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.1);
  }
}

.current-clip {
  box-shadow: 0 0 0 3px rgb(139 92 246 / 0.5);
  border-radius: 0.75rem;
}

.current-clip .clip-thumbnail-wrapper {
  box-shadow:
    0 0 20px rgb(139 92 246 / 0.4),
    0 4px 12px rgb(0 0 0 / 0.3);
}

.history-clip .clip-thumbnail-wrapper {
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.history-clip:hover .clip-thumbnail-wrapper {
  opacity: 1;
}

.queue-clip .clip-thumbnail-wrapper {
  opacity: 0.85;
  transition: opacity 0.2s ease;
}

.queue-clip:hover .clip-thumbnail-wrapper {
  opacity: 1;
}

.clip-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.clip-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(228 228 231);
  line-height: 1.25;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-current .clip-title,
.empty-queue .clip-title {
  color: rgb(113 113 122);
  font-style: italic;
}

.clip-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: rgb(161 161 170);
}

.submitter {
  color: rgb(139 92 246);
  font-weight: 500;
}

.timeline-indicator {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  padding-top: 0.5rem;
}

.indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgb(82 82 91);
  transition: all 0.3s ease;
}

.indicator-dot.active {
  background: rgb(139 92 246);
  transform: scale(1.25);
}

@media (max-width: 1024px) {
  .timeline-clip {
    width: 240px;
  }
}

@media (max-width: 768px) {
  .timeline-header {
    grid-template-columns: 1fr;
    gap: 0.5rem;
    text-align: center;
  }

  .timeline-section-label {
    justify-content: center;
  }

  .timeline-clip {
    width: 200px;
  }
}
</style>
