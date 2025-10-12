<template>
  <div v-if="user.canManageSettings">
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
