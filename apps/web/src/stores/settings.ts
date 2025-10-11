import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { Platform } from '@cq/platforms'

import type { LogLevel } from '@/stores/logger'
import { useLogger } from '@/stores/logger'
import type { WebSocketEventHandler } from './websocket'
import { useWebSocket } from './websocket'

/**
 * Enumeration of available chat commands.
 *
 * Commands are executed by the backend server. This enum is used in the frontend
 * settings UI to allow users to configure which commands are enabled.
 */
export enum Command {
  OPEN = 'open',
  CLOSE = 'close',
  CLEAR = 'clear',
  SET_LIMIT = 'setlimit',
  REMOVE_LIMIT = 'removelimit',
  PREV = 'prev',
  NEXT = 'next',
  REMOVE_BY_SUBMITTER = 'removebysubmitter',
  REMOVE_BY_PLATFORM = 'removebyplatform',
  ENABLE_PLATFORM = 'enableplatform',
  DISABLE_PLATFORM = 'disableplatform',
  ENABLE_AUTO_MODERATION = 'enableautomod',
  DISABLE_AUTO_MODERATION = 'disableautomod',
  PURGE_CACHE = 'purgecache',
  PURGE_HISTORY = 'purgehistory'
}

/**
 * Settings for commands.
 */
export interface CommandSettings {
  /**
   * The prefix for commands.
   *
   * @example !cq
   */
  prefix: string
  /**
   * The commands allowed to be used.
   */
  allowed: Command[]
}

/**
 * Settings for the queue.
 */
export interface QueueSettings {
  /**
   * Whether auto moderation is enabled.
   *
   * @note This will remove clips when the submitter has their message deleted, or is timed out / banned.
   */
  hasAutoModerationEnabled: boolean
  /**
   * The limit of clips in the queue.
   *
   * @example 10
   * @note null means no limit.
   */
  limit: number | null
  /**
   * The platforms allowed to be used for clips.
   */
  platforms: Platform[]
}

/**
 * Settings for the logger.
 */
export interface LoggerSettings {
  /**
   * The log level of the application.
   */
  level: LogLevel
  /**
   * The maximum number of logs to keep.
   */
  limit: number
}

export const DEFAULT_COMMAND_SETTINGS: CommandSettings = {
  prefix: '!cq',
  allowed: Object.values(Command)
}

export const DEFAULT_QUEUE_SETTINGS: QueueSettings = {
  hasAutoModerationEnabled: true,
  limit: null,
  platforms: Object.values(Platform)
}

export const DEFAULT_LOGGER_SETTINGS: LoggerSettings = {
  level: 'WARN',
  limit: 100
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const useSettings = defineStore('settings', () => {
  const commands = ref<CommandSettings>({ ...DEFAULT_COMMAND_SETTINGS })
  const queue = ref<QueueSettings>({ ...DEFAULT_QUEUE_SETTINGS })
  const logger = ref<LoggerSettings>({ ...DEFAULT_LOGGER_SETTINGS })
  const websocket = useWebSocket()
  const log = useLogger()
  const isInitialized = ref<boolean>(false)

  const isCommandsSettingsModified = computed(() => {
    return (c: CommandSettings) => {
      return (
        commands.value.prefix !== c.prefix ||
        Object.values(Command).some(
          (cmd) => commands.value.allowed.includes(cmd) !== c.allowed.includes(cmd)
        )
      )
    }
  })

  const isQueueSettingsModified = computed(() => {
    return (q: QueueSettings) => {
      return (
        queue.value.hasAutoModerationEnabled !== q.hasAutoModerationEnabled ||
        queue.value.limit !== q.limit ||
        Object.values(Platform).some(
          (p) => queue.value.platforms.includes(p) !== q.platforms.includes(p)
        )
      )
    }
  })

  const isLoggerSettingsModified = computed(() => {
    return (l: LoggerSettings) => {
      return logger.value.level !== l.level || logger.value.limit !== l.limit
    }
  })

  const isModified = computed(() => {
    return (
      isCommandsSettingsModified.value(DEFAULT_COMMAND_SETTINGS) ||
      isQueueSettingsModified.value(DEFAULT_QUEUE_SETTINGS) ||
      isLoggerSettingsModified.value(DEFAULT_LOGGER_SETTINGS)
    )
  })

  function $reset(): void {
    commands.value = DEFAULT_COMMAND_SETTINGS
    queue.value = DEFAULT_QUEUE_SETTINGS
    logger.value = DEFAULT_LOGGER_SETTINGS
  }

  /**
   * Load settings from backend
   */
  async function loadSettings(): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/api/settings`)
      if (!response.ok) {
        throw new Error(`Failed to load settings: ${response.statusText}`)
      }
      const data = await response.json()

      commands.value = data.commands
      queue.value = data.queue
      logger.value = data.logger
    } catch (error) {
      log.error(`[Settings] Failed to load from backend: ${error}`)
    }
  }

  /**
   * Save settings to backend
   */
  async function saveSettings(): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commands: commands.value,
          queue: queue.value,
          logger: logger.value
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to save settings: ${response.statusText}`)
      }

      log.info('[Settings] Saved to backend')
    } catch (error) {
      log.error(`[Settings] Failed to save to backend: ${error}`)
      throw error
    }
  }

  /**
   * WebSocket event handler for settings updates
   */
  const handleSettingsUpdated = ((data: {
    commands: CommandSettings
    queue: QueueSettings
    logger: LoggerSettings
  }) => {
    log.debug('[Settings] Received update from backend')
    commands.value = data.commands
    queue.value = data.queue
    logger.value = data.logger
  }) as WebSocketEventHandler

  /**
   * Initialize settings (load from backend and listen for updates)
   */
  function initialize(): void {
    // Prevent multiple initializations
    if (isInitialized.value) {
      log.debug('[Settings]: Already initialized, skipping')
      return
    }

    isInitialized.value = true

    // Listen for settings updates from backend
    websocket.on('settings:updated', handleSettingsUpdated)
  }

  /**
   * Cleanup WebSocket listeners
   */
  function cleanup(): void {
    if (!isInitialized.value) return

    websocket.off('settings:updated', handleSettingsUpdated)
    isInitialized.value = false
  }

  return {
    commands,
    queue,
    logger,
    isModified,
    isCommandsSettingsModified,
    isQueueSettingsModified,
    isLoggerSettingsModified,
    $reset,
    loadSettings,
    saveSettings,
    initialize,
    cleanup
  }
})
