import { reactive } from 'vue'

export interface AuthEvent {
  type: 'unauthorized' | 'forbidden' | 'expired'
  message: string
  timestamp: number
}

/**
 * Auth event queue system
 *
 * Uses a queue to ensure all auth errors are processed, even if multiple
 * errors occur rapidly. Events are automatically deduplicated to prevent
 * showing the same error multiple times in quick succession.
 */
export const authEvents = reactive<{
  queue: AuthEvent[]
}>({
  queue: []
})

const DEDUP_WINDOW_MS = 5000 // 5 seconds
const MAX_QUEUE_SIZE = 10 // Prevent memory issues

/**
 * Emit an auth event to the queue
 * Automatically deduplicates events of the same type within a time window
 */
export function emitAuthEvent(event: Omit<AuthEvent, 'timestamp'>): void {
  const now = Date.now()
  const newEvent: AuthEvent = { ...event, timestamp: now }

  // Remove events older than dedup window
  authEvents.queue = authEvents.queue.filter((e) => now - e.timestamp < DEDUP_WINDOW_MS)

  // Check if this type of event was already emitted recently
  const isDuplicate = authEvents.queue.some(
    (e) => e.type === event.type && now - e.timestamp < DEDUP_WINDOW_MS
  )

  if (!isDuplicate) {
    // Add to queue, respecting max size
    if (authEvents.queue.length >= MAX_QUEUE_SIZE) {
      authEvents.queue.shift() // Remove oldest
    }
    authEvents.queue.push(newEvent)
  }
}

/**
 * Consume the next auth event from the queue
 * Used by toast notification system to display errors
 */
export function consumeAuthEvent(): AuthEvent | undefined {
  return authEvents.queue.shift()
}

/**
 * Clear all pending auth events
 * Useful for cleanup after logout or navigation
 */
export function clearAuthEvents(): void {
  authEvents.queue = []
}
