import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAuthHeaders } from '@cq/utils'

import type { TwitchUserCtx } from '..'
import { mockTwitchClip, mockTwitchGame, mockTwitchUser } from '../../__tests__/mocks'
import TwitchAPI from '../api'

describe('twitch-api.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        json: () => {
          let data = {}
          if (url.includes('clips')) {
            data = [mockTwitchClip]
          } else if (url.includes('games')) {
            data = [mockTwitchGame]
          } else if (url.includes('users')) {
            data = [mockTwitchUser]
          }
          return Promise.resolve({ data })
        }
      })
    )
  })

  it('gets a twitch clips from twitch api', async () => {
    const clips = await TwitchAPI.getClips(
      { id: 'test', token: 'testToken', username: 'testuser' },
      ['testclip']
    )
    const clipInfo = clips[0]
    expect(clipInfo).toBeDefined()
    expect(clipInfo?.id).toEqual('testclip')
    expect(clipInfo?.title).toEqual('testtitle')
    expect(clipInfo?.broadcaster_name).toEqual('testbroadcaster')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('throws if no clip IDs are passed', async () => {
    await expect(
      TwitchAPI.getClips({ id: 'test', token: 'testToken', username: 'testuser' }, [])
    ).rejects.toThrowError()
  })

  it('gets a twitch games from twitch api', async () => {
    const games = await TwitchAPI.getGames(
      { id: 'test', token: 'testToken', username: 'testuser' },
      ['testgame']
    )
    const gameInfo = games[0]
    expect(gameInfo).toBeDefined()
    expect(gameInfo?.id).toEqual('testgame')
    expect(gameInfo?.name).toEqual('testgame')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('throws if no game IDs are passed', async () => {
    await expect(
      TwitchAPI.getGames({ id: 'test', token: 'testToken', username: 'testuser' }, [])
    ).rejects.toThrowError()
  })

  it('gets a twitch user from twitch api', async () => {
    const users = await TwitchAPI.getUsers(
      { id: 'test', token: 'testToken', username: 'testuser' },
      ['testuser']
    )
    const userInfo = users[0]
    expect(userInfo).toBeDefined()
    expect(userInfo?.id).toEqual('testuser')
    expect(userInfo?.login).toEqual('testuser')
    expect(userInfo?.display_name).toEqual('Test User')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('gets authorization headers based on a twitch users context', () => {
    const ctx: TwitchUserCtx = { id: 'test', token: 'testToken' }
    expect(createAuthHeaders(ctx.token ?? '', ctx.id)).toEqual({
      'Client-Id': 'test',
      Authorization: `Bearer testToken`
    })
  })
})
