/**
 * Queue Operations Package
 * Centralized queue operation logic with rollback support
 */

import type { Clip, ClipList } from '@cq/platforms'

export interface QueueState {
  current: Clip | null
  queue: ClipList
  history: ClipList
}

export interface DatabaseOperations {
  updateClipStatus: (
    clipId: string,
    status: 'played' | 'approved' | 'pending' | 'rejected'
  ) => void | Promise<void>
  deleteClipsByStatus: (status: 'approved') => void | Promise<void>
}

export interface RollbackData {
  previousCurrent: Clip | null
  previousQueue?: Clip[]
  previousHistory?: Clip[]
}

/**
 * Advance to next clip in queue
 * Moves current clip to history and shifts next from queue
 */
export async function advanceQueue(
  state: QueueState,
  db: DatabaseOperations,
  toClipUUID: (clip: Clip) => string
): Promise<void> {
  const previousCurrent = state.current

  try {
    // Move current to history
    if (state.current) {
      state.history.add(state.current)
      const clipId = toClipUUID(state.current)
      await db.updateClipStatus(clipId, 'played')
    }

    // Get next clip
    const nextClip = state.queue.shift()
    state.current = nextClip ?? null
  } catch (error) {
    // Rollback in-memory changes on database failure
    if (previousCurrent) {
      state.history.remove(previousCurrent)
    }
    if (state.current) {
      state.queue.unshift(state.current)
    }
    state.current = previousCurrent
    throw error
  }
}

/**
 * Move to previous clip from history
 * Moves current back to queue and pops from history
 */
export async function previousClip(state: QueueState): Promise<void> {
  // Move current back to upcoming
  if (state.current) {
    state.queue.unshift(state.current)
  }

  // Pop from history
  const prevClip = state.history.toArray().pop()
  if (prevClip) {
    state.history.remove(prevClip)
    state.current = prevClip
  } else {
    state.current = null
  }
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
 * Clear history
 * Removes all clips from history
 */
export async function clearHistory(state: QueueState): Promise<void> {
  state.history.clear()
}

/**
 * Play specific clip
 * Moves specified clip to current position
 */
export async function playClip(
  state: QueueState,
  db: DatabaseOperations,
  clipToPlay: Clip,
  toClipUUID: (clip: Clip) => string
): Promise<void> {
  const previousCurrent = state.current

  try {
    // Move current to history if exists
    if (state.current) {
      state.history.add(state.current)
      const clipId = toClipUUID(state.current)
      await db.updateClipStatus(clipId, 'played')
    }

    // Remove clip from queue and set as current
    state.queue.remove(clipToPlay)
    state.current = clipToPlay
  } catch (error) {
    // Rollback
    if (previousCurrent) {
      state.history.remove(previousCurrent)
    }
    if (clipToPlay) {
      state.queue.add(clipToPlay)
    }
    state.current = previousCurrent
    throw error
  }
}
