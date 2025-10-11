import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Clip, PlayerFormat } from '@cq/providers'

import { clipFromKick, clipFromTwitch } from '@/__tests__/mocks'
import { useProviders } from '../providers'

/**
 * Providers Store Tests
 *
 * Tests display metadata and player configuration for clip providers.
 * Clip fetching is handled by the backend via EventSub.
 */
describe('providers.ts', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it.each([
    [clipFromKick, 'video' as PlayerFormat],
    [clipFromTwitch, 'iframe' as PlayerFormat],
    [{} as Clip, undefined]
  ])(
    'returns the correct player format based on clip: (clip: %o) -> %s',
    async (input: Clip, expected: PlayerFormat | undefined) => {
      const providers = useProviders()
      expect(await providers.getPlayerFormat(input)).toEqual(expected)
    }
  )

  it.each([
    [clipFromKick, clipFromKick.embedUrl],
    [clipFromTwitch, `${clipFromTwitch.embedUrl}&autoplay=true&parent=${window.location.hostname}`],
    [{} as Clip, undefined]
  ])(
    'returns the correct player source based on clip: (clip: %o) -> %s',
    async (input: Clip, expected: string | undefined) => {
      const providers = useProviders()
      expect(await providers.getPlayerSource(input)).toEqual(expected)
    }
  )
})
