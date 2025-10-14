import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAuthHeaders, fetchJSON, fetchJSONWithAuth } from '../http'

// Mock fetch globally
global.fetch = vi.fn()

describe('http utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createAuthHeaders', () => {
    it('creates Bearer token header', () => {
      const headers = createAuthHeaders('test_token')

      expect(headers).toEqual({
        Authorization: 'Bearer test_token'
      })
    })

    it('includes Client-Id when provided', () => {
      const headers = createAuthHeaders('test_token', 'test_client_id')

      expect(headers).toEqual({
        Authorization: 'Bearer test_token',
        'Client-Id': 'test_client_id'
      })
    })

    it('handles empty token', () => {
      const headers = createAuthHeaders('')

      expect(headers).toEqual({
        Authorization: 'Bearer '
      })
    })
  })

  describe('fetchJSON', () => {
    it('fetches and parses JSON successfully', async () => {
      const mockData = { id: 1, name: 'test' }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      } as Response)

      const result = await fetchJSON('https://api.example.com/data')

      expect(result).toEqual(mockData)
      expect(fetch).toHaveBeenCalledWith('https://api.example.com/data', undefined)
    })

    it('passes options to fetch', async () => {
      const mockData = { success: true }
      const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      } as Response)

      await fetchJSON('https://api.example.com/data', options)

      expect(fetch).toHaveBeenCalledWith('https://api.example.com/data', options)
    })

    it('throws error on non-OK response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      } as Response)

      await expect(fetchJSON('https://api.example.com/data')).rejects.toThrow(
        'Failed to fetch https://api.example.com/data: Not Found'
      )
    })

    it('uses custom error context', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized'
      } as Response)

      await expect(
        fetchJSON('https://api.example.com/data', undefined, 'user profile')
      ).rejects.toThrow('Failed to fetch user profile: Unauthorized')
    })

    it('handles 404 errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response)

      await expect(fetchJSON('https://api.example.com/missing')).rejects.toThrow()
    })

    it('handles 500 errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response)

      await expect(fetchJSON('https://api.example.com/error')).rejects.toThrow(
        'Internal Server Error'
      )
    })

    it('handles network errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      await expect(fetchJSON('https://api.example.com/data')).rejects.toThrow('Network error')
    })
  })

  describe('fetchJSONWithAuth', () => {
    it('fetches with Bearer token authentication', async () => {
      const mockData = { user: 'testuser' }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      } as Response)

      const result = await fetchJSONWithAuth('https://api.example.com/user', 'test_token')

      expect(result).toEqual(mockData)
      expect(fetch).toHaveBeenCalledWith('https://api.example.com/user', {
        headers: {
          Authorization: 'Bearer test_token'
        }
      })
    })

    it('includes Client-Id header when provided', async () => {
      const mockData = { success: true }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      } as Response)

      await fetchJSONWithAuth('https://api.example.com/data', 'test_token', 'test_client_id')

      expect(fetch).toHaveBeenCalledWith('https://api.example.com/data', {
        headers: {
          Authorization: 'Bearer test_token',
          'Client-Id': 'test_client_id'
        }
      })
    })

    it('merges custom headers with auth headers', async () => {
      const mockData = { success: true }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      } as Response)

      await fetchJSONWithAuth('https://api.example.com/data', 'test_token', undefined, {
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'value'
        }
      })

      expect(fetch).toHaveBeenCalledWith('https://api.example.com/data', {
        headers: {
          Authorization: 'Bearer test_token',
          'Content-Type': 'application/json',
          'X-Custom-Header': 'value'
        }
      })
    })

    it('passes method and body options', async () => {
      const mockData = { created: true }
      const requestBody = { name: 'test' }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      } as Response)

      await fetchJSONWithAuth('https://api.example.com/create', 'test_token', undefined, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      expect(fetch).toHaveBeenCalledWith('https://api.example.com/create', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          Authorization: 'Bearer test_token'
        }
      })
    })

    it('throws error on 401 Unauthorized', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      } as Response)

      await expect(
        fetchJSONWithAuth('https://api.example.com/protected', 'invalid_token')
      ).rejects.toThrow('Unauthorized')
    })

    it('throws error on 403 Forbidden', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      } as Response)

      await expect(
        fetchJSONWithAuth('https://api.example.com/admin', 'user_token')
      ).rejects.toThrow('Forbidden')
    })

    it('uses custom error context', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      } as Response)

      await expect(
        fetchJSONWithAuth(
          'https://api.example.com/user/123',
          'test_token',
          undefined,
          undefined,
          'user details'
        )
      ).rejects.toThrow('Failed to fetch user details: Not Found')
    })

    it('handles network errors with authentication', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Connection timeout'))

      await expect(fetchJSONWithAuth('https://api.example.com/data', 'test_token')).rejects.toThrow(
        'Connection timeout'
      )
    })
  })

  describe('type safety', () => {
    it('preserves type information for fetchJSON', async () => {
      interface User {
        id: number
        name: string
      }

      const mockUser: User = { id: 1, name: 'test' }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser
      } as Response)

      const user = await fetchJSON<User>('https://api.example.com/user')

      // TypeScript should infer correct type
      expect(user.id).toBe(1)
      expect(user.name).toBe('test')
    })

    it('preserves type information for fetchJSONWithAuth', async () => {
      interface ApiResponse {
        success: boolean
        data: string[]
      }

      const mockResponse: ApiResponse = {
        success: true,
        data: ['item1', 'item2']
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response)

      const response = await fetchJSONWithAuth<ApiResponse>(
        'https://api.example.com/items',
        'test_token'
      )

      expect(response.success).toBe(true)
      expect(response.data).toHaveLength(2)
    })
  })
})
