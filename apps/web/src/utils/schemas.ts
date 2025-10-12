import { z } from 'zod'

/**
 * Re-export shared schemas from packages
 */
export { UserRoleSchema, type UserRole } from '@cq/schemas/auth'

export {
  CommandSettingsSchema,
  QueueSettingsSchema,
  LoggerSettingsSchema,
  AppSettingsSchema as SettingsSchema,
  type AppSettings as Settings
} from '@cq/schemas/settings'

/**
 * Schema for API error responses
 */
export const ApiErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional()
})

export type ApiError = z.infer<typeof ApiErrorSchema>
