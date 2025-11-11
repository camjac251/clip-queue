import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Clip } from '@cq/platforms'
import { Platform } from '@cq/constants'
import { ClipList, PlayHistory } from '@cq/platforms'
import { ContentType } from '@cq/schemas/clip'

import type { DatabaseOperations, QueueState } from '../index'
import {
  advanceQueue,
  clearHistory,
  clearQueue,
  jumpToHistoryClip,
  playClip,
  previousClip
} from '../index'

// Helper to create mock clip
function createMockClip(id: string, title: string): Clip {
  return {
    id,
    platform: Platform.TWITCH,
    contentType: ContentType.CLIP,
    url: `https://twitch.tv/clip/${id}`,
    embedUrl: `https://clips.twitch.tv/embed?clip=${id}`,
    thumbnailUrl: `https://clips-media-assets2.twitch.tv/${id}.jpg`,
    title,
    channel: 'testchannel',
    creator: 'testcreator',
    submitters: ['user1'],
    createdAt: new Date().toISOString()
  }
}

// Mock UUID generator (matches packages/platforms/src/utils.ts)
function toClipUUID(clip: Clip): string {
  const base = `${clip.platform.toString().toLowerCase()}:${clip.contentType.toLowerCase()}:${clip.id.toLowerCase()}`

  // For VODs and Highlights, timestamp is semantically significant
  if (
    (clip.contentType === ContentType.VOD || clip.contentType === ContentType.HIGHLIGHT) &&
    clip.timestamp !== undefined &&
    clip.timestamp > 0
  ) {
    return `${base}:${clip.timestamp}`
  }

  return base
}

describe('queue-ops', () => {
  let state: QueueState
  let mockDb: DatabaseOperations

  beforeEach(() => {
    state = {
      current: null,
      queue: new ClipList(),
      playHistory: new PlayHistory(),
      historyPosition: -1 // -1 = queue mode, >= 0 = navigating history
    }

    mockDb = {
      updateClipStatus: vi.fn(),
      deleteClipsByStatus: vi.fn(),
      insertPlayLog: vi.fn().mockResolvedValue(1),
      deletePlayLogsByClipStatus: vi.fn()
    }
  })

  describe('advanceQueue', () => {
    it('advances to next clip and moves current to history', async () => {
      const clip1 = createMockClip('clip1', 'First Clip')
      const clip2 = createMockClip('clip2', 'Second Clip')

      state.current = clip1
      state.queue.add(clip2)

      await advanceQueue(state, mockDb, toClipUUID)

      expect(state.current).toEqual(clip2)
      const history = state.playHistory.getAll()
      expect(history).toHaveLength(1)
      expect(history[0]!.clip).toEqual(clip1)
      expect(state.queue.toArray()).toHaveLength(0)

      expect(mockDb.updateClipStatus).toHaveBeenCalledWith('twitch:clip:clip1', 'played')
      expect(mockDb.insertPlayLog).toHaveBeenCalled()
    })

    it('handles empty queue', async () => {
      const clip1 = createMockClip('clip1', 'First Clip')
      state.current = clip1

      await advanceQueue(state, mockDb, toClipUUID)

      expect(state.current).toBeNull()
      const history = state.playHistory.getAll()
      expect(history).toHaveLength(1)
      expect(history[0]!.clip).toEqual(clip1)
    })

    it('handles no current clip', async () => {
      const clip1 = createMockClip('clip1', 'First Clip')
      state.queue.add(clip1)

      await advanceQueue(state, mockDb, toClipUUID)

      expect(state.current).toEqual(clip1)
      expect(state.playHistory.getAll()).toHaveLength(0)
      expect(mockDb.updateClipStatus).not.toHaveBeenCalled()
    })

    it('rolls back on database error', async () => {
      const clip1 = createMockClip('clip1', 'First Clip')
      const clip2 = createMockClip('clip2', 'Second Clip')

      state.current = clip1
      state.queue.add(clip2)

      // Mock database failure
      vi.mocked(mockDb.updateClipStatus).mockRejectedValueOnce(new Error('DB Error'))

      await expect(advanceQueue(state, mockDb, toClipUUID)).rejects.toThrow('DB Error')

      // State should be rolled back
      expect(state.current).toEqual(clip1)
      expect(state.playHistory.getAll()).toHaveLength(0)
      expect(state.queue.toArray()).toContainEqual(clip2)
    })
  })

  describe('previousClip', () => {
    it('navigates to last history entry from queue mode', async () => {
      const clip1 = createMockClip('clip1', 'First Clip')
      const clip2 = createMockClip('clip2', 'Second Clip')

      state.current = clip2
      state.historyPosition = -1 // Queue mode
      state.playHistory.add({ id: 1, clip: clip1, playedAt: new Date() })

      await previousClip(state)

      expect(state.current).toEqual(clip1)
      expect(state.historyPosition).toBe(0) // Now navigating history at position 0
      expect(state.playHistory.getAll()).toHaveLength(1) // History unchanged
    })

    it('navigates backwards through history', async () => {
      const clip1 = createMockClip('clip1', 'First')
      const clip2 = createMockClip('clip2', 'Second')
      const clip3 = createMockClip('clip3', 'Third')

      state.playHistory.add({ id: 1, clip: clip1, playedAt: new Date() })
      state.playHistory.add({ id: 2, clip: clip2, playedAt: new Date() })
      state.playHistory.add({ id: 3, clip: clip3, playedAt: new Date() })
      state.current = clip3
      state.historyPosition = 2 // At clip3 (last entry)

      await previousClip(state)

      expect(state.current).toEqual(clip2)
      expect(state.historyPosition).toBe(1) // Moved back to clip2
    })

    it('does not go back beyond start of history', async () => {
      const clip1 = createMockClip('clip1', 'First Clip')

      state.playHistory.add({ id: 1, clip: clip1, playedAt: new Date() })
      state.current = clip1
      state.historyPosition = 0 // Already at first entry

      await previousClip(state)

      expect(state.current).toEqual(clip1) // Unchanged
      expect(state.historyPosition).toBe(0) // Still at position 0
    })

    it('handles empty history gracefully', async () => {
      const clip1 = createMockClip('clip1', 'Current Clip')
      state.current = clip1
      state.historyPosition = -1 // Queue mode

      await previousClip(state)

      expect(state.current).toEqual(clip1) // No change
      expect(state.historyPosition).toBe(-1) // Still in queue mode
    })
  })

  describe('clearQueue', () => {
    it('clears all clips from queue and database', async () => {
      const clip1 = createMockClip('clip1', 'First Clip')
      const clip2 = createMockClip('clip2', 'Second Clip')

      state.queue.add(clip1)
      state.queue.add(clip2)

      await clearQueue(state, mockDb)

      expect(state.queue.toArray()).toHaveLength(0)
      expect(mockDb.deleteClipsByStatus).toHaveBeenCalledWith('approved')
    })

    it('rolls back on database error', async () => {
      const clip1 = createMockClip('clip1', 'First Clip')
      const clip2 = createMockClip('clip2', 'Second Clip')

      state.queue.add(clip1)
      state.queue.add(clip2)

      // Mock database failure
      vi.mocked(mockDb.deleteClipsByStatus).mockRejectedValueOnce(new Error('DB Error'))

      await expect(clearQueue(state, mockDb)).rejects.toThrow('DB Error')

      // Queue should be restored
      expect(state.queue.toArray()).toHaveLength(2)
      expect(state.queue.toArray()).toContainEqual(clip1)
      expect(state.queue.toArray()).toContainEqual(clip2)
    })

    it('handles empty queue', async () => {
      await clearQueue(state, mockDb)

      expect(state.queue.toArray()).toHaveLength(0)
      expect(mockDb.deleteClipsByStatus).toHaveBeenCalled()
    })
  })

  describe('clearHistory', () => {
    it('clears all clips from history', async () => {
      const clip1 = createMockClip('clip1', 'First Clip')
      const clip2 = createMockClip('clip2', 'Second Clip')

      state.playHistory.add({ id: 1, clip: clip1, playedAt: new Date() })
      state.playHistory.add({ id: 2, clip: clip2, playedAt: new Date() })

      await clearHistory(state, mockDb)

      expect(state.playHistory.getAll()).toHaveLength(0)
      expect(mockDb.deletePlayLogsByClipStatus).toHaveBeenCalledWith('played')
    })

    it('handles empty history', async () => {
      await clearHistory(state, mockDb)

      expect(state.playHistory.getAll()).toHaveLength(0)
      expect(mockDb.deletePlayLogsByClipStatus).toHaveBeenCalledWith('played')
    })
  })

  describe('playClip', () => {
    it('plays specific clip and moves current to history', async () => {
      const clip1 = createMockClip('clip1', 'Current Clip')
      const clip2 = createMockClip('clip2', 'Next Clip')
      const clip3 = createMockClip('clip3', 'Clip to Play')

      state.current = clip1
      state.queue.add(clip2)
      state.queue.add(clip3)

      await playClip(state, mockDb, clip3, toClipUUID)

      expect(state.current).toEqual(clip3)
      const history = state.playHistory.getAll()
      expect(history).toHaveLength(1)
      expect(history[0]!.clip).toEqual(clip1)
      expect(state.queue.toArray()).not.toContainEqual(clip3)
      expect(state.queue.toArray()).toContainEqual(clip2)

      expect(mockDb.updateClipStatus).toHaveBeenCalledWith('twitch:clip:clip1', 'played')
      expect(mockDb.insertPlayLog).toHaveBeenCalled()
    })

    it('plays clip when no current clip', async () => {
      const clip1 = createMockClip('clip1', 'Clip to Play')

      state.queue.add(clip1)

      await playClip(state, mockDb, clip1, toClipUUID)

      expect(state.current).toEqual(clip1)
      expect(state.queue.toArray()).not.toContainEqual(clip1)
      expect(mockDb.updateClipStatus).not.toHaveBeenCalled()
    })

    it('rolls back on database error', async () => {
      const clip1 = createMockClip('clip1', 'Current Clip')
      const clip2 = createMockClip('clip2', 'Clip to Play')

      state.current = clip1
      state.queue.add(clip2)

      // Mock database failure
      vi.mocked(mockDb.updateClipStatus).mockRejectedValueOnce(new Error('DB Error'))

      await expect(playClip(state, mockDb, clip2, toClipUUID)).rejects.toThrow('DB Error')

      // State should be rolled back
      expect(state.current).toEqual(clip1)
      expect(state.playHistory.getAll()).toHaveLength(0)
      expect(state.queue.toArray()).toContainEqual(clip2)
    })

    it('handles playing first clip in queue', async () => {
      const clip1 = createMockClip('clip1', 'First in Queue')
      const clip2 = createMockClip('clip2', 'Second in Queue')

      state.queue.add(clip1)
      state.queue.add(clip2)

      await playClip(state, mockDb, clip1, toClipUUID)

      expect(state.current).toEqual(clip1)
      expect(state.queue.toArray()).toHaveLength(1)
      expect(state.queue.toArray()).toContainEqual(clip2)
    })
  })

  describe('race condition prevention', () => {
    it('maintains consistency during rapid operations', async () => {
      const clips = Array.from({ length: 5 }, (_, i) => createMockClip(`clip${i}`, `Clip ${i}`))

      clips.forEach((clip) => state.queue.add(clip))

      // First advance: clip0 becomes current
      await advanceQueue(state, mockDb, toClipUUID)
      // Second advance: clip0 -> history, clip1 becomes current
      await advanceQueue(state, mockDb, toClipUUID)
      // Third advance: clip1 -> history, clip2 becomes current
      await advanceQueue(state, mockDb, toClipUUID)

      // Should have clip0 and clip1 in history
      expect(state.playHistory.getAll()).toHaveLength(2)
      // Should have clip3 and clip4 remaining in queue
      expect(state.queue.toArray()).toHaveLength(2)
      // Current should be clip2
      expect(state.current?.id).toBe('clip2')
    })

    it('handles interleaved operations correctly', async () => {
      const clip1 = createMockClip('clip1', 'Clip 1')
      const clip2 = createMockClip('clip2', 'Clip 2')
      const clip3 = createMockClip('clip3', 'Clip 3')

      state.queue.add(clip1)
      state.queue.add(clip2)
      state.queue.add(clip3)

      // Advance twice: clip1 and clip2 to history
      await advanceQueue(state, mockDb, toClipUUID)
      expect(state.current).toEqual(clip1)
      expect(state.historyPosition).toBe(-1) // Queue mode

      await advanceQueue(state, mockDb, toClipUUID)
      expect(state.current).toEqual(clip2)
      expect(state.playHistory.getAll()).toHaveLength(1) // clip1 in history

      // Go back to clip1 (enter history navigation mode)
      await previousClip(state)
      expect(state.current).toEqual(clip1)
      expect(state.historyPosition).toBe(0) // Navigating history

      // Advance from end of history (clip1 is only history entry)
      // Since we're at the end of history, advancing pulls from queue
      await advanceQueue(state, mockDb, toClipUUID)
      expect(state.current).toEqual(clip3) // clip3 is next in queue (clip2 was lost)
      expect(state.historyPosition).toBe(-1) // Reached end of history, back to queue mode

      // Verify NO duplicate was created in history
      expect(state.playHistory.getAll()).toHaveLength(1)
      expect(state.playHistory.getAll()[0]!.clip).toEqual(clip1)
    })
  })

  describe('jumpToHistoryClip', () => {
    it('jumps from queue mode to history clip', async () => {
      const clip1 = createMockClip('clip1', 'History Clip 1')
      const clip2 = createMockClip('clip2', 'History Clip 2')
      const clip3 = createMockClip('clip3', 'Current Clip')

      // Set up history
      state.playHistory.add({ id: 1, clip: clip1, playedAt: new Date() })
      state.playHistory.add({ id: 2, clip: clip2, playedAt: new Date() })

      // Set current clip and queue mode
      state.current = clip3
      state.historyPosition = -1

      // Jump to clip1 in history
      await jumpToHistoryClip(state, clip1, toClipUUID)

      expect(state.current).toEqual(clip1)
      expect(state.historyPosition).toBe(0)

      // Current clip should be preserved in queue
      const queueClips = state.queue.toArray()
      expect(queueClips).toHaveLength(1)
      expect(queueClips[0]).toEqual(clip3)
    })

    it('jumps between history clips and preserves previous clip', async () => {
      const clip1 = createMockClip('clip1', 'History Clip 1')
      const clip2 = createMockClip('clip2', 'History Clip 2')
      const clip3 = createMockClip('clip3', 'History Clip 3')

      // Set up history
      state.playHistory.add({ id: 1, clip: clip1, playedAt: new Date() })
      state.playHistory.add({ id: 2, clip: clip2, playedAt: new Date() })
      state.playHistory.add({ id: 3, clip: clip3, playedAt: new Date() })

      // Start by viewing clip1 in history mode
      state.current = clip1
      state.historyPosition = 0

      // Jump to clip2 in history
      await jumpToHistoryClip(state, clip2, toClipUUID)

      expect(state.current).toEqual(clip2)
      expect(state.historyPosition).toBe(1)

      // clip1 should be preserved in queue
      let queueClips = state.queue.toArray()
      expect(queueClips).toHaveLength(1)
      expect(queueClips[0]).toEqual(clip1)

      // Jump to clip3 in history
      await jumpToHistoryClip(state, clip3, toClipUUID)

      expect(state.current).toEqual(clip3)
      expect(state.historyPosition).toBe(2)

      // clip2 should now be at front of queue, clip1 second
      queueClips = state.queue.toArray()
      expect(queueClips).toHaveLength(2)
      expect(queueClips[0]).toEqual(clip2)
      expect(queueClips[1]).toEqual(clip1)
    })

    it('does not add duplicate when jumping to same clip', async () => {
      const clip1 = createMockClip('clip1', 'History Clip')

      state.playHistory.add({ id: 1, clip: clip1, playedAt: new Date() })
      state.current = clip1
      state.historyPosition = 0

      // Jump to same clip (no-op)
      await jumpToHistoryClip(state, clip1, toClipUUID)

      expect(state.current).toEqual(clip1)
      expect(state.historyPosition).toBe(0)
      expect(state.queue.toArray()).toHaveLength(0) // No duplicate added
    })

    it('does not add duplicate when current clip already in queue', async () => {
      const clip1 = createMockClip('clip1', 'History Clip 1')
      const clip2 = createMockClip('clip2', 'Current Clip')

      state.playHistory.add({ id: 1, clip: clip1, playedAt: new Date() })
      state.current = clip2
      state.queue.add(clip2) // Already in queue
      state.historyPosition = -1

      await jumpToHistoryClip(state, clip1, toClipUUID)

      expect(state.current).toEqual(clip1)
      expect(state.historyPosition).toBe(0)

      // clip2 should only appear once in queue
      const queueClips = state.queue.toArray()
      expect(queueClips.filter((c) => c.id === clip2.id)).toHaveLength(1)
    })

    it('throws error when clip not in history', async () => {
      const clip1 = createMockClip('clip1', 'Not in History')

      await expect(jumpToHistoryClip(state, clip1, toClipUUID)).rejects.toThrow(
        'Clip not found in history'
      )
    })

    it('handles jumping from queue mode with no current clip', async () => {
      const clip1 = createMockClip('clip1', 'History Clip')

      state.playHistory.add({ id: 1, clip: clip1, playedAt: new Date() })
      state.current = null
      state.historyPosition = -1

      await jumpToHistoryClip(state, clip1, toClipUUID)

      expect(state.current).toEqual(clip1)
      expect(state.historyPosition).toBe(0)
      expect(state.queue.toArray()).toHaveLength(0) // Nothing to preserve
    })
  })
})
