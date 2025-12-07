import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type {
  Provider,
  CommandSettings as SharedCommandSettings,
  LoggerSettings as SharedLoggerSettings,
  QueueSettings as SharedQueueSettings,
  SoraSettings
} from '@cq/schemas/settings'
import { PROVIDERS } from '@cq/schemas/settings'

import type { LogLevel } from '@/stores/logger'
import { env } from '@/config'
import { useLogger } from '@/stores/logger'
import { Command } from '@/types/commands'
import { fetchWithAuth } from '@/utils/api'
import { SettingsSchema } from '@/utils/schemas'

/**
 * Settings for commands.
 */
export interface CommandSettings extends Omit<SharedCommandSettings, 'allowed'> {
  allowed: Command[]
}

/**
 * Settings for the queue.
 */
export interface QueueSettings extends Omit<SharedQueueSettings, 'providers' | 'sora'> {
  providers: Provider[]
  sora: SoraSettings
}

/**
 * Settings for the logger.
 */
export interface LoggerSettings extends Omit<SharedLoggerSettings, 'level'> {
  level: LogLevel
}

export const DEFAULT_COMMAND_SETTINGS: CommandSettings = {
  prefix: '!cq',
  allowed: Object.values(Command)
}

export const DEFAULT_QUEUE_SETTINGS: QueueSettings = {
  hasAutoModerationEnabled: true,
  limit: null,
  providers: [...PROVIDERS],
  sora: {
    allowedCameos: []
  }
}

export const DEFAULT_LOGGER_SETTINGS: LoggerSettings = {
  level: 'WARN',
  limit: 100
}

const { API_URL } = env

export const useSettings = defineStore('settings', () => {
  const commands = ref<CommandSettings>({
    ...DEFAULT_COMMAND_SETTINGS,
    allowed: [...DEFAULT_COMMAND_SETTINGS.allowed]
  })
  const queue = ref<QueueSettings>({
    ...DEFAULT_QUEUE_SETTINGS,
    providers: [...DEFAULT_QUEUE_SETTINGS.providers]
  })
  const logger = ref<LoggerSettings>({ ...DEFAULT_LOGGER_SETTINGS })
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
      // Check basic settings
      if (
        queue.value.hasAutoModerationEnabled !== q.hasAutoModerationEnabled ||
        queue.value.limit !== q.limit
      ) {
        return true
      }

      // Check providers
      if (PROVIDERS.some((p) => queue.value.providers.includes(p) !== q.providers.includes(p))) {
        return true
      }

      // Check sora settings
      const currentCameos = queue.value.sora.allowedCameos.join(',')
      const newCameos = q.sora.allowedCameos.join(',')
      if (currentCameos !== newCameos) {
        return true
      }

      return false
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
    commands.value = {
      ...DEFAULT_COMMAND_SETTINGS,
      allowed: [...DEFAULT_COMMAND_SETTINGS.allowed]
    }
    queue.value = {
      ...DEFAULT_QUEUE_SETTINGS,
      providers: [...DEFAULT_QUEUE_SETTINGS.providers],
      sora: {
        allowedCameos: [...DEFAULT_QUEUE_SETTINGS.sora.allowedCameos]
      }
    }
    logger.value = { ...DEFAULT_LOGGER_SETTINGS }
  }

  /**
   * Load settings from backend
   * Note: Requires broadcaster authentication
   */
  async function loadSettings(): Promise<void> {
    try {
      const response = await fetchWithAuth(`${API_URL}/api/settings`)
      if (!response.ok) {
        throw new Error(`Failed to load settings: ${response.statusText}`)
      }
      const rawData = await response.json()
      const parseResult = SettingsSchema.safeParse(rawData)

      if (!parseResult.success) {
        log.error(
          `[Settings] Invalid settings data from server: ${JSON.stringify(parseResult.error.issues)}`
        )
        return
      }

      const data = parseResult.data
      commands.value = data.commands as CommandSettings
      queue.value = data.queue as QueueSettings
      logger.value = data.logger as LoggerSettings
      log.info(
        `[Settings] Loaded from backend: commands=${commands.value.allowed.length} allowed, queue.providers=${queue.value.providers.length}, logger.level=${logger.value.level}`
      )
    } catch (error: unknown) {
      log.error(`[Settings] Failed to load from backend: ${error}`)
    }
  }

  /**
   * Save settings to backend
   */
  async function saveSettings(): Promise<void> {
    try {
      const response = await fetchWithAuth(`${API_URL}/api/settings`, {
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

      // Reload settings to get server-validated values
      await loadSettings()
    } catch (error: unknown) {
      log.error(`[Settings] Failed to save to backend: ${error}`)
      throw error
    }
  }

  /**
   * Initialize settings (load from backend)
   */
  function initialize(): void {
    // Prevent multiple initializations
    if (isInitialized.value) {
      log.debug('[Settings]: Already initialized, skipping')
      return
    }

    isInitialized.value = true
    log.info('[Settings]: Initialized (will load on demand)')
  }

  /**
   * Cleanup
   */
  function cleanup(): void {
    if (!isInitialized.value) return
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
