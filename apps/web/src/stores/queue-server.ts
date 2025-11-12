/**
 * Queue Store (Server-Backed with Polling)
 *
 * Manages queue state by polling the server every 2 seconds.
 * Uses ETag for efficient bandwidth usage (304 Not Modified).
 *
 * Architecture:
 * - Server monitors Twitch chat via EventSub
 * - Server manages queue state in SQLite + memory
 * - Frontend polls GET /api/queue every 2s with ETag
 * - Frontend sends control commands via REST API
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { Clip, PlayLogEntry } from '@cq/platforms'
import { ClipList, toClipUUID } from '@cq/platforms'

import { env } from '@/config'
import { fetchWithAuth } from '@/utils/api'
import { useLogger } from './logger'
import { useSettings } from './settings'

const { API_URL } = env

// Polling configuration
const BASE_POLL_INTERVAL_MS = 2000 // 2 seconds (normal)
const IDLE_POLL_INTERVAL_MS = 10000 // 10 seconds (idle)
const ACTIVE_POLL_INTERVAL_MS = 500 // 500ms (after command)
const MAX_POLL_INTERVAL_MS = 30000 // 30 seconds (max backoff)
const POLL_JITTER_MS = 500 // ±500ms random jitter
const MAX_CONSECUTIVE_ERRORS = 5 // Stop after 5 errors

export const useQueueServer = defineStore('queue-server', () => {
  const logger = useLogger()

  // State (synced from server via polling)
  const isOpen = ref<boolean>(true)
  const playHistory = ref<PlayLogEntry[]>([])
  const current = ref<Clip | undefined>(undefined)
  const upcoming = ref<ClipList>(new ClipList())
  const historyPosition = ref<number>(-1) // -1 = queue mode, >= 0 = navigating history
  const isInitialized = ref<boolean>(false)

  // Polling state
  let pollTimeout: ReturnType<typeof setTimeout> | null = null
  let lastETag: string | null = null
  let consecutiveErrors = 0
  let currentPollInterval = BASE_POLL_INTERVAL_MS
  let lastActivityTime = Date.now()

  // Computed
  const hasClips = computed(() => upcoming.value.size() > 0)
  const isEmpty = computed(() => upcoming.value.size() === 0)
  const size = computed(() => upcoming.value.size())
  const isNavigatingHistory = computed(() => historyPosition.value >= 0)

  /**
   * Calculate next poll interval with jitter
   */
  function getNextPollInterval(): number {
    // Check if idle (no activity for 30 seconds)
    const isIdle = Date.now() - lastActivityTime > 30000

    const baseInterval = isIdle ? IDLE_POLL_INTERVAL_MS : currentPollInterval

    // Add random jitter to prevent thundering herd
    const jitter = (Math.random() * 2 - 1) * POLL_JITTER_MS
    return Math.floor(baseInterval + jitter)
  }

  /**
   * Schedule next poll
   */
  function schedulePoll(): void {
    if (!isInitialized.value) return

    if (pollTimeout) {
      clearTimeout(pollTimeout)
    }

    const interval = getNextPollInterval()
    logger.debug(`[Queue]: Scheduling next poll in ${interval}ms`)

    pollTimeout = setTimeout(() => {
      fetchQueueState()
    }, interval)
  }

  /**
   * Fetch queue state from server
   * Uses ETag for efficient caching (304 Not Modified)
   * Implements exponential backoff on errors
   */
  async function fetchQueueState(): Promise<boolean> {
    try {
      const headers: HeadersInit = {}
      if (lastETag) {
        headers['If-None-Match'] = lastETag
      }

      const response = await fetch(`${API_URL}/api/queue`, {
        headers,
        credentials: 'include'
      })

      // 304 Not Modified - state hasn't changed
      if (response.status === 304) {
        logger.debug('[Queue]: State unchanged (304)')
        consecutiveErrors = 0
        currentPollInterval = BASE_POLL_INTERVAL_MS
        schedulePoll()
        return true
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Update ETag for next request
      const newETag = response.headers.get('ETag')
      if (newETag) {
        lastETag = newETag
      }

      // Parse and update state
      const data = await response.json()
      updateState(data)

      // Reset error tracking on success
      consecutiveErrors = 0
      currentPollInterval = BASE_POLL_INTERVAL_MS
      schedulePoll()
      return true
    } catch (error) {
      logger.error(`[Queue]: Failed to fetch queue state: ${error}`)

      // Clear stale ETag on error
      lastETag = null

      // Increment error counter
      consecutiveErrors++

      // Stop polling after too many errors
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        logger.error(`[Queue]: Stopped polling after ${MAX_CONSECUTIVE_ERRORS} consecutive errors`)
        return false
      }

      // Exponential backoff: 2s → 4s → 8s → 16s → 30s (max)
      currentPollInterval = Math.min(currentPollInterval * 2, MAX_POLL_INTERVAL_MS)
      logger.warn(
        `[Queue]: Retrying in ${currentPollInterval}ms (error ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS})`
      )

      schedulePoll()
      return false
    }
  }

  /**
   * Update local state from server response
   */
  function updateState(data: {
    current: Clip | null
    upcoming: Clip[]
    playHistory: PlayLogEntry[]
    historyPosition: number
    isOpen: boolean
    settings?: {
      commands: { prefix: string; allowed: string[] }
      queue: { hasAutoModerationEnabled: boolean; limit: number | null; platforms: string[] }
      logger: { level: string; limit: number }
    }
  }): void {
    logger.debug('[Queue]: Updating state from server')

    // Update current clip
    current.value = data.current || undefined

    // Update upcoming queue (batch add for O(n log n) instead of O(n² log n))
    upcoming.value = new ClipList(...data.upcoming)

    // Update history (batch add)
    playHistory.value = data.playHistory || []

    // Update history position
    historyPosition.value = data.historyPosition ?? -1

    // Update queue open/close status
    isOpen.value = data.isOpen

    // Update settings if provided (for real-time sync across clients)
    if (data.settings) {
      const settingsStore = useSettings()
      // Cast to frontend types (server returns validated zod-inferred types)
      settingsStore.commands = data.settings.commands as typeof settingsStore.commands
      settingsStore.queue = data.settings.queue as typeof settingsStore.queue
      settingsStore.logger = data.settings.logger as typeof settingsStore.logger
      logger.debug('[Queue]: Settings synchronized from server')
    }
  }

  /**
   * Mark activity for adaptive polling
   */
  function markActivity(): void {
    lastActivityTime = Date.now()
    // After user action, poll more frequently for immediate feedback
    currentPollInterval = ACTIVE_POLL_INTERVAL_MS
  }

  /**
   * Initialize polling
   */
  function initialize(): void {
    // Prevent multiple initializations
    if (isInitialized.value) {
      logger.debug('[Queue]: Already initialized, skipping')
      return
    }

    isInitialized.value = true
    logger.info('[Queue]: Starting adaptive polling (base: 2s, idle: 10s, active: 500ms)')

    // Fetch initial state immediately, then schedule polling
    fetchQueueState()
  }

  /**
   * Cleanup polling
   */
  function cleanup(): void {
    if (!isInitialized.value) return

    logger.info('[Queue]: Stopping polling')

    if (pollTimeout) {
      clearTimeout(pollTimeout)
      pollTimeout = null
    }

    isInitialized.value = false
    lastETag = null
    consecutiveErrors = 0
    currentPollInterval = BASE_POLL_INTERVAL_MS
  }

  /**
   * Queue Control Commands (via REST API)
   */

  async function advance(): Promise<void> {
    markActivity()

    // Optimistic update: predict next state
    const previousCurrent = current.value
    const previousUpcoming = upcoming.value.toArray()
    const previousHistory = [...playHistory.value]

    try {
      // Optimistically update UI
      current.value = upcoming.value.shift()

      const response = await fetchWithAuth(`${API_URL}/api/queue/advance`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      // Use state from response (eliminates race condition)
      const data = await response.json()
      if (data.state) {
        updateState(data.state)
      }

      logger.info('[Queue]: Advanced to next clip')
      schedulePoll() // Reschedule with active interval
    } catch (error) {
      logger.error(`[Queue]: Failed to advance: ${error}`)

      // Revert optimistic update
      current.value = previousCurrent
      upcoming.value = new ClipList(...previousUpcoming)
      playHistory.value = previousHistory

      throw error
    }
  }

  async function previous(): Promise<void> {
    markActivity()

    // Optimistic update
    const previousCurrent = current.value
    const previousUpcoming = upcoming.value.toArray()
    const previousHistory = [...playHistory.value]

    try {
      // Optimistically update UI
      if (current.value) {
        upcoming.value.add(current.value)
      }
      const lastEntry = playHistory.value.pop()
      current.value = lastEntry?.clip

      const response = await fetchWithAuth(`${API_URL}/api/queue/previous`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      if (data.state) {
        updateState(data.state)
      }

      logger.info('[Queue]: Returned to previous clip')
      schedulePoll()
    } catch (error) {
      logger.error(`[Queue]: Failed to go to previous: ${error}`)

      // Revert optimistic update
      current.value = previousCurrent
      upcoming.value = new ClipList(...previousUpcoming)
      playHistory.value = previousHistory

      throw error
    }
  }

  async function clear(): Promise<void> {
    markActivity()

    // Optimistic update
    const previousUpcoming = upcoming.value.toArray()

    try {
      // Optimistically clear queue
      upcoming.value.clear()

      const response = await fetchWithAuth(`${API_URL}/api/queue`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      if (data.state) {
        updateState(data.state)
      }

      logger.info('[Queue]: Cleared queue')
      schedulePoll()
    } catch (error) {
      logger.error(`[Queue]: Failed to clear: ${error}`)

      // Revert optimistic update
      upcoming.value = new ClipList(...previousUpcoming)

      throw error
    }
  }

  async function open(): Promise<void> {
    markActivity()

    const previousIsOpen = isOpen.value

    try {
      // Optimistically open queue
      isOpen.value = true

      const response = await fetchWithAuth(`${API_URL}/api/queue/open`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      if (data.state) {
        updateState(data.state)
      }

      logger.info('[Queue]: Opened queue')
      schedulePoll()
    } catch (error) {
      logger.error(`[Queue]: Failed to open: ${error}`)

      // Revert optimistic update
      isOpen.value = previousIsOpen

      throw error
    }
  }

  async function close(): Promise<void> {
    markActivity()

    const previousIsOpen = isOpen.value

    try {
      // Optimistically close queue
      isOpen.value = false

      const response = await fetchWithAuth(`${API_URL}/api/queue/close`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      if (data.state) {
        updateState(data.state)
      }

      logger.info('[Queue]: Closed queue')
      schedulePoll()
    } catch (error) {
      logger.error(`[Queue]: Failed to close: ${error}`)

      // Revert optimistic update
      isOpen.value = previousIsOpen

      throw error
    }
  }

  async function clearHistory(): Promise<void> {
    markActivity()

    const previousHistory = [...playHistory.value]

    try {
      // Optimistically clear history
      playHistory.value = []

      const response = await fetchWithAuth(`${API_URL}/api/queue/history`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      if (data.state) {
        updateState(data.state)
      }

      logger.info('[Queue]: Cleared history')
      schedulePoll()
    } catch (error) {
      logger.error(`[Queue]: Failed to clear history: ${error}`)

      // Revert optimistic update
      playHistory.value = previousHistory

      throw error
    }
  }

  async function submit(url: string, submitter: string): Promise<void> {
    markActivity()

    // No optimistic update for submit (we don't have clip metadata yet)
    try {
      const response = await fetchWithAuth(`${API_URL}/api/queue/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url, submitter })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      if (data.state) {
        updateState(data.state)
      }

      logger.info('[Queue]: Submitted clip')
      schedulePoll()
    } catch (error) {
      logger.error(`[Queue]: Failed to submit clip: ${error}`)
      throw error
    }
  }

  async function remove(clipId: string): Promise<void> {
    markActivity()

    // Optimistic update
    const previousUpcoming = upcoming.value.toArray()
    const clipToRemove = previousUpcoming.find((c) => c.id === clipId)

    try {
      // Optimistically remove clip
      if (clipToRemove) {
        upcoming.value.remove(clipToRemove)
      }

      const response = await fetchWithAuth(`${API_URL}/api/queue/remove`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clipId })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      if (data.state) {
        updateState(data.state)
      }

      logger.info('[Queue]: Removed clip')
      schedulePoll()
    } catch (error) {
      logger.error(`[Queue]: Failed to remove clip: ${error}`)

      // Revert optimistic update
      upcoming.value = new ClipList(...previousUpcoming)

      throw error
    }
  }

  async function play(clipId: string): Promise<void> {
    markActivity()

    // Optimistic update
    const previousCurrent = current.value
    const previousUpcoming = upcoming.value.toArray()
    const previousHistory = [...playHistory.value]
    const clipToPlay = previousUpcoming.find((c) => c.id === clipId)

    try {
      // Optimistically play clip
      if (clipToPlay) {
        upcoming.value.remove(clipToPlay)
        current.value = clipToPlay
      }

      const response = await fetchWithAuth(`${API_URL}/api/queue/play`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clipId })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      if (data.state) {
        updateState(data.state)
      }

      logger.info('[Queue]: Playing clip')
      schedulePoll()
    } catch (error) {
      logger.error(`[Queue]: Failed to play clip: ${error}`)

      // Revert optimistic update
      current.value = previousCurrent
      upcoming.value = new ClipList(...previousUpcoming)
      playHistory.value = previousHistory

      throw error
    }
  }

  async function removeFromHistory(clipId: string): Promise<void> {
    markActivity()

    // Optimistic update
    const previousHistory = [...playHistory.value]

    try {
      const response = await fetchWithAuth(`${API_URL}/api/queue/history/${clipId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      if (data.state) {
        updateState(data.state)
      }

      logger.info('[Queue]: Removed clip from history')
      schedulePoll()
    } catch (error) {
      logger.error(`[Queue]: Failed to remove clip from history: ${error}`)

      // Revert optimistic update
      playHistory.value = previousHistory

      throw error
    }
  }

  async function batchRemove(clipIds: string[]): Promise<void> {
    markActivity()

    // Optimistic update
    const previousUpcoming = upcoming.value.toArray()

    try {
      // Optimistically remove clips
      clipIds.forEach((clipId) => {
        const clipToRemove = upcoming.value.toArray().find((c) => c.id === clipId)
        if (clipToRemove) {
          upcoming.value.remove(clipToRemove)
        }
      })

      const response = await fetchWithAuth(`${API_URL}/api/queue/batch/remove`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clipIds })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      if (data.state) {
        updateState(data.state)
      }

      logger.info(`[Queue]: Removed ${clipIds.length} clips`)
      schedulePoll()
    } catch (error) {
      logger.error(`[Queue]: Failed to batch remove clips: ${error}`)

      // Revert optimistic update
      upcoming.value = new ClipList(...previousUpcoming)

      throw error
    }
  }

  async function batchApprove(clipIds: string[]): Promise<void> {
    markActivity()

    // No optimistic update (pending clips not shown in UI)
    try {
      const response = await fetchWithAuth(`${API_URL}/api/queue/batch/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clipIds })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      if (data.state) {
        updateState(data.state)
      }

      logger.info(`[Queue]: Approved ${clipIds.length} clips`)
      schedulePoll()
    } catch (error) {
      logger.error(`[Queue]: Failed to batch approve clips: ${error}`)
      throw error
    }
  }

  async function batchReject(clipIds: string[]): Promise<void> {
    markActivity()

    // No optimistic update (pending clips not shown in UI)
    try {
      const response = await fetchWithAuth(`${API_URL}/api/queue/batch/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clipIds })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      if (data.state) {
        updateState(data.state)
      }

      logger.info(`[Queue]: Rejected ${clipIds.length} clips`)
      schedulePoll()
    } catch (error) {
      logger.error(`[Queue]: Failed to batch reject clips: ${error}`)
      throw error
    }
  }

  async function fetchRejectedClips(): Promise<Clip[]> {
    markActivity()

    try {
      const response = await fetchWithAuth(`${API_URL}/api/queue/rejected`, {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      logger.debug(`[Queue]: Fetched ${data.clips?.length || 0} rejected clips`)

      return data.clips || []
    } catch (error) {
      logger.error(`[Queue]: Failed to fetch rejected clips: ${error}`)
      throw error
    }
  }

  async function restoreRejectedClip(clipId: string): Promise<void> {
    markActivity()

    // No optimistic update (restored clip goes to pending/approved)
    try {
      const response = await fetchWithAuth(`${API_URL}/api/queue/rejected/${clipId}/restore`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      if (data.state) {
        updateState(data.state)
      }

      logger.info('[Queue]: Restored rejected clip')
      schedulePoll()
    } catch (error) {
      logger.error(`[Queue]: Failed to restore rejected clip: ${error}`)
      throw error
    }
  }

  async function replayFromHistory(clipId: string): Promise<void> {
    markActivity()

    // Optimistic update
    const previousCurrent = current.value
    const previousHistory = [...playHistory.value]
    const clipToReplay = previousHistory.find((entry) => toClipUUID(entry.clip) === clipId)

    try {
      // Optimistically replay clip from history
      if (clipToReplay) {
        current.value = clipToReplay.clip
      }

      const response = await fetchWithAuth(`${API_URL}/api/queue/history/${clipId}/replay`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      if (data.state) {
        updateState(data.state)
      }

      logger.info('[Queue]: Replaying clip from history')
      schedulePoll()
    } catch (error) {
      logger.error(`[Queue]: Failed to replay clip from history: ${error}`)

      // Revert optimistic update
      current.value = previousCurrent
      playHistory.value = previousHistory

      throw error
    }
  }

  return {
    // State
    current,
    upcoming,
    playHistory,
    historyPosition,
    isNavigatingHistory,
    isOpen,
    hasClips,
    isEmpty,
    size,

    // Lifecycle
    initialize,
    cleanup,

    // Actions
    advance,
    previous,
    clear,
    open,
    close,
    clearHistory,
    submit,
    remove,
    play,
    removeFromHistory,
    batchRemove,
    batchApprove,
    batchReject,
    fetchRejectedClips,
    restoreRejectedClip,
    replayFromHistory
  }
})
