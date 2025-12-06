import { describe, expect, it } from 'vitest'

import type { Clip } from '../types'
import { toClipUUID } from '../utils'
import { clipFromKick, clipFromTwitch } from './mocks'

describe('utils.ts', () => {
  it.each([
    [clipFromKick, 'kick:clip:testclipkick'],
    [clipFromTwitch, 'twitch:clip:testcliptwitch']
  ])('creates a uuid for a given clip: (clip: %o) -> %s', (clip: Clip, expected: string) => {
    expect(toClipUUID(clip)).toEqual(expected)
  })
})
