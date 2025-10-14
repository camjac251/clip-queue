<template>
  <div v-if="user.canManageSettings">
    <Card class="mx-auto max-w-4xl">
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <NavMessageSquare :size="20" class="text-violet-600 dark:text-violet-500" />
          Chat Commands
        </CardTitle>
        <CardDescription> Configure chat command prefix and allowed commands </CardDescription>
      </CardHeader>
      <CardContent>
        <form :key="formKey" @submit.prevent="onSubmit" @reset="onReset">
          <div class="flex flex-col gap-6 text-left">
            <!-- Command Prefix -->
            <div class="space-y-2">
              <label for="commandPrefix" class="font-medium">{{ m.command_prefix() }}</label>
              <InputText
                id="commandPrefix"
                v-model="formSettings.prefix"
                required
                :maxlength="8"
                aria-describedby="commandPrefix-help"
                @keydown.space.prevent
              />
              <Message id="commandPrefix-help" size="sm" severity="secondary" variant="simple">{{
                m.command_prefix_description()
              }}</Message>
            </div>

            <!-- Commands Grid -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <label class="font-medium">{{ m.allowed_commands() }}</label>
                <div class="flex gap-2">
                  <Button type="button" variant="outline" size="sm" @click="selectAll">
                    Select All
                  </Button>
                  <Button type="button" variant="outline" size="sm" @click="selectNone">
                    Select None
                  </Button>
                </div>
              </div>
              <Message size="sm" severity="secondary" variant="simple">{{
                m.allowed_commands_description()
              }}</Message>

              <!-- Command List -->
              <div class="grid gap-2 sm:grid-cols-2">
                <div
                  v-for="command in Object.values(Command)"
                  :key="command"
                  class="group border-border bg-card hover:bg-muted/30 relative flex items-start gap-3 rounded-md border p-3 transition-colors hover:border-violet-500/50"
                >
                  <Checkbox :id="`cmd-${command}`" v-model="commandStates[command]" />
                  <div class="flex-1 space-y-0.5">
                    <label
                      :for="`cmd-${command}`"
                      class="cursor-pointer font-mono text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {{ formSettings.prefix }}{{ command }}
                      <span v-if="commandHelp[command].args" class="text-muted-foreground">
                        {{ commandHelp[command].args!.map((arg) => `<${arg}>`).join(' ') }}
                      </span>
                    </label>
                    <p class="text-muted-foreground text-xs">
                      {{ commandHelp[command].description }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="border-border/50 mt-6 flex gap-2 border-t pt-4">
            <Button
              variant="default"
              class="flex-1"
              type="submit"
              size="sm"
              :disabled="!settings.isCommandsSettingsModified(formSettings)"
            >
              {{ m.save() }}
            </Button>
            <Button
              variant="destructive"
              class="flex-1"
              type="reset"
              size="sm"
              :disabled="!settings.isCommandsSettingsModified(formSettings)"
            >
              {{ m.cancel() }}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  </div>
  <div v-else>
    <Message severity="warn">
      <p>Only broadcasters can access settings.</p>
    </Message>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, toRaw, watch } from 'vue'

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  InputText,
  Message,
  useToast
} from '@cq/ui'

import { NavMessageSquare } from '@/composables/icons'
import * as m from '@/paraglide/messages'
import { useSettings } from '@/stores/settings'
import { useUser } from '@/stores/user'
import { Command } from '@/types/commands'

const toast = useToast()
const user = useUser()
const settings = useSettings()

// Command help information (note: commands are handled by backend)
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

const formKey = ref(1)
const formSettings = ref(structuredClone(toRaw(settings.commands)))

// Track individual checkbox states for reactivity
const commandStates = ref<Record<string, boolean>>({})

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

onMounted(() => {
  formSettings.value = structuredClone(toRaw(settings.commands))
  initializeCommandStates()
  formKey.value += 1
})

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
  formSettings.value = structuredClone(toRaw(settings.commands))
  initializeCommandStates()
  formKey.value += 1
}

async function onSubmit() {
  try {
    // Update local state
    settings.commands = formSettings.value

    // Save to backend
    await settings.saveSettings()

    toast.add({
      severity: 'success',
      summary: m.success(),
      detail: m.chat_settings_saved(),
      life: 3000
    })
    onReset()
  } catch {
    toast.add({
      severity: 'error',
      summary: m.error(),
      detail: 'Failed to save settings',
      life: 3000
    })
  }
}
</script>
