/**
 * Sora API Types
 * Based on https://sora.chatgpt.com/backend/project_y API
 */

export interface SoraCameoProfile {
  username: string
  display_name?: string
  user_id: string
  verified?: boolean
}

export interface SoraAttachment {
  downloadable_url?: string
  encodings?: {
    thumbnail?: {
      path?: string
    }
  }
}

export interface SoraPost {
  id: string
  text: string
  preview_image_url?: string
  attachments?: SoraAttachment[]
  cameo_profiles?: SoraCameoProfile[] | null
}

export interface SoraProfile {
  username: string
  display_name?: string
  verified?: boolean
}

export interface SoraApiResponse {
  post: SoraPost
  profile?: SoraProfile
}
