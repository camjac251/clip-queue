<template>
  <Card v-if="user.canManageSettings" class="mx-auto mb-2 max-w-xl text-left">
    <template #content>
      <DangerButton
        :label="m.reset_settings()"
        class="mb-2"
        fluid
        size="small"
        :disabled="!(settings.isModified || preferences.isModified)"
        @click="resetSettingsToDefault()"
      ></DangerButton>
      <Message size="small" severity="secondary" variant="simple">{{
        m.reset_settings_description()
      }}</Message>
    </template>
  </Card>
  <Card v-if="user.isBroadcaster" class="mx-auto max-w-xl text-left">
    <template #content>
      <DangerButton
        :label="m.purge_history()"
        class="mb-2"
        fluid
        size="small"
        :disabled="queue.history.size() === 0"
        @click="purgeHistory()"
      ></DangerButton>
      <Message size="small" severity="secondary" variant="simple">{{
        m.purge_history_description()
      }}</Message>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { Card, DangerButton, Message, useConfirm, useToast } from '@cq/ui'

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
