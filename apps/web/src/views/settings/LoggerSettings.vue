<template>
  <div class="space-y-4">
    <!-- Logger Configuration -->
    <Card class="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <NavSettings :size="20" class="text-violet-600 dark:text-violet-500" />
          Logger Configuration
        </CardTitle>
        <CardDescription> Configure log level and storage limits </CardDescription>
      </CardHeader>
      <CardContent>
        <form :key="formKey" @submit.prevent="onSubmit" @reset="onReset">
          <div class="flex flex-col gap-8 text-left">
            <div>
              <label for="loggerLevel" class="mb-2.5 block text-sm font-semibold">{{
                m.level_colon()
              }}</label>
              <Select v-model="formSettings.level">
                <SelectTrigger id="loggerLevel" aria-describedby="loggerLevel-help">
                  <SelectValue :placeholder="logLevelTranslations[formSettings.level]()" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="level in availableLogLevels" :key="level" :value="level">
                    {{ logLevelTranslations[level]() }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Message
                id="loggerLevel-help"
                size="sm"
                severity="secondary"
                variant="simple"
                class="mt-2.5 text-xs leading-relaxed"
                >{{ m.logger_level_description() }}</Message
              >
            </div>
            <div>
              <label for="loggerLimit" class="mb-2.5 block text-sm font-semibold">{{
                m.size_limit()
              }}</label>
              <InputNumber
                v-model="formSettings.limit"
                input-id="loggerLimit"
                :allow-empty="false"
                :locale="preferences.preferences.language"
                :min="1"
                :max="100000"
                :step="1"
                show-buttons
                aria-describedby="loggerLimit-help"
              />
              <Message
                id="loggerLimit-help"
                size="sm"
                severity="secondary"
                variant="simple"
                class="mt-2.5 text-xs leading-relaxed"
                >{{ m.logger_size_limit_description() }}</Message
              >
            </div>
          </div>
          <div class="border-border/50 mt-8 flex gap-2 border-t pt-6">
            <Button
              variant="default"
              class="flex-1"
              type="submit"
              size="sm"
              :disabled="!settings.isLoggerSettingsModified(formSettings)"
            >
              {{ m.save() }}
            </Button>
            <Button
              variant="destructive"
              class="flex-1"
              type="reset"
              size="sm"
              :disabled="!settings.isLoggerSettingsModified(formSettings)"
            >
              {{ m.cancel() }}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>

    <!-- Logs View -->
    <Card class="mx-auto max-w-3xl">
      <CardHeader>
        <div class="flex items-center justify-between">
          <div>
            <CardTitle class="flex items-center gap-2">
              <NavBookOpen :size="20" class="text-violet-600 dark:text-violet-500" />
              {{ m.logs() }}
            </CardTitle>
            <CardDescription> View application logs and debugging information </CardDescription>
          </div>
          <div class="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              :disabled="logs.length === 0"
              @click="exportCSV()"
            >
              {{ m.download() }}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              :disabled="logs.length === 0"
              @click="deleteAllLogs()"
            >
              {{ m.clear() }}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent class="p-0">
        <DataTable
          ref="table"
          :data="logs"
          :columns="columns"
          paginator
          export-filename="logs.clip-queue"
          :rows="10"
          :rows-per-page-options="[10, 20, 50]"
        >
          <template #empty>
            <div class="text-muted-foreground flex flex-col items-center justify-center py-12">
              <NavBookOpen :size="48" class="mb-4 opacity-50" />
              <p class="text-lg font-medium">{{ m.no_logs_captured() }}</p>
              <p class="text-sm">Application logs will appear here</p>
            </div>
          </template>
        </DataTable>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import { computed, h, useTemplateRef } from 'vue'

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  InputNumber,
  Message,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useConfirm
} from '@cq/ui'

import type { Log } from '@/stores/logger'
import { NavBookOpen, NavSettings } from '@/composables/icons'
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
    cell: ({ row }) => formatTimestamp(row.original.timestamp)
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
      return h(Badge, { variant: severityMap[severity] || 'default' }, () =>
        logLevelTranslations[level]()
      )
    }
  },
  {
    accessorKey: 'message',
    header: m.message()
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
