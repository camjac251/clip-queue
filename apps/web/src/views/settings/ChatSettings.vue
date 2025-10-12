<template>
  <div v-if="user.canManageSettings">
    <Card class="mx-auto mb-2 max-w-xl">
      <template #content>
        <div class="m-0 flex flex-col gap-2 p-0 text-left">
          <label for="username">{{ m.connected_chat_colon() }}</label>
          <div class="flex w-full items-stretch">
            <span
              class="border-surface-300 dark:border-surface-700 bg-surface-0 dark:bg-surface-950 text-surface-400 flex min-w-10 items-center justify-center rounded-s-md border-y border-s"
            >
              <!-- eslint-disable-next-line vue/no-v-html -->
              <svg class="h-5 w-5" v-html="sources.logo"></svg>
            </span>
            <InputText
              id="username"
              v-model="user.username"
              readonly
              fluid
              pt:root="flex-1 rounded-none"
            />
            <span
              class="border-surface-300 dark:border-surface-700 bg-surface-0 dark:bg-surface-950 text-surface-400 flex min-w-10 items-center justify-center gap-2 rounded-none border-y border-e px-2"
            >
              <SourceIndicator :status="sources.status" />
            </span>
            <span
              class="border-surface-300 dark:border-surface-700 bg-surface-0 dark:bg-surface-950 text-surface-400 flex min-w-10 items-center justify-center gap-2 rounded-e-md border-y border-e px-2"
            >
              <i
                v-tooltip="m.reconnect()"
                class="pi pi-refresh hover:cursor-pointer"
                @click="sources.reconnect()"
              ></i>
            </span>
          </div>
        </div>
      </template>
    </Card>
    <Card class="mx-auto max-w-xl">
      <template #content>
        <form :key="formKey" @submit.prevent="onSubmit" @reset="onReset">
          <div class="flex flex-col gap-2 text-left">
            <label for="commandPrefix">{{ m.command_prefix() }}</label>
            <InputText
              id="commandPrefix"
              v-model="formSettings.prefix"
              required
              maxlength="8"
              aria-describedby="commandPrefix-help"
              @keydown.space.prevent
            />
            <Message id="commandPrefix-help" size="small" severity="secondary" variant="simple">{{
              m.command_prefix_description()
            }}</Message>
            <label for="allowedCommands">{{ m.allowed_commands() }}</label>
            <MultiSelect
              v-model="formSettings.allowed"
              input-id="allowedCommands"
              :options="Object.values(Command)"
              :placeholder="m.none()"
              display="chip"
              aria-describedby="allowedCommands-help"
            >
              <template #option="{ option }: { option: Command }">
                <div class="flex flex-col gap-1">
                  <p>{{ toCommandCall(option) }}</p>
                  <small>{{ commandHelp[option].description }}</small>
                </div>
              </template>
            </MultiSelect>
            <Message id="allowedCommands-help" size="small" severity="secondary" variant="simple">{{
              m.allowed_commands_description()
            }}</Message>
          </div>
          <div class="mt-3">
            <SecondaryButton
              :label="m.save()"
              size="small"
              class="mr-2"
              type="submit"
              :disabled="!settings.isCommandsSettingsModified(formSettings)"
            ></SecondaryButton>
            <DangerButton
              type="reset"
              :label="m.cancel()"
              size="small"
              :disabled="!settings.isCommandsSettingsModified(formSettings)"
            ></DangerButton>
          </div>
        </form>
      </template>
    </Card>
  </div>
  <div v-else>
    <Message severity="warn">
      <p>Only broadcasters can access settings.</p>
    </Message>
  </div>
</template>

<script setup lang="ts">
import { ref, toRaw } from 'vue'

import {
  Card,
  DangerButton,
  InputText,
  Message,
  MultiSelect,
  SecondaryButton,
  useToast
} from '@cq/ui'

import SourceIndicator from '@/components/SourceIndicator.vue'
import * as m from '@/paraglide/messages'
import { useSettings } from '@/stores/settings'
import { useUser } from '@/stores/user'
import { useWebSocket } from '@/stores/websocket'
import { Command } from '@/types/commands'

const toast = useToast()
const user = useUser()
const settings = useSettings()
const websocket = useWebSocket()

// Backend connection indicator
const sources = {
  logo: '<path fill="currentColor" d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.429h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>',
  status: websocket.status,
  reconnect: () => {
    const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
    websocket.connect(serverUrl)
  }
}

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
  [Command.PREVIOUS]: { description: m.command_previous() },
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

function toCommandCall(command: Command) {
  const help = commandHelp[command]
  let cmd = command.toString()
  if (help.args && help.args.length > 0) {
    cmd += ' '
    cmd += help.args.map((arg) => `<${arg}>`).join(' ')
  }
  return cmd
}

function onReset() {
  formSettings.value = structuredClone(toRaw(settings.commands))
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
