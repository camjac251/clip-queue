<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <div class="bg-brand/10 flex h-10 w-10 items-center justify-center rounded-lg">
        <NavBookOpen class="text-brand h-5 w-5" />
      </div>
      <div>
        <h2 class="text-foreground text-lg font-semibold">{{ m.logs() }}</h2>
        <p class="text-muted-foreground text-sm">Configure logging and view application logs</p>
      </div>
    </div>

    <!-- Logger Configuration Card -->
    <div class="border-border/50 bg-card/80 rounded-lg border backdrop-blur-sm">
      <div class="border-border/30 flex items-center gap-2 border-b px-4 py-2.5">
        <NavSettings class="text-muted-foreground h-4 w-4" />
        <span class="text-foreground text-sm font-medium">Configuration</span>
      </div>
      <form :key="formKey" @submit.prevent="onSubmit" @reset="onReset">
        <div class="divide-border/30 divide-y">
          <!-- Log Level -->
          <div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0 flex-1">
              <label for="loggerLevel" class="text-foreground block text-sm font-medium">
                {{ m.level_colon() }}
              </label>
              <p class="text-muted-foreground mt-0.5 text-xs">
                {{ m.logger_level_description() }}
              </p>
            </div>
            <div class="sm:w-36">
              <Select v-model="formSettings.level">
                <SelectTrigger id="loggerLevel" class="h-9 text-sm">
                  <SelectValue :placeholder="logLevelTranslations[formSettings.level]()" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="level in availableLogLevels" :key="level" :value="level">
                    {{ logLevelTranslations[level]() }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <!-- Log Limit -->
          <div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0 flex-1">
              <label for="loggerLimit" class="text-foreground block text-sm font-medium">
                {{ m.size_limit() }}
              </label>
              <p class="text-muted-foreground mt-0.5 text-xs">
                {{ m.logger_size_limit_description() }}
              </p>
            </div>
            <div class="sm:w-36">
              <InputNumber
                v-model="formSettings.limit"
                input-id="loggerLimit"
                :allow-empty="false"
                :locale="preferences.preferences.language"
                :min="1"
                :max="100000"
                :step="1"
                show-buttons
                class="w-full"
              />
            </div>
          </div>
        </div>

        <!-- Config Actions -->
        <div class="border-border/30 flex gap-2 border-t p-4">
          <Button
            variant="brand"
            class="flex-1"
            type="submit"
            size="sm"
            :disabled="!settings.isLoggerSettingsModified(formSettings)"
          >
            {{ m.save() }}
          </Button>
          <Button
            variant="outline"
            class="flex-1"
            type="reset"
            size="sm"
            :disabled="!settings.isLoggerSettingsModified(formSettings)"
          >
            {{ m.cancel() }}
          </Button>
        </div>
      </form>
    </div>

    <!-- Logs View Card -->
    <div class="border-border/50 bg-card/80 rounded-lg border backdrop-blur-sm">
      <div class="border-border/30 flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <div class="flex items-center gap-2">
          <NavBookOpen class="text-muted-foreground h-4 w-4" />
          <span class="text-foreground text-sm font-medium">{{ m.logs() }}</span>
          <Badge variant="secondary" class="bg-brand/10 text-brand h-5 px-1.5 text-xs">
            {{ logs.length }}
          </Badge>
        </div>
        <div class="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            class="h-7 gap-1.5 px-2 text-xs"
            :disabled="logs.length === 0"
            @click="exportCSV()"
          >
            <ActionDownload class="h-3 w-3" />
            {{ m.download() }}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            class="h-7 gap-1.5 px-2 text-xs"
            :disabled="logs.length === 0"
            @click="deleteAllLogs()"
          >
            <ActionTrash class="h-3 w-3" />
            {{ m.clear() }}
          </Button>
        </div>
      </div>

      <DataTable
        ref="table"
        :data="logs"
        :columns="columns"
        paginator
        export-filename="logs.clip-queue"
        :rows="10"
        :rows-per-page-options="[10, 20, 50]"
        class="[&_.p-datatable-wrapper]:border-0"
      >
        <template #empty>
          <div class="flex flex-col items-center justify-center py-12">
            <div class="bg-brand/10 mb-3 flex h-12 w-12 items-center justify-center rounded-full">
              <NavBookOpen class="text-brand h-6 w-6" />
            </div>
            <p class="text-foreground text-sm font-medium">{{ m.no_logs_captured() }}</p>
            <p class="text-muted-foreground mt-0.5 text-xs">Application logs will appear here</p>
          </div>
        </template>
      </DataTable>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import { computed, h, useTemplateRef } from 'vue'

import {
  Badge,
  Button,
  DataTable,
  InputNumber,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useConfirm
} from '@cq/ui'

import type { Log } from '@/stores/logger'
import { ActionDownload, ActionTrash, NavBookOpen, NavSettings } from '@/composables/icons'
import { useSettingsForm } from '@/composables/use-settings-form'
import * as m from '@/paraglide/messages'
import { datetime } from '@/paraglide/registry'
import {
  availableLogLevels,
  logLevelSeverities,
  logLevelTranslations,
  useLogger
} from '@/stores/logger'
import { usePreferences } from '@/stores/preferences'
import { useSettings } from '@/stores/settings'

const confirm = useConfirm()
const preferences = usePreferences()
const settings = useSettings()
const logger = useLogger()
const table = useTemplateRef<{ exportCSV: () => void }>('table')

const {
  formData: formSettings,
  formKey,
  onReset,
  onSubmit
} = useSettingsForm(
  () => settings.logger,
  (value) => {
    settings.logger = value
  },
  async () => settings.saveSettings(),
  m.logger_settings_saved()
)

const logs = computed(() => {
  return [...logger.logs].sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })
})

function formatTimestamp(timestamp: string) {
  return datetime(preferences.preferences.language, timestamp, {
    dateStyle: 'short',
    timeStyle: 'medium',
    hour12: false
  })
}

const columns = computed<ColumnDef<Log>[]>(() => [
  {
    accessorKey: 'timestamp',
    header: m.timestamp(),
    cell: ({ row }) =>
      h(
        'span',
        { class: 'text-muted-foreground text-xs tabular-nums' },
        formatTimestamp(row.original.timestamp)
      )
  },
  {
    accessorKey: 'level',
    header: m.level(),
    cell: ({ row }) => {
      const level = row.original.level
      const severity = logLevelSeverities[level]
      const severityMap: Record<string, 'default' | 'secondary' | 'destructive'> = {
        success: 'default',
        info: 'secondary',
        warn: 'default',
        error: 'destructive',
        secondary: 'secondary'
      }
      return h(Badge, { variant: severityMap[severity] || 'default', class: 'text-xs' }, () =>
        logLevelTranslations[level]()
      )
    }
  },
  {
    accessorKey: 'message',
    header: m.message(),
    cell: ({ row }) => h('span', { class: 'text-sm' }, row.original.message)
  }
])

function exportCSV() {
  logger.debug('[Logs]: exporting logs as CSV.')
  table.value?.exportCSV()
}

function deleteAllLogs() {
  logger.debug('[Logs]: attempting to delete all logs.')
  confirm.require({
    header: m.clear_logs(),
    message: m.clear_logs_confirm({ length: logs.value.length }),
    rejectProps: {
      label: m.cancel()
    },
    acceptProps: {
      label: m.confirm()
    },
    accept: () => {
      logger.debug('[Logs]: deleting all logs.')
      logger.$reset()
    },
    reject: () => {
      logger.debug('[Logs]: deletion of logs was cancelled.')
    }
  })
}
</script>
