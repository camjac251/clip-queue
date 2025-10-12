/**
 * Shared URL Utilities
 * Common patterns for URL parsing and validation
 */

/**
 * Safely parse a URL, returning null on failure
 */
export function safeParseURL(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

/**
 * Extract ID from URL pathname
 * Handles patterns like /path/to/ID or /path/to/ID?query
 */
export function extractIdFromPath(pathname: string): string | undefined {
  const idStart = pathname.lastIndexOf('/')
  return pathname.slice(idStart).split('?')[0]?.slice(1)
}

/**
 * Check if URL matches any of the given hostnames
 */
export function matchesHostname(url: string, hostnames: string[]): boolean {
  const parsed = safeParseURL(url)
  if (!parsed) {
    return false
  }
  return hostnames.includes(parsed.hostname)
}
