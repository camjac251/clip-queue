import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TTLCache } from '../cache'

describe('TTLCache', () => {
  let cache: TTLCache<string, string>

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cache?.destroy()
    vi.useRealTimers()
  })

  describe('basic operations', () => {
    beforeEach(() => {
      cache = new TTLCache<string, string>(5000) // 5 second TTL
    })

    it('stores and retrieves values', () => {
      cache.set('key1', 'value1')

      expect(cache.get('key1')).toBe('value1')
      expect(cache.has('key1')).toBe(true)
    })

    it('returns undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined()
      expect(cache.has('nonexistent')).toBe(false)
    })

    it('supports multiple entries', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      expect(cache.size).toBe(3)
      expect(cache.get('key1')).toBe('value1')
      expect(cache.get('key2')).toBe('value2')
      expect(cache.get('key3')).toBe('value3')
    })

    it('overwrites existing keys', () => {
      cache.set('key1', 'value1')
      cache.set('key1', 'value2')

      expect(cache.get('key1')).toBe('value2')
      expect(cache.size).toBe(1)
    })

    it('deletes specific keys', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      const deleted = cache.delete('key1')

      expect(deleted).toBe(true)
      expect(cache.get('key1')).toBeUndefined()
      expect(cache.get('key2')).toBe('value2')
      expect(cache.size).toBe(1)
    })

    it('returns false when deleting non-existent key', () => {
      const deleted = cache.delete('nonexistent')

      expect(deleted).toBe(false)
    })

    it('clears all entries', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      cache.clear()

      expect(cache.size).toBe(0)
      expect(cache.get('key1')).toBeUndefined()
      expect(cache.get('key2')).toBeUndefined()
    })
  })

  describe('TTL expiration', () => {
    beforeEach(() => {
      cache = new TTLCache<string, string>(5000) // 5 second TTL
    })

    it('expires entries after TTL', () => {
      cache.set('key1', 'value1')

      // Initially available
      expect(cache.get('key1')).toBe('value1')

      // Advance time past TTL
      vi.advanceTimersByTime(6000)

      // Should be expired
      expect(cache.get('key1')).toBeUndefined()
      expect(cache.has('key1')).toBe(false)
    })

    it('keeps entries within TTL', () => {
      cache.set('key1', 'value1')

      // Advance time but not past TTL
      vi.advanceTimersByTime(4000)

      // Should still be available
      expect(cache.get('key1')).toBe('value1')
      expect(cache.has('key1')).toBe(true)
    })

    it('supports custom TTL per entry', () => {
      cache.set('short', 'value1', 2000) // 2 second TTL
      cache.set('long', 'value2', 10000) // 10 second TTL

      // Advance 3 seconds
      vi.advanceTimersByTime(3000)

      // Short should be expired, long still valid
      expect(cache.get('short')).toBeUndefined()
      expect(cache.get('long')).toBe('value2')
    })

    it('removes expired entries on access', () => {
      cache.set('key1', 'value1')
      expect(cache.size).toBe(1)

      // Expire the entry
      vi.advanceTimersByTime(6000)

      // Access triggers deletion
      cache.get('key1')

      expect(cache.size).toBe(0)
    })
  })

  describe('automatic cleanup', () => {
    beforeEach(() => {
      // Use shorter cleanup interval for testing
      cache = new TTLCache<string, string>(5000, 1000) // 1 second cleanup interval
    })

    it('automatically removes expired entries', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      expect(cache.size).toBe(2)

      // Advance past TTL
      vi.advanceTimersByTime(6000)

      // Trigger cleanup interval
      vi.advanceTimersByTime(1000)

      // Entries should be removed by cleanup
      expect(cache.size).toBe(0)
    })

    it('keeps valid entries during cleanup', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      // Advance time but not past TTL
      vi.advanceTimersByTime(3000)

      // Trigger cleanup
      vi.advanceTimersByTime(1000)

      // Entries should still be there
      expect(cache.size).toBe(2)
    })

    it('selectively removes only expired entries', () => {
      cache.set('expired', 'value1')

      // Advance past TTL for first entry
      vi.advanceTimersByTime(6000)

      // Add new entry
      cache.set('fresh', 'value2')

      // Trigger cleanup
      vi.advanceTimersByTime(1000)

      // Only expired entry should be removed
      expect(cache.get('expired')).toBeUndefined()
      expect(cache.get('fresh')).toBe('value2')
      expect(cache.size).toBe(1)
    })
  })

  describe('destroy', () => {
    beforeEach(() => {
      cache = new TTLCache<string, string>(5000, 1000)
    })

    it('stops cleanup interval and clears cache', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      cache.destroy()

      expect(cache.size).toBe(0)

      // Advance time - cleanup should not run
      vi.advanceTimersByTime(10000)

      // Cache should remain empty
      expect(cache.size).toBe(0)
    })

    it('prevents cleanup from running after destroy', () => {
      cache.set('key1', 'value1')

      cache.destroy()

      // Advance past cleanup interval
      vi.advanceTimersByTime(2000)

      // Size should be 0 (cleared on destroy), not affected by cleanup
      expect(cache.size).toBe(0)
    })
  })

  describe('complex data types', () => {
    it('stores objects', () => {
      const cache = new TTLCache<string, { id: number; name: string }>(5000)

      const obj = { id: 1, name: 'test' }
      cache.set('obj1', obj)

      expect(cache.get('obj1')).toEqual(obj)

      cache.destroy()
    })

    it('stores arrays', () => {
      const cache = new TTLCache<string, number[]>(5000)

      const arr = [1, 2, 3, 4, 5]
      cache.set('arr1', arr)

      expect(cache.get('arr1')).toEqual(arr)

      cache.destroy()
    })

    it('handles different key types', () => {
      const cache = new TTLCache<number, string>(5000)

      cache.set(1, 'one')
      cache.set(2, 'two')

      expect(cache.get(1)).toBe('one')
      expect(cache.get(2)).toBe('two')

      cache.destroy()
    })
  })

  describe('edge cases', () => {
    beforeEach(() => {
      cache = new TTLCache<string, string>(5000)
    })

    it('handles zero TTL', () => {
      cache.set('key1', 'value1', 0)

      // Zero TTL means expires at current time, but Date.now() might not have advanced yet
      // Advance time to ensure expiration
      vi.advanceTimersByTime(1)
      expect(cache.get('key1')).toBeUndefined()
    })

    it('handles very large TTL', () => {
      const largeTTL = 1000 * 60 * 60 * 24 * 365 // 1 year
      cache.set('key1', 'value1', largeTTL)

      // Should still be available after reasonable time
      vi.advanceTimersByTime(10000)
      expect(cache.get('key1')).toBe('value1')
    })

    it('handles empty string keys', () => {
      cache.set('', 'empty key')

      expect(cache.get('')).toBe('empty key')
    })

    it('handles undefined values', () => {
      const cache = new TTLCache<string, string | undefined>(5000)

      cache.set('key1', undefined)

      // get() returns undefined for both missing and undefined values
      // has() returns false because it uses get() !== undefined check
      // This is a known limitation - undefined values not distinguishable from missing keys
      expect(cache.has('key1')).toBe(false)
      expect(cache.get('key1')).toBeUndefined()

      cache.destroy()
    })
  })
})
