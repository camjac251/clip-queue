import type { MaybeRefOrGetter, RemovableRef } from '@vueuse/core'
import { useLocalStorage, useSessionStorage } from '@vueuse/core'

/**
 * Type-safe localStorage composable using VueUse
 *
 * Provides type-safe access to localStorage with automatic JSON serialization,
 * reactive updates, and SSR support
 *
 * @example
 * // Define your storage schema
 * interface AppCache {
 *   lastVisited: string
 *   viewMode: 'grid' | 'list'
 *   filters: string[]
 * }
 *
 * // Use with type safety
 * const lastVisited = useTypedLocalStorage<string>('lastVisited', '/queue')
 * const viewMode = useTypedLocalStorage<'grid' | 'list'>('viewMode', 'grid')
 * const filters = useTypedLocalStorage<string[]>('filters', [])
 *
 * // Values are reactive
 * viewMode.value = 'list' // automatically persists to localStorage
 *
 * @example
 * // Complex objects
 * interface UserPreferences {
 *   theme: 'light' | 'dark'
 *   notifications: boolean
 *   volume: number
 * }
 *
 * const prefs = useTypedLocalStorage<UserPreferences>('user-prefs', {
 *   theme: 'dark',
 *   notifications: true,
 *   volume: 0.8
 * })
 */
export function useTypedLocalStorage<T>(
  key: string,
  initialValue: MaybeRefOrGetter<T>,
  options?: {
    writeDefaults?: boolean
    mergeDefaults?: boolean
  }
): RemovableRef<T> {
  return useLocalStorage<T>(key, initialValue, {
    writeDefaults: options?.writeDefaults ?? true,
    mergeDefaults: options?.mergeDefaults ?? false,
    serializer: {
      read: (v: string) => (v ? JSON.parse(v) : null),
      write: (v: T) => JSON.stringify(v)
    }
  })
}

/**
 * Type-safe sessionStorage composable using VueUse
 *
 * Same as useTypedLocalStorage but uses sessionStorage (cleared on tab close)
 *
 * @example
 * // Temporary state that clears on tab close
 * const tempFilters = useTypedSessionStorage<string[]>('temp-filters', [])
 * const searchQuery = useTypedSessionStorage<string>('search', '')
 */
export function useTypedSessionStorage<T>(
  key: string,
  initialValue: MaybeRefOrGetter<T>,
  options?: {
    writeDefaults?: boolean
    mergeDefaults?: boolean
  }
): RemovableRef<T> {
  return useSessionStorage<T>(key, initialValue, {
    writeDefaults: options?.writeDefaults ?? true,
    mergeDefaults: options?.mergeDefaults ?? false,
    serializer: {
      read: (v: string) => (v ? JSON.parse(v) : null),
      write: (v: T) => JSON.stringify(v)
    }
  })
}
