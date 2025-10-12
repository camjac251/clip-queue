/**
 * Shared Cache Utilities
 * Generic TTL cache with automatic cleanup
 */

export interface CacheEntry<T> {
  value: T
  expiresAt: number
}

/**
 * Generic TTL Cache
 * Automatically cleans up expired entries at regular intervals
 */
export class TTLCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null
  private readonly ttl: number
  private readonly cleanupIntervalMs: number

  constructor(
    ttlMs: number,
    cleanupIntervalMs: number = 60_000 // 1 minute default
  ) {
    this.ttl = ttlMs
    this.cleanupIntervalMs = cleanupIntervalMs
    this.startCleanup()
  }

  /**
   * Get value from cache if not expired
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key)
    if (!entry) {
      return undefined
    }

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key)
      return undefined
    }

    return entry.value
  }

  /**
   * Set value in cache with TTL
   */
  set(key: K, value: V, customTtl?: number): void {
    const ttl = customTtl ?? this.ttl
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl
    })
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: K): boolean {
    return this.get(key) !== undefined
  }

  /**
   * Delete specific key
   */
  delete(key: K): boolean {
    return this.cache.delete(key)
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get current cache size
   */
  get size(): number {
    return this.cache.size
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.cache.entries()) {
        if (entry.expiresAt < now) {
          this.cache.delete(key)
        }
      }
    }, this.cleanupIntervalMs)
  }

  /**
   * Stop cleanup interval (for cleanup)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.cache.clear()
  }
}
