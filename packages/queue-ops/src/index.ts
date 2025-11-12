/**
 * Queue Operations Package
 * Centralized queue operation logic with rollback support
 */

import type { Clip, ClipList, PlayHistory } from '@cq/platforms'

export interface QueueState {
  current: Clip | null
  queue: ClipList
  playHistory: PlayHistory
  /**
   * Current position in play history (for navigation)
   * -1 = at end of history (playing from queue)
   * >= 0 = index in playHistory array (navigating through history)
   */
  historyPosition: number
}

export interface DatabaseOperations {
  updateClipStatus: (
    clipId: string,
    status: 'played' | 'approved' | 'pending' | 'rejected'
  ) => void | Promise<void>
  deleteClipsByStatus: (status: 'approved') => void | Promise<void>
  insertPlayLog: (clipId: string, playedAt?: Date) => Promise<number> | number // Returns play log ID
  deletePlayLogsByClipStatus: (status: 'played') => void | Promise<void>
}

export interface RollbackData {
  previousCurrent: Clip | null
  previousQueue?: Clip[]
  previousHistory?: Clip[]
}

/**
 * Advance to next clip
 *
 * Behavior depends on navigation state:
 * - If navigating history: Move forward in history timeline
 * - If at end of history: Log current clip and shift from queue
 */
export async function advanceQueue(
  state: QueueState,
  db: DatabaseOperations,
  toClipUUID: (clip: Clip) => string
): Promise<void> {
  // Check if we're navigating through history
  if (state.historyPosition >= 0) {
    // Move forward in history timeline
    const historyEntries = state.playHistory.getAll()

    if (state.historyPosition < historyEntries.length - 1) {
      // Still more history ahead - just move pointer
      state.historyPosition++
      state.current = historyEntries[state.historyPosition]!.clip
      return
    } else {
      // Reached end of history - try to switch to queue mode
      const nextClip = state.queue.shift()
      if (nextClip) {
        // Queue has clips - switch to queue mode
        state.historyPosition = -1
        state.current = nextClip
      }
      // else: queue is empty, stay on current history clip (don't change state)
      return
    }
  }

  // Normal mode: at end of history, playing from queue
  const previousCurrent = state.current
  let playLogId: number | null = null

  try {
    // Log current clip play to database and add to history
    if (state.current) {
      const clipId = toClipUUID(state.current)
      const playedAt = new Date()

      // Insert play log entry (returns ID)
      playLogId = await db.insertPlayLog(clipId, playedAt)

      // Update clip status to 'played'
      await db.updateClipStatus(clipId, 'played')

      // Add to in-memory play history
      state.playHistory.add({
        id: playLogId,
        clip: state.current,
        playedAt
      })
    }

    // Get next clip from queue
    const nextClip = state.queue.shift()
    state.current = nextClip ?? null
    state.historyPosition = -1 // Stay in queue mode
  } catch (error) {
    // Rollback in-memory changes on database failure
    // Note: Database rollback happens via transaction in db layer
    if (state.current) {
      state.queue.unshift(state.current)
    }
    state.current = previousCurrent
    throw error
  }
}

/**
 * Move to previous clip in the timeline
 *
 * Behavior depends on navigation state:
 * - If in queue mode (historyPosition = -1): Jump to last history entry
 * - If navigating history: Move back one position
 *
 * Note: Does not modify play history (immutable log)
 */
export async function previousClip(state: QueueState): Promise<void> {
  const historyEntries = state.playHistory.getAll()

  if (historyEntries.length === 0) {
    // No history to go back to
    return
  }

  if (state.historyPosition === -1) {
    // Currently in queue mode - jump to last history entry
    state.historyPosition = historyEntries.length - 1
    state.current = historyEntries[state.historyPosition]!.clip
  } else if (state.historyPosition > 0) {
    // Move back in history
    state.historyPosition--
    state.current = historyEntries[state.historyPosition]!.clip
  }
  // else: already at position 0, can't go further back
}

/**
 * Clear the queue
 * Removes all approved clips from queue and database
 */
export async function clearQueue(state: QueueState, db: DatabaseOperations): Promise<void> {
  const previousQueue = state.queue.toArray()

  try {
    state.queue.clear()
    await db.deleteClipsByStatus('approved')
  } catch (error) {
    // Rollback in-memory changes on database failure
    previousQueue.forEach((clip: Clip) => state.queue.add(clip))
    throw error
  }
}

/**
 * Clear play history
 * Removes all play log entries from history and database
 */
export async function clearHistory(state: QueueState, db: DatabaseOperations): Promise<void> {
  await db.deletePlayLogsByClipStatus('played')
  state.playHistory.clear()
}

/**
 * Play specific clip from queue
 * Logs current clip to history and jumps to specified queue clip
 */
export async function playClip(
  state: QueueState,
  db: DatabaseOperations,
  clipToPlay: Clip,
  toClipUUID: (clip: Clip) => string
): Promise<void> {
  const previousCurrent = state.current
  const previousPosition = state.historyPosition
  let playLogId: number | null = null

  try {
    // Log current clip only if we're in queue mode (not navigating history)
    if (state.current && state.historyPosition === -1) {
      const clipId = toClipUUID(state.current)
      const playedAt = new Date()

      // Insert play log entry (returns ID)
      playLogId = await db.insertPlayLog(clipId, playedAt)

      // Update clip status to 'played'
      await db.updateClipStatus(clipId, 'played')

      // Add to in-memory play history
      state.playHistory.add({
        id: playLogId,
        clip: state.current,
        playedAt
      })
    }

    // Remove clip from queue and set as current
    state.queue.remove(clipToPlay)
    state.current = clipToPlay

    // Reset to queue mode (not navigating history)
    state.historyPosition = -1
  } catch (error) {
    // Rollback in-memory changes on database failure
    if (clipToPlay) {
      state.queue.add(clipToPlay)
    }
    state.current = previousCurrent
    state.historyPosition = previousPosition
    throw error
  }
}

/**
 * Jump to a specific clip from history (for Timeline navigation)
 * Sets navigation position to that clip in the history timeline
 * Preserves the current clip by adding it to the front of the queue
 */
export async function jumpToHistoryClip(
  state: QueueState,
  historyClip: Clip,
  toClipUUID: (clip: Clip) => string
): Promise<void> {
  const clipId = toClipUUID(historyClip)

  // Find clip in history
  const historyEntries = state.playHistory.getAll()
  const index = historyEntries.findIndex((e) => toClipUUID(e.clip) === clipId)

  if (index === -1) {
    throw new Error('Clip not found in history')
  }

  // If we have a current clip, preserve it by adding to the front of the queue
  // This applies whether we're in queue mode or already navigating history
  if (state.current) {
    const currentClipId = toClipUUID(state.current)
    const targetClipId = toClipUUID(historyClip)

    // Only preserve if we're jumping to a different clip
    if (currentClipId !== targetClipId) {
      // Check if current clip is not already in queue
      const queueClips = state.queue.toArray()
      const alreadyInQueue = queueClips.some((c) => toClipUUID(c) === currentClipId)

      if (!alreadyInQueue) {
        state.queue.unshift(state.current)
      }
    }
  }

  // Set history position and current clip
  state.historyPosition = index
  state.current = historyEntries[index]!.clip
}
