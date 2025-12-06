import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import type { Locale } from '@/paraglide/runtime'
import { baseLocale, isLocale, setLocale } from '@/paraglide/runtime'

/**
 * The theme of the application.
 */
export type Theme = 'dark' | 'light'

/**
 * The available themes.
 */
export const availableThemes: Theme[] = ['dark', 'light'] as const

/**
 * Gets the inferred default theme.
 * @param fallback - The fallback theme.
 * @returns The inferred default theme.
 */
export function getInferredDefaultTheme(fallback: Theme): Theme {
  if (!window.matchMedia) {
    return fallback
  }
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  } else {
    return 'light'
  }
}

/**
 * Gets the inferred default language.
 * @param fallback - The fallback language.
 * @returns The inferred default language.
 */
export function getInferredDefaultLanguage(fallback: Locale): Locale {
  if (!window.navigator?.language) {
    return fallback
  }
  const language = window.navigator.language
  if (isLocale(language)) {
    return language
  }
  const genericLanguage = language.split('-')[0]
  if (isLocale(genericLanguage)) {
    return genericLanguage
  }
  return fallback
}

/**
 * The user preferences.
 */
export interface UserPreferences {
  /**
   * The language.
   */
  language: Locale
  /**
   * The theme.
   */
  theme: Theme
  /**
   * Whether to automatically advance to the next clip when the current one ends.
   */
  autoplay: boolean
}

export const DEFAULTS: UserPreferences = {
  language: getInferredDefaultLanguage(baseLocale),
  theme: getInferredDefaultTheme('light'),
  autoplay: false
}

export const usePreferences = defineStore(
  'preferences',
  () => {
    const preferences = ref<UserPreferences>(structuredClone(DEFAULTS))

    watch(preferences, updatePreferences, { deep: true })

    const isDark = computed(() => preferences.value.theme === 'dark')

    const isModifiedFrom = computed(() => {
      return (p: UserPreferences) => {
        return (
          preferences.value.language !== p.language ||
          preferences.value.theme !== p.theme ||
          preferences.value.autoplay !== p.autoplay
        )
      }
    })

    const isModified = computed(() => {
      return isModifiedFrom.value({ ...DEFAULTS })
    })

    function updatePreferences(value: UserPreferences, old?: UserPreferences) {
      if (value.language !== old?.language) {
        if (isLocale(value.language)) {
          document.documentElement.lang = value.language
          preferences.value.language = value.language
          setLocale(value.language, { reload: false })
        } else {
          document.documentElement.lang = value.language
          preferences.value.language = value.language
          setLocale(DEFAULTS.language, { reload: false })
        }
      }
      if (value.theme !== old?.theme) {
        if (value.theme === 'dark') {
          document?.querySelector('html')?.classList.add('dark')
        } else {
          document.querySelector('html')?.classList.remove('dark')
        }
      }
    }

    function toggleTheme() {
      preferences.value.theme = preferences.value.theme === 'dark' ? 'light' : 'dark'
    }

    function $reset() {
      preferences.value = structuredClone(DEFAULTS)
    }

    return {
      preferences,
      isDark,
      isModified,
      isModifiedFrom,
      updatePreferences,
      toggleTheme,
      $reset
    }
  },
  {
    persist: {
      key: 'cq-preferences',
      afterHydrate: (ctx) => {
        ctx.store.updatePreferences(ctx.store.preferences)
      }
    }
  }
)
