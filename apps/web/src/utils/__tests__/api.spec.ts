import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchWithAuth } from '../api'
import * as eventsModule from '../events'

// Mock config
vi.mock('@/config', () => ({
  env: {
    API_URL: 'http://localhost:3000'
  }
}))

// Mock fetch globally
global.fetch = vi.fn()

describe('api utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.spyOn(eventsModule, 'emitAuthEvent')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('fetchWithAuth', () => {
    it('includes credentials in requests', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200
      } as Response)

      await fetchWithAuth('http://localhost:3000/api/test')

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/test',
        expect.objectContaining({
          credentials: 'include'
        })
      )
    })

    it('returns response on success', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      } as Response

      vi.mocked(fetch).mockResolvedValueOnce(mockResponse)

      const response = await fetchWithAuth('http://localhost:3000/api/test')

      expect(response.ok).toBe(true)
      expect(response.status).toBe(200)
    })

    it('includes custom headers', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200
      } as Response)

      await fetchWithAuth('http://localhost:3000/api/test', {
        headers: {
          'Content-Type': 'application/json'
        }
      })

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/test',
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json'
          }
        })
      )
    })

    it('supports POST requests with body', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200
      } as Response)

      const body = JSON.stringify({ data: 'test' })

      await fetchWithAuth('http://localhost:3000/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body
      })

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/submit',
        expect.objectContaining({
          method: 'POST',
          body
        })
      )
    })
  })

  describe('401 handling and token refresh', () => {
    it('attempts token refresh on 401', async () => {
      // First request returns 401
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401
      } as Response)

      // Refresh request succeeds
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200
      } as Response)

      // Retry request succeeds
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200
      } as Response)

      await fetchWithAuth('http://localhost:3000/api/protected')

      // Should have called fetch 3 times: original, refresh, retry
      expect(fetch).toHaveBeenCalledTimes(3)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/oauth/refresh',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include'
        })
      )
    })

    it('emits unauthorized event if refresh fails', async () => {
      // First request returns 401
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401
      } as Response)

      // Refresh request fails
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401
      } as Response)

      await fetchWithAuth('http://localhost:3000/api/protected')

      expect(eventsModule.emitAuthEvent).toHaveBeenCalledWith({
        type: 'unauthorized',
        message: 'Your session has expired. Please log in again.'
      })
    })

    it('emits unauthorized event if still 401 after refresh', async () => {
      // First request returns 401
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401
      } as Response)

      // Refresh succeeds
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200
      } as Response)

      // Retry still returns 401
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401
      } as Response)

      await fetchWithAuth('http://localhost:3000/api/protected')

      expect(eventsModule.emitAuthEvent).toHaveBeenCalledWith({
        type: 'unauthorized',
        message: 'Your session has expired. Please log in again.'
      })
    })

    it('prevents multiple simultaneous refresh attempts', async () => {
      // Two concurrent requests both get 401
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: false, status: 401 } as Response)
        .mockResolvedValueOnce({ ok: false, status: 401 } as Response)

      // Refresh succeeds
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, status: 200 } as Response)

      // Retries succeed
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
        .mockResolvedValueOnce({ ok: true, status: 200 } as Response)

      // Make two concurrent requests
      await Promise.all([
        fetchWithAuth('http://localhost:3000/api/test1'),
        fetchWithAuth('http://localhost:3000/api/test2')
      ])

      // Should have only called refresh once (shared promise)
      const refreshCalls = vi
        .mocked(fetch)
        .mock.calls.filter((call) => String(call[0]).includes('/oauth/refresh'))
      expect(refreshCalls).toHaveLength(1)
    })
  })

  describe('403 forbidden handling', () => {
    it('emits forbidden event on 403', async () => {
      const errorResponse = {
        ok: false,
        status: 403,
        clone: () => ({
          json: async () => ({ message: 'Insufficient permissions' })
        })
      } as Response

      vi.mocked(fetch).mockResolvedValueOnce(errorResponse)

      await fetchWithAuth('http://localhost:3000/api/admin')

      expect(eventsModule.emitAuthEvent).toHaveBeenCalledWith({
        type: 'forbidden',
        message: 'Insufficient permissions'
      })
    })

    it('uses default message if no error message provided', async () => {
      const errorResponse = {
        ok: false,
        status: 403,
        clone: () => ({
          json: async () => ({})
        })
      } as Response

      vi.mocked(fetch).mockResolvedValueOnce(errorResponse)

      await fetchWithAuth('http://localhost:3000/api/admin')

      expect(eventsModule.emitAuthEvent).toHaveBeenCalledWith({
        type: 'forbidden',
        message: 'You do not have permission to perform this action'
      })
    })
  })

  describe('429 rate limit handling', () => {
    it('emits rate limit event with reset time', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 300 // 5 minutes from now
      const errorResponse = {
        ok: false,
        status: 429,
        headers: {
          get: (header: string) => (header === 'RateLimit-Reset' ? resetTime.toString() : null)
        }
      } as Response

      vi.mocked(fetch).mockResolvedValueOnce(errorResponse)

      await fetchWithAuth('http://localhost:3000/api/test')

      expect(eventsModule.emitAuthEvent).toHaveBeenCalledWith({
        type: 'forbidden',
        message: expect.stringContaining('minute')
      })
    })

    it('emits rate limit event with retry-after', async () => {
      const errorResponse = {
        ok: false,
        status: 429,
        headers: {
          get: (header: string) => (header === 'Retry-After' ? '60' : null)
        }
      } as Response

      vi.mocked(fetch).mockResolvedValueOnce(errorResponse)

      await fetchWithAuth('http://localhost:3000/api/test')

      expect(eventsModule.emitAuthEvent).toHaveBeenCalledWith({
        type: 'forbidden',
        message: expect.stringContaining('60 seconds')
      })
    })

    it('emits generic message if no headers provided', async () => {
      const errorResponse = {
        ok: false,
        status: 429,
        headers: {
          get: () => null
        }
      } as unknown as Response

      vi.mocked(fetch).mockResolvedValueOnce(errorResponse)

      await fetchWithAuth('http://localhost:3000/api/test')

      expect(eventsModule.emitAuthEvent).toHaveBeenCalledWith({
        type: 'forbidden',
        message: 'Too many requests. Please try again later.'
      })
    })
  })

  describe('timeout handling', () => {
    it('includes abort signal in fetch request', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200
      } as Response)

      await fetchWithAuth('http://localhost:3000/api/test')

      // Verify that an abort signal was included in the request
      const fetchCall = vi.mocked(fetch).mock.calls[0]
      const options = fetchCall?.[1] as RequestInit
      expect(options.signal).toBeDefined()
      expect(options.signal).toBeInstanceOf(AbortSignal)
    })

    it('clears timeout on successful response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200
      } as Response)

      await fetchWithAuth('http://localhost:3000/api/fast')

      // If timeout wasn't cleared, advancing timers would cause issues
      await vi.advanceTimersByTimeAsync(31000)

      // Should complete successfully
      expect(fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('error handling', () => {
    it('propagates network errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      await expect(fetchWithAuth('http://localhost:3000/api/test')).rejects.toThrow('Network error')
    })

    it('handles CORS errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))

      await expect(fetchWithAuth('http://localhost:3000/api/test')).rejects.toThrow(
        'Failed to fetch'
      )
    })
  })
})
