import { onUnmounted, ref } from 'vue'

import type { Clip } from '@cq/platforms'

import { env } from '@/config'
import { fetchWithAuth } from '@/utils/api'

const { API_URL } = env

export interface PlayLogEntry {
  id: number
  clip: Clip
  playedAt: Date
  playedFor?: number
  completedAt?: Date
}

interface HistoryResponse {
  entries: PlayLogEntry[]
  nextCursor: string | null
  hasMore: boolean
  count: number
}

/**
 * Composable for history browsing with cursor-based pagination
 *
 * Features:
 * - Cursor-based pagination (efficient for large datasets)
 * - Infinite scroll support
 * - Error handling with retry logic
 * - Automatic cleanup on unmount
 */
export function useHistory(limit = 50) {
  const entries = ref<PlayLogEntry[]>([])
  const nextCursor = ref<string | null>(null)
  const hasMore = ref(true)
  const loading = ref(false)
  const error = ref<string | null>(null)

  let abortController: AbortController | null = null

  async function loadMore() {
    if (loading.value || !hasMore.value) return

    loading.value = true
    error.value = null

    abortController?.abort()
    abortController = new AbortController()

    try {
      const url = nextCursor.value
        ? `${API_URL}/api/history?limit=${limit}&cursor=${encodeURIComponent(nextCursor.value)}`
        : `${API_URL}/api/history?limit=${limit}`

      const response = await fetchWithAuth(url, {
        signal: abortController.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data: HistoryResponse = await response.json()

      const parsedEntries = data.entries.map((entry) => ({
        ...entry,
        playedAt: new Date(entry.playedAt),
        completedAt: entry.completedAt ? new Date(entry.completedAt) : undefined
      }))

      entries.value.push(...parsedEntries)
      nextCursor.value = data.nextCursor
      hasMore.value = data.hasMore
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }

      error.value = err instanceof Error ? err.message : 'Failed to load history'
      console.error('[History] Failed to load:', err)
    } finally {
      loading.value = false
    }
  }

  function reset() {
    abortController?.abort()
    entries.value = []
    nextCursor.value = null
    hasMore.value = true
    error.value = null
    loading.value = false
  }

  onUnmounted(() => {
    abortController?.abort()
  })

  return {
    entries,
    loading,
    error,
    hasMore,
    loadMore,
    reset
  }
}
