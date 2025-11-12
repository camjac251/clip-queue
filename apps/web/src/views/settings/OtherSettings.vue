<template>
  <div class="space-y-4">
    <Card v-if="user.canManageSettings" class="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <ActionRotateCcw :size="20" class="text-violet-600 dark:text-violet-500" />
          Reset Settings
        </CardTitle>
        <CardDescription> Restore all settings to their default values </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="destructive"
          class="w-full"
          size="sm"
          :disabled="!(settings.isModified || preferences.isModified)"
          @click="resetSettingsToDefault()"
        >
          {{ m.reset_settings() }}
        </Button>
        <Message
          class="mt-4 text-xs leading-relaxed"
          size="sm"
          severity="secondary"
          variant="simple"
          >{{ m.reset_settings_description() }}</Message
        >
      </CardContent>
    </Card>

    <Card v-if="user.isBroadcaster" class="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <ActionTrash :size="20" class="text-violet-600 dark:text-violet-500" />
          Purge History
        </CardTitle>
        <CardDescription> Permanently delete all history records </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="destructive"
          class="w-full"
          size="sm"
          :disabled="queue.playHistory.length === 0"
          @click="purgeHistory()"
        >
          {{ m.purge_history() }}
        </Button>
        <Message
          class="mt-4 text-xs leading-relaxed"
          size="sm"
          severity="secondary"
          variant="simple"
          >{{ m.purge_history_description() }}</Message
        >
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Message,
  useConfirm,
  useToast
} from '@cq/ui'

import { ActionRotateCcw, ActionTrash } from '@/composables/icons'
import * as m from '@/paraglide/messages'
import { usePreferences } from '@/stores/preferences'
import { useQueueServer as useQueue } from '@/stores/queue-server'
import { useSettings } from '@/stores/settings'
import { useUser } from '@/stores/user'

const toast = useToast()
const confirm = useConfirm()
const preferences = usePreferences()
const queue = useQueue()
const settings = useSettings()
const user = useUser()

async function resetSettingsToDefault() {
  confirm.require({
    header: m.reset_settings(),
    message: m.reset_settings_confirm(),
    acceptProps: {
      label: m.confirm()
    },
    rejectProps: {
      label: m.cancel()
    },
    accept: async () => {
      try {
        // Reset local state
        settings.$reset()
        preferences.$reset()

        // Save to backend
        await settings.saveSettings()

        toast.add({
          severity: 'success',
          summary: m.success(),
          detail: m.settings_reset(),
          life: 3000
        })
      } catch {
        toast.add({
          severity: 'error',
          summary: m.error(),
          detail: 'Failed to reset settings',
          life: 3000
        })
      }
    },
    reject: () => {}
  })
}

async function purgeHistory() {
  confirm.require({
    header: m.purge_history(),
    message: m.purge_history_confirm(),
    acceptProps: {
      label: m.confirm()
    },
    rejectProps: {
      label: m.cancel()
    },
    accept: async () => {
      try {
        await queue.clearHistory()
        toast.add({
          severity: 'success',
          summary: m.success(),
          detail: m.clip_history_purged(),
          life: 3000
        })
      } catch {
        toast.add({
          severity: 'error',
          summary: m.error(),
          detail: 'Failed to purge history',
          life: 3000
        })
      }
    },
    reject: () => {}
  })
}
</script>
