/**
 * Queue Store (Server-Backed)
 *
 * Extends the existing queue store with Socket.io synchronization.
 * This allows multiple users to view and control the same queue in real-time.
 *
 * Architecture:
 * - Server monitors Twitch chat via EventSub
 * - Server manages queue state in SQLite + memory
 * - Frontend connects via Socket.io for real-time updates
 * - Frontend can send control commands (next, previous, clear)
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { Clip } from '@cq/platforms'
import { WEBSOCKET_EVENTS } from '@cq/constants/events'
import { BasicClipList, ClipList, toClipUUID } from '@cq/platforms'

import { fetchWithAuth } from '@/utils/api'
import type { WebSocketEventHandler } from './websocket'
import { useLogger } from './logger'
import { useWebSocket } from './websocket'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const useQueueServer = defineStore('queue-server', () => {
  const logger = useLogger()
  const websocket = useWebSocket()

  // State (synced from server)
  const isOpen = ref<boolean>(true)
  const history = ref<BasicClipList>(new BasicClipList())
  const current = ref<Clip | undefined>(undefined)
  const upcoming = ref<ClipList>(new ClipList())
  const isInitialized = ref<boolean>(false)

  // Idempotency tracking: prevent duplicate event processing
  const processedEvents = new Map<string, number>() // event signature -> timestamp
  const EVENT_DEDUP_WINDOW_MS = 1000 // 1 second deduplication window

  /**
   * Check if event was recently processed (for idempotency)
   */
  function isEventDuplicate(signature: string): boolean {
    const now = Date.now()
    const lastProcessed = processedEvents.get(signature)

    if (lastProcessed && now - lastProcessed < EVENT_DEDUP_WINDOW_MS) {
      return true
    }

    // Clean up old entries (keep map size bounded)
    if (processedEvents.size > 100) {
      const cutoff = now - EVENT_DEDUP_WINDOW_MS
      for (const [sig, timestamp] of processedEvents.entries()) {
        if (timestamp < cutoff) {
          processedEvents.delete(sig)
        }
      }
    }

    processedEvents.set(signature, now)
    return false
  }

  // Computed
  const hasClips = computed(() => upcoming.value.size() > 0)
  const isEmpty = computed(() => upcoming.value.size() === 0)
  const size = computed(() => upcoming.value.size())

  /**
   * Initialize WebSocket connection and listeners
   */
  function initialize(): void {
    // Prevent multiple initializations
    if (isInitialized.value) {
      logger.debug('[Queue]: Already initialized, skipping')
      return
    }

    isInitialized.value = true

    // Connect WebSocket (cookies sent automatically)
    websocket.connect(API_URL)

    // Subscribe to server events (type cast needed due to generic handler)
    websocket.on(WEBSOCKET_EVENTS.SYNC_STATE, handleSyncState as WebSocketEventHandler)
    websocket.on(WEBSOCKET_EVENTS.CLIP_ADDED, handleClipAdded as WebSocketEventHandler)
    websocket.on(WEBSOCKET_EVENTS.CLIP_REMOVED, handleClipRemoved as WebSocketEventHandler)
    websocket.on(WEBSOCKET_EVENTS.QUEUE_CURRENT, handleQueueCurrent as WebSocketEventHandler)
    websocket.on(WEBSOCKET_EVENTS.QUEUE_CLEARED, handleQueueCleared as WebSocketEventHandler)
    websocket.on(WEBSOCKET_EVENTS.QUEUE_OPENED, handleQueueOpened as WebSocketEventHandler)
    websocket.on(WEBSOCKET_EVENTS.QUEUE_CLOSED, handleQueueClosed as WebSocketEventHandler)
    websocket.on(WEBSOCKET_EVENTS.HISTORY_CLEARED, handleHistoryCleared as WebSocketEventHandler)
  }

  /**
   * Cleanup WebSocket connection
   */
  function cleanup(): void {
    if (!isInitialized.value) return

    websocket.off(WEBSOCKET_EVENTS.SYNC_STATE, handleSyncState as WebSocketEventHandler)
    websocket.off(WEBSOCKET_EVENTS.CLIP_ADDED, handleClipAdded as WebSocketEventHandler)
    websocket.off(WEBSOCKET_EVENTS.CLIP_REMOVED, handleClipRemoved as WebSocketEventHandler)
    websocket.off(WEBSOCKET_EVENTS.QUEUE_CURRENT, handleQueueCurrent as WebSocketEventHandler)
    websocket.off(WEBSOCKET_EVENTS.QUEUE_CLEARED, handleQueueCleared as WebSocketEventHandler)
    websocket.off(WEBSOCKET_EVENTS.QUEUE_OPENED, handleQueueOpened as WebSocketEventHandler)
    websocket.off(WEBSOCKET_EVENTS.QUEUE_CLOSED, handleQueueClosed as WebSocketEventHandler)
    websocket.off(WEBSOCKET_EVENTS.HISTORY_CLEARED, handleHistoryCleared as WebSocketEventHandler)

    websocket.disconnect()
    isInitialized.value = false
  }

  /**
   * WebSocket Event Handlers
   */

  function handleSyncState(event: {
    current: Clip | null
    upcoming: Clip[]
    history: Clip[]
    isOpen: boolean
  }): void {
    logger.debug('[Queue]: Syncing state from server')
    current.value = event.current || undefined
    upcoming.value.clear()
    event.upcoming.forEach((clip) => upcoming.value.add(clip))
    history.value.clear()
    event.history.forEach((clip) => history.value.add(clip))
    isOpen.value = event.isOpen
  }

  function handleClipAdded(event: { clip: Clip }): void {
    const signature = `clip:added:${toClipUUID(event.clip)}`
    if (isEventDuplicate(signature)) {
      logger.debug(`[Queue]: Skipping duplicate clip:added event for ${event.clip.title}`)
      return
    }

    logger.debug(`[Queue]: Clip added: ${event.clip.title}`)
    upcoming.value.add(event.clip)
  }

  function handleClipRemoved(event: { clipId: string }): void {
    const signature = `clip:removed:${event.clipId}`
    if (isEventDuplicate(signature)) {
      logger.debug(`[Queue]: Skipping duplicate clip:removed event for ${event.clipId}`)
      return
    }

    logger.debug(`[Queue]: Clip removed: ${event.clipId}`)
    const clips = upcoming.value.toArray()
    const clip = clips.find((c) => toClipUUID(c) === event.clipId)
    if (clip) {
      upcoming.value.remove(clip)
    }
  }

  function handleQueueCurrent(event: { clip: Clip | null }): void {
    const clipId = event.clip ? toClipUUID(event.clip) : 'null'
    const signature = `queue:current:${clipId}`
    if (isEventDuplicate(signature)) {
      logger.debug(`[Queue]: Skipping duplicate queue:current event`)
      return
    }

    logger.debug(`[Queue]: Current clip changed`)
    current.value = event.clip || undefined
  }

  function handleQueueCleared(): void {
    const signature = `queue:cleared:${Date.now()}`
    if (isEventDuplicate(signature)) {
      logger.debug('[Queue]: Skipping duplicate queue:cleared event')
      return
    }

    logger.debug('[Queue]: Queue cleared')
    upcoming.value.clear()
  }

  function handleQueueOpened(): void {
    logger.debug('[Queue]: Queue opened')
    isOpen.value = true
  }

  function handleQueueClosed(): void {
    logger.debug('[Queue]: Queue closed')
    isOpen.value = false
  }

  function handleHistoryCleared(): void {
    logger.debug('[Queue]: History cleared')
    history.value.clear()
  }

  /**
   * API Methods (send commands to server)
   */

  async function next(): Promise<void> {
    try {
      const response = await fetchWithAuth(`${API_URL}/api/queue/advance`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error(`Failed to advance queue: ${response.statusText}`)
      }

      logger.info('[Queue]: Advanced to next clip')
    } catch (error: unknown) {
      logger.error(`[Queue]: Failed to advance: ${error}`)
      throw error
    }
  }

  async function previous(): Promise<void> {
    try {
      const response = await fetchWithAuth(`${API_URL}/api/queue/previous`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error(`Failed to go to previous: ${response.statusText}`)
      }

      logger.info('[Queue]: Went to previous clip')
    } catch (error: unknown) {
      logger.error(`[Queue]: Failed to go to previous: ${error}`)
      throw error
    }
  }

  async function clear(): Promise<void> {
    try {
      const response = await fetchWithAuth(`${API_URL}/api/queue`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`Failed to clear queue: ${response.statusText}`)
      }

      logger.info('[Queue]: Cleared queue')
    } catch (error: unknown) {
      logger.error(`[Queue]: Failed to clear queue: ${error}`)
      throw error
    }
  }

  async function open(): Promise<void> {
    try {
      const response = await fetchWithAuth(`${API_URL}/api/queue/open`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error(`Failed to open queue: ${response.statusText}`)
      }

      logger.info('[Queue]: Opened queue')
    } catch (error: unknown) {
      logger.error(`[Queue]: Failed to open queue: ${error}`)
      throw error
    }
  }

  async function close(): Promise<void> {
    try {
      const response = await fetchWithAuth(`${API_URL}/api/queue/close`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error(`Failed to close queue: ${response.statusText}`)
      }

      logger.info('[Queue]: Closed queue')
    } catch (error: unknown) {
      logger.error(`[Queue]: Failed to close queue: ${error}`)
      throw error
    }
  }

  /**
   * Purge history (backend-synced)
   */
  async function purge(): Promise<void> {
    try {
      const response = await fetchWithAuth(`${API_URL}/api/queue/history`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`Failed to purge history: ${response.statusText}`)
      }

      logger.info('[Queue]: Purged history')
    } catch (error: unknown) {
      logger.error(`[Queue]: Failed to purge history: ${error}`)
      throw error
    }
  }

  function removeFromHistory(clip: Clip): void {
    history.value.remove(clip)
    logger.info(`[Queue]: Removed from history: ${clip.id}`)
  }

  /**
   * Add clip to queue via backend API
   * Used for manually adding clips (e.g., from history)
   */
  async function add(url: string, submitter: string): Promise<void> {
    try {
      const response = await fetchWithAuth(`${API_URL}/api/queue/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url, submitter })
      })

      if (!response.ok) {
        throw new Error(`Failed to submit clip: ${response.statusText}`)
      }

      logger.info(`[Queue]: Submitted clip: ${url}`)
    } catch (error: unknown) {
      logger.error(`[Queue]: Failed to submit clip: ${error}`)
      throw error
    }
  }

  /**
   * Remove clip from queue
   */
  async function remove(clipId: string): Promise<void> {
    try {
      const response = await fetchWithAuth(`${API_URL}/api/queue/remove`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clipId })
      })

      if (!response.ok) {
        throw new Error(`Failed to remove clip: ${response.statusText}`)
      }

      logger.info(`[Queue]: Removed clip: ${clipId}`)
    } catch (error: unknown) {
      logger.error(`[Queue]: Failed to remove clip: ${error}`)
      throw error
    }
  }

  /**
   * Play specific clip from queue (skip to it)
   */
  async function play(clipId: string): Promise<void> {
    try {
      const response = await fetchWithAuth(`${API_URL}/api/queue/play`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clipId })
      })

      if (!response.ok) {
        throw new Error(`Failed to play clip: ${response.statusText}`)
      }

      logger.info(`[Queue]: Playing clip: ${clipId}`)
    } catch (error: unknown) {
      logger.error(`[Queue]: Failed to play clip: ${error}`)
      throw error
    }
  }

  return {
    // State
    isOpen,
    history,
    current,
    upcoming,

    // Computed
    hasClips,
    isEmpty,
    size,

    // Lifecycle
    initialize,
    cleanup,

    // Server commands
    next,
    previous,
    clear,
    open,
    close,
    add,
    remove,
    play,

    // Local commands
    purge,
    removeFromHistory
  }
})
