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
          <div class="flex flex-col gap-8 text-left">
            <div>
              <div class="mb-2.5 flex items-center justify-between gap-4">
                <label for="autoModeration" class="text-sm font-semibold">{{ m.auto_mod() }}</label>
                <ToggleSwitch
                  v-model="formSettings.hasAutoModerationEnabled"
                  input-id="autoModeration"
                  aria-describedby="autoModeration-help"
                />
              </div>
              <Message
                id="autoModeration-help"
                size="sm"
                severity="secondary"
                variant="simple"
                class="text-xs leading-relaxed"
                >{{ m.auto_mod_description() }}</Message
              >
            </div>
            <div>
              <label for="limit" class="mb-2.5 block text-sm font-semibold">{{
                m.size_limit()
              }}</label>
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
              <Message
                id="limit-help"
                size="sm"
                severity="secondary"
                variant="simple"
                class="mt-2.5 text-xs leading-relaxed"
                >{{ m.size_limit_description() }}</Message
              >
            </div>
            <div>
              <label for="allowedPlatforms" class="mb-2.5 block text-sm font-semibold">{{
                m.allowed_platforms()
              }}</label>
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
              <Message
                id="allowedPlatforms-help"
                size="sm"
                severity="secondary"
                variant="simple"
                class="mt-2.5 text-xs leading-relaxed"
                >{{ m.allowed_platforms_description() }}</Message
              >
            </div>
          </div>
          <div class="border-border/50 mt-8 flex gap-2 border-t pt-6">
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
  ToggleSwitch
} from '@cq/ui'

import PlatformName from '@/components/PlatformName.vue'
import { NavInbox } from '@/composables/icons'
import { useSettingsForm } from '@/composables/use-settings-form'
import * as m from '@/paraglide/messages'
import { usePreferences } from '@/stores/preferences'
import { useSettings } from '@/stores/settings'
import { useUser } from '@/stores/user'

const settings = useSettings()
const preferences = usePreferences()
const user = useUser()

const {
  formData: formSettings,
  formKey,
  onReset,
  onSubmit
} = useSettingsForm(
  () => settings.queue,
  (value) => {
    settings.queue = value
  },
  async () => settings.saveSettings(),
  m.queue_settings_saved()
)
</script>
