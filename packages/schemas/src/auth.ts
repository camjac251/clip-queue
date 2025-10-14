/**
 * Shared Auth Schemas
 * User role and authentication response schemas
 */
import { z } from 'zod'

/**
 * User Role Schema
 * Response from /api/auth/me endpoint
 */
export const UserRoleSchema = z.object({
  userId: z.string(),
  username: z.string(),
  displayName: z.string(),
  profileImageUrl: z.string(),
  isBroadcaster: z.boolean(),
  isModerator: z.boolean()
})

export type UserRole = z.infer<typeof UserRoleSchema>

/**
 * Authenticated User Type (same as UserRole)
 * For use in backend middleware
 */
export type AuthenticatedUser = UserRole
