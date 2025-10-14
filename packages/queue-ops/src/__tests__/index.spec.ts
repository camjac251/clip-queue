import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Clip } from '@cq/platforms'
import { Platform } from '@cq/constants'
import { ClipList } from '@cq/platforms'

import type { DatabaseOperations, QueueState } from '../index'
import { advanceQueue, clearHistory, clearQueue, playClip, previousClip } from '../index'

// Helper to create mock clip
function createMockClip(id: string, title: string): Clip {
  return {
    id,
    platform: Platform.TWITCH,
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

// Mock UUID generator
function toClipUUID(clip: Clip): string {
  return `${clip.platform}:${clip.id}`
}

describe('queue-ops', () => {
  let state: QueueState
  let mockDb: DatabaseOperations

  beforeEach(() => {
    state = {
      current: null,
      queue: new ClipList(),
      history: new ClipList()
    }

    mockDb = {
      updateClipStatus: vi.fn(),
      deleteClipsByStatus: vi.fn()
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
      expect(state.history.toArray()).toContainEqual(clip1)
      expect(state.queue.toArray()).toHaveLength(0)

      expect(mockDb.updateClipStatus).toHaveBeenCalledWith('twitch:clip1', 'played')
    })

    it('handles empty queue', async () => {
      const clip1 = createMockClip('clip1', 'First Clip')
      state.current = clip1

      await advanceQueue(state, mockDb, toClipUUID)

      expect(state.current).toBeNull()
      expect(state.history.toArray()).toContainEqual(clip1)
    })

    it('handles no current clip', async () => {
      const clip1 = createMockClip('clip1', 'First Clip')
      state.queue.add(clip1)

      await advanceQueue(state, mockDb, toClipUUID)

      expect(state.current).toEqual(clip1)
      expect(state.history.toArray()).toHaveLength(0)
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
      expect(state.history.toArray()).toHaveLength(0)
      expect(state.queue.toArray()).toContainEqual(clip2)
    })
  })

  describe('previousClip', () => {
    it('moves to previous clip from history', async () => {
      const clip1 = createMockClip('clip1', 'First Clip')
      const clip2 = createMockClip('clip2', 'Second Clip')

      state.current = clip2
      state.history.add(clip1)

      await previousClip(state)

      expect(state.current).toEqual(clip1)
      expect(state.queue.toArray()).toContainEqual(clip2)
      expect(state.history.toArray()).toHaveLength(0)
    })

    it('handles empty history', async () => {
      const clip1 = createMockClip('clip1', 'First Clip')
      state.current = clip1

      await previousClip(state)

      expect(state.current).toBeNull()
      expect(state.queue.toArray()).toContainEqual(clip1)
    })

    it('handles no current clip', async () => {
      const clip1 = createMockClip('clip1', 'First Clip')
      state.history.add(clip1)

      await previousClip(state)

      expect(state.current).toEqual(clip1)
      expect(state.history.toArray()).toHaveLength(0)
    })

    it('maintains multiple history entries', async () => {
      const clip1 = createMockClip('clip1', 'First')
      const clip2 = createMockClip('clip2', 'Second')
      const clip3 = createMockClip('clip3', 'Third')

      state.current = clip3
      state.history.add(clip1)
      state.history.add(clip2)

      await previousClip(state)

      // Should pop last item from history
      expect(state.current).toEqual(clip2)
      expect(state.history.toArray()).toContainEqual(clip1)
      expect(state.queue.toArray()).toContainEqual(clip3)
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

      state.history.add(clip1)
      state.history.add(clip2)

      await clearHistory(state)

      expect(state.history.toArray()).toHaveLength(0)
    })

    it('handles empty history', async () => {
      await clearHistory(state)

      expect(state.history.toArray()).toHaveLength(0)
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
      expect(state.history.toArray()).toContainEqual(clip1)
      expect(state.queue.toArray()).not.toContainEqual(clip3)
      expect(state.queue.toArray()).toContainEqual(clip2)

      expect(mockDb.updateClipStatus).toHaveBeenCalledWith('twitch:clip1', 'played')
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
      expect(state.history.toArray()).toHaveLength(0)
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
      expect(state.history.toArray()).toHaveLength(2)
      // Should have clip3 and clip4 remaining in queue
      expect(state.queue.toArray()).toHaveLength(2)
      // Current should be clip2
      expect(state.current?.id).toBe('clip2')
    })

    it('handles interleaved operations', async () => {
      const clip1 = createMockClip('clip1', 'Clip 1')
      const clip2 = createMockClip('clip2', 'Clip 2')
      const clip3 = createMockClip('clip3', 'Clip 3')

      state.queue.add(clip1)
      state.queue.add(clip2)
      state.queue.add(clip3)

      // Advance, then go back, then advance again
      await advanceQueue(state, mockDb, toClipUUID)
      expect(state.current).toEqual(clip1)

      await advanceQueue(state, mockDb, toClipUUID)
      expect(state.current).toEqual(clip2)

      await previousClip(state)
      expect(state.current).toEqual(clip1)

      await advanceQueue(state, mockDb, toClipUUID)
      expect(state.current).toEqual(clip2)
    })
  })
})
