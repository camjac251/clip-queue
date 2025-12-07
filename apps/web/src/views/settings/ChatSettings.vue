<template>
  <div v-if="user.canManageSettings" class="space-y-4">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <div class="bg-brand/10 flex h-10 w-10 items-center justify-center rounded-lg">
        <NavMessageSquare class="text-brand h-5 w-5" />
      </div>
      <div>
        <h2 class="text-foreground text-lg font-semibold">{{ m.settings_chat() }}</h2>
        <p class="text-muted-foreground text-sm">
          Configure chat command prefix and allowed commands
        </p>
      </div>
    </div>

    <!-- Settings Card -->
    <div class="border-border/50 bg-card/80 rounded-lg border backdrop-blur-sm">
      <form :key="formKey" @submit.prevent="onSubmit" @reset="onReset">
        <!-- Command Prefix -->
        <div class="border-border/30 border-b p-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0 flex-1">
              <label for="commandPrefix" class="text-foreground block text-sm font-medium">
                {{ m.command_prefix() }}
              </label>
              <p class="text-muted-foreground mt-0.5 text-xs">
                {{ m.command_prefix_description() }}
              </p>
            </div>
            <div class="sm:w-32">
              <InputText
                id="commandPrefix"
                v-model="formSettings.prefix"
                required
                :maxlength="8"
                class="h-9 font-mono text-sm"
                @keydown.space.prevent
              />
            </div>
          </div>
        </div>

        <!-- Commands List -->
        <div class="p-4">
          <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span class="text-foreground block text-sm font-medium">{{
                m.allowed_commands()
              }}</span>
              <p class="text-muted-foreground mt-0.5 text-xs">
                {{ m.allowed_commands_description() }}
              </p>
            </div>
            <div class="flex gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-7 px-2 text-xs"
                @click="selectAll"
              >
                Select All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-7 px-2 text-xs"
                @click="selectNone"
              >
                Select None
              </Button>
            </div>
          </div>

          <!-- Command Grid -->
          <div class="grid gap-2 sm:grid-cols-2">
            <div
              v-for="command in Object.values(Command)"
              :key="command"
              class="border-border/50 bg-background/50 hover:border-brand/30 hover:bg-brand/5 group flex items-start gap-2.5 rounded-md border p-2.5 transition-all duration-150"
            >
              <Checkbox :id="`cmd-${command}`" v-model="commandStates[command]" class="mt-0.5" />
              <div class="min-w-0 flex-1">
                <label
                  :for="`cmd-${command}`"
                  class="text-foreground cursor-pointer font-mono text-xs leading-none font-medium"
                >
                  {{ formSettings.prefix }}{{ command }}
                  <span v-if="commandHelp[command].args" class="text-muted-foreground font-normal">
                    {{ commandHelp[command].args!.map((arg) => `<${arg}>`).join(' ') }}
                  </span>
                </label>
                <p class="text-muted-foreground mt-1 text-[11px] leading-snug">
                  {{ commandHelp[command].description }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="border-border/30 flex gap-2 border-t p-4">
          <Button
            variant="brand"
            class="flex-1"
            type="submit"
            size="sm"
            :disabled="!settings.isCommandsSettingsModified(formSettings)"
          >
            {{ m.save() }}
          </Button>
          <Button
            variant="outline"
            class="flex-1"
            type="reset"
            size="sm"
            :disabled="!settings.isCommandsSettingsModified(formSettings)"
          >
            {{ m.cancel() }}
          </Button>
        </div>
      </form>
    </div>
  </div>

  <!-- No access message -->
  <div v-else class="space-y-4">
    <div class="border-border/50 bg-card/80 rounded-lg border p-6 text-center backdrop-blur-sm">
      <div
        class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10"
      >
        <StatusLock class="h-6 w-6 text-amber-500" />
      </div>
      <p class="text-foreground font-medium">Access Restricted</p>
      <p class="text-muted-foreground mt-1 text-sm">Only broadcasters can access chat settings.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import { Button, Checkbox, InputText } from '@cq/ui'

import { NavMessageSquare, StatusLock } from '@/composables/icons'
import { useSettingsForm } from '@/composables/use-settings-form'
import * as m from '@/paraglide/messages'
import { useSettings } from '@/stores/settings'
import { useUser } from '@/stores/user'
import { Command } from '@/types/commands'

const user = useUser()
const settings = useSettings()

// Command help information
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

const {
  formData: formSettings,
  formKey,
  onReset: baseReset,
  onSubmit
} = useSettingsForm(
  () => settings.commands,
  (value) => {
    settings.commands = value
  },
  async () => settings.saveSettings(),
  m.chat_settings_saved()
)

// Track individual checkbox states for reactivity
const commandStates = ref<Record<string, boolean>>(
  Object.fromEntries(
    Object.values(Command).map((cmd) => [cmd, formSettings.value.allowed.includes(cmd)])
  )
)

function initializeCommandStates() {
  const states: Record<string, boolean> = {}
  Object.values(Command).forEach((cmd) => {
    states[cmd] = formSettings.value.allowed.includes(cmd)
  })
  commandStates.value = states
}

// Sync commandStates changes back to formSettings.allowed
watch(
  commandStates,
  (newStates) => {
    formSettings.value.allowed = Object.entries(newStates)
      .filter(([, enabled]) => enabled)
      .map(([cmd]) => cmd as Command)
  },
  { deep: true }
)

function selectAll() {
  formSettings.value.allowed = [...Object.values(Command)]
  Object.values(Command).forEach((cmd) => {
    commandStates.value[cmd] = true
  })
}

function selectNone() {
  formSettings.value.allowed = []
  Object.values(Command).forEach((cmd) => {
    commandStates.value[cmd] = false
  })
}

function onReset() {
  baseReset()
  initializeCommandStates()
}
</script>
