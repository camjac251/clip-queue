import type { SoraApiResponse } from './types'

export * from './types'

/**
 * Sora logo SVG as a string.
 */
export const logo = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <title>Sora</title>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
  </svg>
`

const ALLOWED_SORA_HOSTS = ['sora.chatgpt.com', 'www.sora.chatgpt.com']

/**
 * Get a Sora post by ID.
 * @param id - The Sora post ID.
 * @returns The Sora API response.
 * @throws Will throw an error if no post ID is provided or the fetch fails.
 */
export async function getPost(id: string): Promise<SoraApiResponse> {
  if (id.length <= 0) {
    throw new Error('Post ID was not provided.')
  }

  const apiUrl = `https://sora.chatgpt.com/backend/project_y/post/${id}/tree?limit=1&max_depth=0`

  const response = await fetch(apiUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch Sora post with ID ${id}: ${response.statusText}.`)
  }

  const data: SoraApiResponse = await response.json()
  return data
}

/**
 * Get the direct video URL for a Sora post.
 * @param id - The Sora post ID.
 * @returns The direct video URL or undefined if not available.
 */
export async function getVideoUrl(id: string): Promise<string | undefined> {
  const response = await getPost(id)
  if (!response.post || !response.post.attachments || response.post.attachments.length === 0) {
    return undefined
  }
  return response.post.attachments[0]?.downloadable_url
}

/**
 * Get a post ID from a Sora URL.
 * @param url - The Sora post URL.
 * @returns The post ID or undefined if the URL is invalid.
 */
export function getPostIdFromUrl(url: string): string | undefined {
  try {
    const uri = new URL(url)
    if (ALLOWED_SORA_HOSTS.includes(uri.hostname) && uri.pathname.startsWith('/p/')) {
      const idStart = uri.pathname.lastIndexOf('/') + 1
      const id = uri.pathname.slice(idStart).split('?')[0]

      if (id && id.startsWith('s_')) {
        return id
      }
    }
    return undefined
  } catch {
    return undefined
  }
}

export default {
  logo,
  getPost,
  getVideoUrl,
  getPostIdFromUrl
}
