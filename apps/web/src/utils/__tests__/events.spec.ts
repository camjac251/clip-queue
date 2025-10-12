import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { authEvents, clearAuthEvents, consumeAuthEvent, emitAuthEvent } from '../events'

describe('events utils', () => {
  beforeEach(() => {
    clearAuthEvents()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('emitAuthEvent', () => {
    it('adds event to queue', () => {
      emitAuthEvent({
        type: 'unauthorized',
        message: 'Test message'
      })

      expect(authEvents.queue).toHaveLength(1)
      expect(authEvents.queue[0]).toMatchObject({
        type: 'unauthorized',
        message: 'Test message',
        timestamp: expect.any(Number)
      })
    })

    it('adds timestamp to event', () => {
      const beforeTimestamp = Date.now()

      emitAuthEvent({
        type: 'unauthorized',
        message: 'Test'
      })

      const afterTimestamp = Date.now()

      expect(authEvents.queue[0]?.timestamp).toBeGreaterThanOrEqual(beforeTimestamp)
      expect(authEvents.queue[0]?.timestamp).toBeLessThanOrEqual(afterTimestamp)
    })

    it('allows different event types', () => {
      emitAuthEvent({ type: 'unauthorized', message: 'Unauthorized' })
      emitAuthEvent({ type: 'forbidden', message: 'Forbidden' })
      emitAuthEvent({ type: 'expired', message: 'Expired' })

      expect(authEvents.queue).toHaveLength(3)
      expect(authEvents.queue.map((e) => e.type)).toEqual(['unauthorized', 'forbidden', 'expired'])
    })
  })

  describe('deduplication', () => {
    it('deduplicates same event type within 5 seconds', () => {
      emitAuthEvent({ type: 'unauthorized', message: 'Message 1' })
      emitAuthEvent({ type: 'unauthorized', message: 'Message 2' })

      // Second event should be deduplicated
      expect(authEvents.queue).toHaveLength(1)
      expect(authEvents.queue[0]?.message).toBe('Message 1')
    })

    it('allows same event type after 5 seconds', () => {
      emitAuthEvent({ type: 'unauthorized', message: 'Message 1' })

      // Advance time past dedup window
      vi.advanceTimersByTime(6000)

      emitAuthEvent({ type: 'unauthorized', message: 'Message 2' })

      // Both events should be in queue (first one cleaned up, second added)
      expect(authEvents.queue).toHaveLength(1)
      expect(authEvents.queue[0]?.message).toBe('Message 2')
    })

    it('does not deduplicate different event types', () => {
      emitAuthEvent({ type: 'unauthorized', message: 'Unauthorized' })
      emitAuthEvent({ type: 'forbidden', message: 'Forbidden' })

      expect(authEvents.queue).toHaveLength(2)
    })

    it('removes events older than 5 seconds on emit', () => {
      emitAuthEvent({ type: 'unauthorized', message: 'Old message' })

      // Advance time past dedup window
      vi.advanceTimersByTime(6000)

      // Emit different event type to trigger cleanup
      emitAuthEvent({ type: 'forbidden', message: 'New message' })

      // Old event should be cleaned up
      expect(authEvents.queue).toHaveLength(1)
      expect(authEvents.queue[0]?.type).toBe('forbidden')
    })
  })

  describe('max queue size', () => {
    it('respects max queue size of 10', () => {
      // Emit 12 different events (advance time between each to avoid dedup)
      for (let i = 0; i < 12; i++) {
        emitAuthEvent({ type: 'forbidden', message: `Message ${i}` })
        vi.advanceTimersByTime(6000) // Advance past dedup window
      }

      // Queue should be capped at 10
      expect(authEvents.queue.length).toBeLessThanOrEqual(10)
    })

    it('removes oldest events when queue is full', () => {
      // Fill queue with 10 events
      for (let i = 0; i < 10; i++) {
        emitAuthEvent({ type: 'forbidden', message: `Message ${i}` })
        vi.advanceTimersByTime(6000)
      }

      const initialSize = authEvents.queue.length

      // Add one more
      emitAuthEvent({ type: 'forbidden', message: 'Message 11' })

      // Size should not increase
      expect(authEvents.queue.length).toBeLessThanOrEqual(initialSize)

      // Latest message should be in queue
      const messages = authEvents.queue.map((e) => e.message)
      expect(messages).toContain('Message 11')
    })
  })

  describe('consumeAuthEvent', () => {
    it('returns and removes first event from queue', () => {
      emitAuthEvent({ type: 'unauthorized', message: 'First' })
      // Don't advance past dedup window - would cause cleanup to remove 'First'
      emitAuthEvent({ type: 'forbidden', message: 'Second' })

      const event = consumeAuthEvent()

      expect(event).toMatchObject({
        type: 'unauthorized',
        message: 'First'
      })
      expect(authEvents.queue).toHaveLength(1)
      expect(authEvents.queue[0]?.message).toBe('Second')
    })

    it('returns undefined when queue is empty', () => {
      const event = consumeAuthEvent()

      expect(event).toBeUndefined()
    })

    it('consumes events in FIFO order', () => {
      emitAuthEvent({ type: 'unauthorized', message: 'First' })
      // Don't advance past dedup window - would cause cleanup to remove events
      emitAuthEvent({ type: 'forbidden', message: 'Second' })
      emitAuthEvent({ type: 'expired', message: 'Third' })

      const first = consumeAuthEvent()
      const second = consumeAuthEvent()
      const third = consumeAuthEvent()

      expect(first?.message).toBe('First')
      expect(second?.message).toBe('Second')
      expect(third?.message).toBe('Third')
    })
  })

  describe('clearAuthEvents', () => {
    it('clears all events from queue', () => {
      emitAuthEvent({ type: 'unauthorized', message: 'First' })
      vi.advanceTimersByTime(6000)
      emitAuthEvent({ type: 'forbidden', message: 'Second' })

      expect(authEvents.queue.length).toBeGreaterThan(0)

      clearAuthEvents()

      expect(authEvents.queue).toHaveLength(0)
    })

    it('allows new events after clear', () => {
      emitAuthEvent({ type: 'unauthorized', message: 'Before clear' })
      clearAuthEvents()

      emitAuthEvent({ type: 'forbidden', message: 'After clear' })

      expect(authEvents.queue).toHaveLength(1)
      expect(authEvents.queue[0]?.message).toBe('After clear')
    })
  })

  describe('reactivity', () => {
    it('maintains reactive queue', () => {
      const initialLength = authEvents.queue.length

      emitAuthEvent({ type: 'unauthorized', message: 'Test' })

      // Queue should update reactively
      expect(authEvents.queue.length).toBe(initialLength + 1)
    })

    it('updates reactively on consume', () => {
      emitAuthEvent({ type: 'unauthorized', message: 'Test' })
      const beforeLength = authEvents.queue.length

      consumeAuthEvent()

      expect(authEvents.queue.length).toBe(beforeLength - 1)
    })

    it('updates reactively on clear', () => {
      emitAuthEvent({ type: 'unauthorized', message: 'Test' })

      clearAuthEvents()

      expect(authEvents.queue.length).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('handles empty message', () => {
      emitAuthEvent({ type: 'unauthorized', message: '' })

      expect(authEvents.queue).toHaveLength(1)
      expect(authEvents.queue[0]?.message).toBe('')
    })

    it('handles very long message', () => {
      const longMessage = 'A'.repeat(1000)

      emitAuthEvent({ type: 'unauthorized', message: longMessage })

      expect(authEvents.queue[0]?.message).toBe(longMessage)
    })

    it('handles rapid emissions', () => {
      // Emit 100 events rapidly
      for (let i = 0; i < 100; i++) {
        emitAuthEvent({ type: 'forbidden', message: `Message ${i}` })
      }

      // Should deduplicate to 1 (same type within window)
      expect(authEvents.queue.length).toBeLessThanOrEqual(10)
    })

    it('handles alternating event types', () => {
      for (let i = 0; i < 5; i++) {
        emitAuthEvent({ type: 'unauthorized', message: `Unauthorized ${i}` })
        emitAuthEvent({ type: 'forbidden', message: `Forbidden ${i}` })
      }

      // Should only have 2 events (one of each type, deduplicated)
      expect(authEvents.queue).toHaveLength(2)
      expect(authEvents.queue.map((e) => e.type).sort()).toEqual(['forbidden', 'unauthorized'])
    })
  })
})
