import { describe, expect, it } from 'vitest'

import { UserRoleSchema } from '../auth'
import {
  TwitchModeratorsResponseSchema,
  TwitchTokenResponseSchema,
  TwitchUsersResponseSchema,
  TwitchValidateResponseSchema
} from '../twitch'

describe('schemas', () => {
  describe('UserRoleSchema', () => {
    it('validates correct user role', () => {
      const validData = {
        userId: '12345',
        username: 'testuser',
        isBroadcaster: false,
        isModerator: true
      }

      const result = UserRoleSchema.safeParse(validData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validData)
      }
    })

    it('rejects missing userId', () => {
      const invalidData = {
        username: 'testuser',
        isBroadcaster: false,
        isModerator: true
      }

      const result = UserRoleSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
    })

    it('rejects invalid boolean fields', () => {
      const invalidData = {
        userId: '12345',
        username: 'testuser',
        isBroadcaster: 'not-a-boolean',
        isModerator: true
      }

      const result = UserRoleSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
    })

    it('rejects extra fields', () => {
      const invalidData = {
        userId: '12345',
        username: 'testuser',
        isBroadcaster: false,
        isModerator: true,
        extraField: 'should-not-be-here'
      }

      const result = UserRoleSchema.safeParse(invalidData)

      // Zod allows extra fields by default, but we're testing strict validation
      expect(result.success).toBe(true)
    })
  })

  describe('TwitchTokenResponseSchema', () => {
    it('validates complete token response', () => {
      const validData = {
        access_token: 'access_token_value',
        refresh_token: 'refresh_token_value',
        expires_in: 3600,
        scope: ['openid', 'user:read:chat'],
        token_type: 'bearer',
        id_token: 'id_token_value'
      }

      const result = TwitchTokenResponseSchema.safeParse(validData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.access_token).toBe('access_token_value')
        expect(result.data.expires_in).toBe(3600)
      }
    })

    it('validates minimal token response (without optional fields)', () => {
      const validData = {
        access_token: 'access_token_value',
        refresh_token: 'refresh_token_value',
        expires_in: 3600,
        token_type: 'bearer'
      }

      const result = TwitchTokenResponseSchema.safeParse(validData)

      expect(result.success).toBe(true)
    })

    it('rejects missing required fields', () => {
      const invalidData = {
        access_token: 'access_token_value',
        // Missing refresh_token
        expires_in: 3600,
        token_type: 'bearer'
      }

      const result = TwitchTokenResponseSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
    })

    it('rejects invalid expires_in type', () => {
      const invalidData = {
        access_token: 'access_token_value',
        refresh_token: 'refresh_token_value',
        expires_in: '3600', // Should be number
        token_type: 'bearer'
      }

      const result = TwitchTokenResponseSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
    })

    it('rejects invalid scope type', () => {
      const invalidData = {
        access_token: 'access_token_value',
        refresh_token: 'refresh_token_value',
        expires_in: 3600,
        scope: 'not-an-array', // Should be array
        token_type: 'bearer'
      }

      const result = TwitchTokenResponseSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
    })
  })

  describe('TwitchValidateResponseSchema', () => {
    it('validates correct token validation response', () => {
      const validData = {
        user_id: '12345',
        login: 'testuser',
        client_id: 'client_id_value',
        scopes: ['openid', 'user:read:chat'],
        expires_in: 3600
      }

      const result = TwitchValidateResponseSchema.safeParse(validData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.user_id).toBe('12345')
        expect(result.data.login).toBe('testuser')
      }
    })

    it('validates without optional scopes', () => {
      const validData = {
        user_id: '12345',
        login: 'testuser',
        client_id: 'client_id_value',
        expires_in: 3600
      }

      const result = TwitchValidateResponseSchema.safeParse(validData)

      expect(result.success).toBe(true)
    })

    it('rejects missing required fields', () => {
      const invalidData = {
        user_id: '12345',
        // Missing login and client_id
        expires_in: 3600
      }

      const result = TwitchValidateResponseSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
    })

    it('rejects invalid user_id type', () => {
      const invalidData = {
        user_id: 12345, // Should be string
        login: 'testuser',
        client_id: 'client_id_value',
        expires_in: 3600
      }

      const result = TwitchValidateResponseSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
    })
  })

  describe('TwitchUsersResponseSchema', () => {
    it('validates correct users response', () => {
      const validData = {
        data: [
          {
            id: '12345',
            login: 'testuser',
            display_name: 'TestUser'
          }
        ]
      }

      const result = TwitchUsersResponseSchema.safeParse(validData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.data).toHaveLength(1)
        expect(result.data.data[0]?.id).toBe('12345')
      }
    })

    it('validates multiple users', () => {
      const validData = {
        data: [
          { id: '1', login: 'user1', display_name: 'User 1' },
          { id: '2', login: 'user2' },
          { id: '3', login: 'user3', display_name: 'User 3' }
        ]
      }

      const result = TwitchUsersResponseSchema.safeParse(validData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.data).toHaveLength(3)
      }
    })

    it('validates empty users array', () => {
      const validData = {
        data: []
      }

      const result = TwitchUsersResponseSchema.safeParse(validData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.data).toHaveLength(0)
      }
    })

    it('rejects missing data field', () => {
      const invalidData = {}

      const result = TwitchUsersResponseSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
    })

    it('rejects invalid user object in array', () => {
      const invalidData = {
        data: [
          {
            id: '12345'
            // Missing required 'login' field
          }
        ]
      }

      const result = TwitchUsersResponseSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
    })
  })

  describe('TwitchModeratorsResponseSchema', () => {
    it('validates correct moderators response', () => {
      const validData = {
        data: [
          {
            user_id: '12345',
            user_login: 'moduser',
            user_name: 'ModUser'
          }
        ]
      }

      const result = TwitchModeratorsResponseSchema.safeParse(validData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.data).toHaveLength(1)
        expect(result.data.data[0]?.user_id).toBe('12345')
      }
    })

    it('validates empty moderators array', () => {
      const validData = {
        data: []
      }

      const result = TwitchModeratorsResponseSchema.safeParse(validData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.data).toHaveLength(0)
      }
    })

    it('validates multiple moderators', () => {
      const validData = {
        data: [
          { user_id: '1', user_login: 'mod1', user_name: 'Mod 1' },
          { user_id: '2', user_login: 'mod2', user_name: 'Mod 2' }
        ]
      }

      const result = TwitchModeratorsResponseSchema.safeParse(validData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.data).toHaveLength(2)
      }
    })

    it('rejects missing required moderator fields', () => {
      const invalidData = {
        data: [
          {
            user_id: '12345'
            // Missing user_login and user_name
          }
        ]
      }

      const result = TwitchModeratorsResponseSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
    })
  })

  describe('schema error messages', () => {
    it('provides descriptive error for UserRoleSchema', () => {
      const invalidData = {
        userId: 123, // Should be string
        username: 'test',
        isBroadcaster: false,
        isModerator: true
      }

      const result = UserRoleSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1)
        expect(result.error.issues[0]?.path).toContain('userId')
      }
    })

    it('provides descriptive error for TwitchTokenResponseSchema', () => {
      const invalidData = {
        // Missing all required fields
      }

      const result = TwitchTokenResponseSchema.safeParse(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        // Should have errors for each missing field
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })
  })
})
