import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Clip, PlayerFormat } from '@cq/platforms'

import { clipFromKick, clipFromTwitch } from '@/__tests__/mocks'
import { usePlatforms } from '../platforms'

/**
 * Platforms Store Tests
 *
 * Tests display metadata and player configuration for clip platforms.
 * Clip fetching is handled by the backend via EventSub.
 */
describe('platforms.ts', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it.each([
    [clipFromKick, 'video' as PlayerFormat],
    [clipFromTwitch, 'video' as PlayerFormat],
    [{} as Clip, undefined]
  ])(
    'returns the correct player format based on clip: (clip: %o) -> %s',
    async (input: Clip, expected: PlayerFormat | undefined) => {
      const platforms = usePlatforms()
      expect(await platforms.getPlayerFormat(input)).toEqual(expected)
    }
  )

  it.each([
    [clipFromKick, clipFromKick.embedUrl],
    [clipFromTwitch, undefined], // Twitch clips fetch videoUrl client-side
    [{} as Clip, undefined]
  ])(
    'returns the correct player source based on clip: (clip: %o) -> %s',
    async (input: Clip, expected: string | undefined) => {
      const platforms = usePlatforms()
      expect(await platforms.getPlayerSource(input)).toEqual(expected)
    }
  )
})
