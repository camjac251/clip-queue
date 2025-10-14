<template>
  <div v-if="user.canManageSettings">
    <Card class="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <NavInbox :size="20" class="text-violet-600 dark:text-violet-500" />
          Queue Configuration
        </CardTitle>
        <CardDescription> Control how clips are queued and displayed </CardDescription>
      </CardHeader>
      <CardContent>
        <form :key="formKey" @submit.prevent="onSubmit" @reset="onReset">
          <div class="flex flex-col gap-4 text-left">
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <label for="autoModeration" class="font-medium">{{ m.auto_mod() }}</label>
                <ToggleSwitch
                  v-model="formSettings.hasAutoModerationEnabled"
                  input-id="autoModeration"
                  aria-describedby="autoModeration-help"
                />
              </div>
              <Message id="autoModeration-help" size="sm" severity="secondary" variant="simple">{{
                m.auto_mod_description()
              }}</Message>
            </div>
            <div class="space-y-2">
              <label for="limit" class="font-medium">{{ m.size_limit() }}</label>
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
              <Message id="limit-help" size="sm" severity="secondary" variant="simple">{{
                m.size_limit_description()
              }}</Message>
            </div>
            <div class="space-y-2">
              <label for="allowedPlatforms" class="font-medium">{{ m.allowed_platforms() }}</label>
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
              <Message id="allowedPlatforms-help" size="sm" severity="secondary" variant="simple">{{
                m.allowed_platforms_description()
              }}</Message>
            </div>
          </div>
          <div class="border-border/50 mt-6 flex gap-2 border-t pt-4">
            <Button
              variant="default"
              class="flex-1"
              type="submit"
              size="sm"
              :disabled="!settings.isQueueSettingsModified(formSettings)"
            >
              {{ m.save() }}
            </Button>
            <Button
              variant="destructive"
              class="flex-1"
              type="reset"
              size="sm"
              :disabled="!settings.isQueueSettingsModified(formSettings)"
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
import { onMounted, ref, toRaw } from 'vue'

import { Platform } from '@cq/platforms'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Chip,
  InputNumber,
  Message,
  MultiSelect,
  ToggleSwitch,
  useToast
} from '@cq/ui'

import PlatformName from '@/components/PlatformName.vue'
import { NavInbox } from '@/composables/icons'
import * as m from '@/paraglide/messages'
import { usePreferences } from '@/stores/preferences'
import { useSettings } from '@/stores/settings'
import { useUser } from '@/stores/user'

const toast = useToast()
const settings = useSettings()
const preferences = usePreferences()
const user = useUser()

const formKey = ref(1)
const formSettings = ref(structuredClone(toRaw(settings.queue)))

onMounted(() => {
  // Initialize form with latest settings
  formSettings.value = structuredClone(toRaw(settings.queue))
})

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
