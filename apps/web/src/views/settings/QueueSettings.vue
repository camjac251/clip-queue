<template>
  <Card class="mx-auto max-w-xl">
    <template #content>
      <form :key="formKey" @submit.prevent="onSubmit" @reset="onReset">
        <div class="flex flex-col gap-2 text-left">
          <div class="flex justify-between">
            <label for="autoModeration">{{ m.auto_mod() }}</label>
            <ToggleSwitch
              v-model="formSettings.hasAutoModerationEnabled"
              input-id="autoModeration"
              aria-describedby="autoModeration-help"
            />
          </div>
          <Message id="autoModeration-help" size="small" severity="secondary" variant="simple">{{
            m.auto_mod_description()
          }}</Message>
          <label for="limit">{{ m.size_limit() }}</label>
          <InputNumber
            v-model="formSettings.limit"
            input-id="limit"
            allow-empty
            :locale="preferences.preferences.language"
            :min="1"
            :step="1"
            show-buttons
            aria-describedby="limit-help"
          />
          <Message id="limit-help" size="small" severity="secondary" variant="simple">{{
            m.size_limit_description()
          }}</Message>
          <label for="allowedPlatforms">{{ m.allowed_platforms() }}</label>
          <MultiSelect
            v-model="formSettings.platforms"
            input-id="allowedPlatforms"
            :options="Object.values(Platform)"
            :placeholder="m.none()"
            display="chip"
            aria-describedby="allowedPlatforms-help"
          >
            <template #option="{ option }: { option: Platform }">
              <PlatformName :platform="option" />
            </template>
            <template #chip="{ value }: { value: Platform }">
              <Chip>
                <PlatformName :platform="value" />
              </Chip>
            </template>
          </MultiSelect>
          <Message id="allowedPlatforms-help" size="small" severity="secondary" variant="simple">{{
            m.allowed_platforms_description()
          }}</Message>
        </div>
        <div class="mt-3">
          <SecondaryButton
            :label="m.save()"
            class="mr-2"
            type="submit"
            size="small"
            :disabled="!settings.isQueueSettingsModified(formSettings)"
          ></SecondaryButton>
          <DangerButton
            :label="m.cancel()"
            type="reset"
            size="small"
            :disabled="!settings.isQueueSettingsModified(formSettings)"
          ></DangerButton>
        </div>
      </form>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { ref, toRaw } from 'vue'

import { Platform } from '@cq/platforms'
import {
  Card,
  Chip,
  DangerButton,
  InputNumber,
  Message,
  MultiSelect,
  SecondaryButton,
  ToggleSwitch,
  useToast
} from '@cq/ui'

import PlatformName from '@/components/PlatformName.vue'
import * as m from '@/paraglide/messages'
import { usePreferences } from '@/stores/preferences'
import { useSettings } from '@/stores/settings'

const toast = useToast()
const settings = useSettings()
const preferences = usePreferences()

const formKey = ref(1)
const formSettings = ref(structuredClone(toRaw(settings.queue)))

function onReset() {
  formSettings.value = structuredClone(toRaw(settings.queue))
  formKey.value += 1
}

async function onSubmit() {
  try {
    // Update local state
    settings.queue = formSettings.value

    // Save to backend
    await settings.saveSettings()

    toast.add({
      severity: 'success',
      summary: m.success(),
      detail: m.queue_settings_saved(),
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
