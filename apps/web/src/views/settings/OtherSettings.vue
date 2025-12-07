<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <div class="bg-brand/10 flex h-10 w-10 items-center justify-center rounded-lg">
        <NavSettings class="text-brand h-5 w-5" />
      </div>
      <div>
        <h2 class="text-foreground text-lg font-semibold">{{ m.settings_other() }}</h2>
        <p class="text-muted-foreground text-sm">Advanced actions and data management</p>
      </div>
    </div>

    <!-- Reset Settings Card -->
    <div
      v-if="user.canManageSettings"
      class="border-border/50 bg-card/80 rounded-lg border backdrop-blur-sm"
    >
      <div class="border-border/30 flex items-center gap-2 border-b px-4 py-2.5">
        <ActionRotateCcw class="text-muted-foreground h-4 w-4" />
        <span class="text-foreground text-sm font-medium">Reset Settings</span>
      </div>
      <div class="p-4">
        <p class="text-muted-foreground mb-4 text-sm">
          {{ m.reset_settings_description() }}
        </p>
        <Button
          variant="destructive"
          size="sm"
          class="w-full gap-2"
          :disabled="!(settings.isModified || preferences.isModified)"
          @click="resetSettingsToDefault()"
        >
          <ActionRotateCcw class="h-3.5 w-3.5" />
          {{ m.reset_settings() }}
        </Button>
      </div>
    </div>

    <!-- Purge History Card -->
    <div
      v-if="user.isBroadcaster"
      class="border-border/50 bg-card/80 rounded-lg border backdrop-blur-sm"
    >
      <div class="border-border/30 flex items-center gap-2 border-b px-4 py-2.5">
        <ActionTrash class="text-muted-foreground h-4 w-4" />
        <span class="text-foreground text-sm font-medium">Purge History</span>
      </div>
      <div class="p-4">
        <p class="text-muted-foreground mb-4 text-sm">
          {{ m.purge_history_description() }}
        </p>
        <Button
          variant="destructive"
          size="sm"
          class="w-full gap-2"
          :disabled="queue.playHistory.length === 0"
          @click="purgeHistory()"
        >
          <ActionTrash class="h-3.5 w-3.5" />
          {{ m.purge_history() }}
          <Badge
            v-if="queue.playHistory.length > 0"
            variant="secondary"
            class="bg-destructive-foreground/20 ml-1 h-5 px-1.5 text-xs"
          >
            {{ queue.playHistory.length }}
          </Badge>
        </Button>
      </div>
    </div>

    <!-- No access message -->
    <div
      v-if="!user.canManageSettings && !user.isBroadcaster"
      class="border-border/50 bg-card/80 rounded-lg border p-6 text-center backdrop-blur-sm"
    >
      <div
        class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10"
      >
        <StatusLock class="h-6 w-6 text-amber-500" />
      </div>
      <p class="text-foreground font-medium">Access Restricted</p>
      <p class="text-muted-foreground mt-1 text-sm">Only broadcasters can access these settings.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Badge, Button, useConfirm, useToast } from '@cq/ui'

import { ActionRotateCcw, ActionTrash, NavSettings, StatusLock } from '@/composables/icons'
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
        settings.$reset()
        preferences.$reset()
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
