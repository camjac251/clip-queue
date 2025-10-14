/**
 * Settings Search Index
 * Builds a comprehensive searchable index of all settings including pages and individual fields
 */
import { computed } from 'vue'

import type { CommandSettings, QueueSettings } from '@cq/schemas'

import type { LogLevel } from '@/stores/logger'
import * as m from '@/paraglide/messages'
import { allowedRoutes, RouteNameConstants, routeTranslations } from '@/router'
import { logLevelTranslations } from '@/stores/logger'
import { usePreferences } from '@/stores/preferences'
import { useSettings } from '@/stores/settings'
import { Command } from '@/types/commands'

export type SearchResultType = 'page' | 'setting'
export type SettingType = 'toggle' | 'text' | 'number' | 'select' | 'multiselect' | 'checkboxlist'

export interface SearchResult {
  id: string
  type: SearchResultType
  title: string
  description?: string
  category?: string
  route: RouteNameConstants
  icon?: string
  value?: string | number | boolean | string[]
  settingType?: SettingType
  keywords?: string[]
}

/**
 * Build search index for settings pages
 */
function buildPageResults(): SearchResult[] {
  const settingsRoutes =
    allowedRoutes.value.find((r) => r.name === RouteNameConstants.SETTINGS)?.children ?? []

  return settingsRoutes.map((route) => ({
    id: `page-${String(route.name)}`,
    type: 'page' as const,
    title: routeTranslations[route.name as RouteNameConstants](),
    route: route.name as RouteNameConstants,
    icon: route.meta?.icon as string | undefined
  }))
}

/**
 * Build search index for chat command settings
 */
function buildChatSettings(commands: CommandSettings): SearchResult[] {
  const commandHelp: Record<Command, { description: string; args?: string[] }> = {
    [Command.OPEN]: { description: m.command_open() },
    [Command.CLOSE]: { description: m.command_close() },
    [Command.CLEAR]: { description: m.command_clear() },
    [Command.SET_LIMIT]: {
      args: [m.number().toLocaleLowerCase()],
      description: m.command_set_limit()
    },
    [Command.REMOVE_LIMIT]: { description: m.command_remove_limit() },
    [Command.PREV]: { description: m.command_previous() },
    [Command.NEXT]: { description: m.command_next() },
    [Command.REMOVE_BY_SUBMITTER]: {
      args: [m.submitter().toLocaleLowerCase()],
      description: m.command_remove_by_submitter()
    },
    [Command.REMOVE_BY_PLATFORM]: {
      args: [m.platform().toLocaleLowerCase()],
      description: m.command_remove_by_platform()
    },
    [Command.ENABLE_PLATFORM]: {
      args: [m.platform().toLocaleLowerCase()],
      description: m.command_enable_platform()
    },
    [Command.DISABLE_PLATFORM]: {
      args: [m.platform().toLocaleLowerCase()],
      description: m.command_disable_platform()
    },
    [Command.ENABLE_AUTOMOD]: { description: m.command_enable_auto_mod() },
    [Command.DISABLE_AUTOMOD]: { description: m.command_disable_auto_mod() },
    [Command.PURGE_CACHE]: { description: m.command_purge_cache() },
    [Command.PURGE_HISTORY]: { description: m.command_purge_history() }
  }

  const results: SearchResult[] = [
    {
      id: 'setting-command-prefix',
      type: 'setting',
      title: m.command_prefix(),
      description: m.command_prefix_description(),
      category: m.settings_chat(),
      route: RouteNameConstants.SETTINGS_CHAT,
      value: commands.prefix,
      settingType: 'text',
      keywords: ['chat', 'command', 'prefix', commands.prefix]
    }
  ]

  // Add individual command toggles
  Object.values(Command).forEach((cmd) => {
    const isEnabled = commands.allowed.includes(cmd)
    const help = commandHelp[cmd]
    const commandString = `${commands.prefix}${cmd}`

    results.push({
      id: `setting-command-${cmd}`,
      type: 'setting',
      title: commandString,
      description: help.description,
      category: m.allowed_commands(),
      route: RouteNameConstants.SETTINGS_CHAT,
      value: isEnabled,
      settingType: 'toggle',
      keywords: ['chat', 'command', cmd, commandString, help.description]
    })
  })

  return results
}

/**
 * Build search index for queue settings
 */
function buildQueueSettings(queue: QueueSettings): SearchResult[] {
  return [
    {
      id: 'setting-queue-automod',
      type: 'setting',
      title: m.auto_mod(),
      description: m.auto_mod_description(),
      category: m.settings_queue(),
      route: RouteNameConstants.SETTINGS_QUEUE,
      value: queue.hasAutoModerationEnabled,
      settingType: 'toggle',
      keywords: ['queue', 'moderation', 'auto', 'approval', 'manual']
    },
    {
      id: 'setting-queue-limit',
      type: 'setting',
      title: m.size_limit(),
      description: m.size_limit_description(),
      category: m.settings_queue(),
      route: RouteNameConstants.SETTINGS_QUEUE,
      value: queue.limit ?? m.none(),
      settingType: 'number',
      keywords: ['queue', 'limit', 'size', 'maximum', 'clips']
    },
    {
      id: 'setting-queue-platforms',
      type: 'setting',
      title: m.allowed_platforms(),
      description: m.allowed_platforms_description(),
      category: m.settings_queue(),
      route: RouteNameConstants.SETTINGS_QUEUE,
      value: queue.platforms,
      settingType: 'multiselect',
      keywords: ['queue', 'platforms', 'twitch', 'kick', ...queue.platforms]
    }
  ]
}

/**
 * Build search index for preference settings
 */
function buildPreferenceSettings(): SearchResult[] {
  const preferences = usePreferences()

  const languageLabels: Record<string, string> = {
    ar: 'عربي (Arabic)',
    de: 'Deutsch (German)',
    en: 'English',
    es: 'Español (Spanish)',
    fr: 'Français (French)',
    hi: 'हिंदी (Hindi)',
    it: 'Italiano (Italian)',
    ja: '日本語 (Japanese)',
    ko: '한국인 (Korean)',
    pt: 'Português (Portuguese)',
    ru: 'русский (Russian)',
    tr: 'Türkçe (Turkish)',
    zh: '中文 (Chinese)'
  }

  return [
    {
      id: 'setting-preference-language',
      type: 'setting',
      title: m.language(),
      description: m.language_description(),
      category: m.settings_preferences(),
      route: RouteNameConstants.SETTINGS_PREFERENCES,
      value: languageLabels[preferences.preferences.language] || preferences.preferences.language,
      settingType: 'select',
      keywords: [
        'language',
        'locale',
        'translation',
        preferences.preferences.language,
        ...Object.keys(languageLabels)
      ]
    },
    {
      id: 'setting-preference-theme',
      type: 'setting',
      title: m.theme(),
      description: m.theme_description(),
      category: m.settings_preferences(),
      route: RouteNameConstants.SETTINGS_PREFERENCES,
      value: preferences.preferences.theme,
      settingType: 'select',
      keywords: ['theme', 'dark', 'light', 'appearance', preferences.preferences.theme]
    },
    {
      id: 'setting-preference-autoplay',
      type: 'setting',
      title: m.autoplay(),
      description: m.autoplay_description(),
      category: m.settings_preferences(),
      route: RouteNameConstants.SETTINGS_PREFERENCES,
      value: preferences.preferences.autoplay,
      settingType: 'toggle',
      keywords: ['autoplay', 'video', 'player', 'automatic']
    }
  ]
}

/**
 * Build search index for logger settings
 */
function buildLoggerSettings(logger: { level: string; limit: number }): SearchResult[] {
  return [
    {
      id: 'setting-logger-level',
      type: 'setting',
      title: m.level_colon(),
      description: m.logger_level_description(),
      category: m.logs(),
      route: RouteNameConstants.SETTINGS_LOGS,
      value: logLevelTranslations[logger.level as LogLevel](),
      settingType: 'select',
      keywords: [
        'logger',
        'log',
        'level',
        'debug',
        'info',
        'warn',
        'error',
        logger.level.toLowerCase()
      ]
    },
    {
      id: 'setting-logger-limit',
      type: 'setting',
      title: m.size_limit(),
      description: m.logger_size_limit_description(),
      category: m.logs(),
      route: RouteNameConstants.SETTINGS_LOGS,
      value: logger.limit,
      settingType: 'number',
      keywords: ['logger', 'log', 'limit', 'size', 'storage', 'messages']
    }
  ]
}

/**
 * Get all searchable settings and pages
 */
export function useSettingsSearchIndex() {
  const settings = useSettings()

  const searchIndex = computed<SearchResult[]>(() => {
    const pages = buildPageResults()
    const chatSettings = buildChatSettings(settings.commands)
    const queueSettings = buildQueueSettings(settings.queue)
    const preferenceSettings = buildPreferenceSettings()
    const loggerSettings = buildLoggerSettings(settings.logger)

    return [...pages, ...chatSettings, ...queueSettings, ...preferenceSettings, ...loggerSettings]
  })

  /**
   * Filter search results by query
   */
  function filterResults(query: string): SearchResult[] {
    if (!query.trim()) return searchIndex.value

    const lowerQuery = query.toLowerCase().trim()

    return searchIndex.value.filter((result) => {
      // Search in title
      if (result.title.toLowerCase().includes(lowerQuery)) return true

      // Search in description
      if (result.description?.toLowerCase().includes(lowerQuery)) return true

      // Search in category
      if (result.category?.toLowerCase().includes(lowerQuery)) return true

      // Search in value (convert to string)
      const valueStr = Array.isArray(result.value)
        ? result.value.join(' ')
        : String(result.value ?? '')
      if (valueStr.toLowerCase().includes(lowerQuery)) return true

      // Search in keywords
      if (result.keywords?.some((kw) => kw.toLowerCase().includes(lowerQuery))) return true

      return false
    })
  }

  /**
   * Group results by category for display
   */
  function groupResults(results: SearchResult[]): Record<string, SearchResult[]> {
    const pages = results.filter((r) => r.type === 'page')
    const settings = results.filter((r) => r.type === 'setting')

    const grouped: Record<string, SearchResult[]> = {}

    if (pages.length > 0) {
      grouped[m.pages()] = pages
    }

    // Group settings by category
    settings.forEach((setting) => {
      const category = setting.category || m.settings_other()
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category]!.push(setting)
    })

    return grouped
  }

  return {
    searchIndex,
    filterResults,
    groupResults
  }
}
