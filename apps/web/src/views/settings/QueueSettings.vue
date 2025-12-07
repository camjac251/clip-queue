<template>
  <div v-if="user.canManageSettings" class="space-y-4">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <div class="bg-brand/10 flex h-10 w-10 items-center justify-center rounded-lg">
        <NavInbox class="text-brand h-5 w-5" />
      </div>
      <div>
        <h2 class="text-foreground text-lg font-semibold">{{ m.queue() }}</h2>
        <p class="text-muted-foreground text-sm">Control how clips are queued and displayed</p>
      </div>
    </div>

    <!-- Settings Card -->
    <div class="border-border/50 bg-card/80 rounded-lg border backdrop-blur-sm">
      <form :key="formKey" @submit.prevent="onSubmit" @reset="onReset">
        <div class="divide-border/30 divide-y">
          <!-- Auto Moderation -->
          <div class="flex items-center justify-between gap-4 p-4">
            <div class="min-w-0 flex-1">
              <label for="autoModeration" class="text-foreground block text-sm font-medium">
                {{ m.auto_mod() }}
              </label>
              <p class="text-muted-foreground mt-0.5 text-xs">
                {{ m.auto_mod_description() }}
              </p>
            </div>
            <ToggleSwitch
              v-model="formSettings.hasAutoModerationEnabled"
              input-id="autoModeration"
            />
          </div>

          <!-- Queue Size Limit -->
          <div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0 flex-1">
              <label for="limit" class="text-foreground block text-sm font-medium">
                {{ m.size_limit() }}
              </label>
              <p class="text-muted-foreground mt-0.5 text-xs">
                {{ m.size_limit_description() }}
              </p>
            </div>
            <div class="sm:w-36">
              <InputNumber
                v-model="formSettings.limit"
                input-id="limit"
                allow-empty
                :locale="preferences.preferences.language"
                :min="1"
                :step="1"
                show-buttons
                class="w-full"
              />
            </div>
          </div>

          <!-- Allowed Providers -->
          <div class="p-4">
            <div class="mb-3">
              <label for="allowedProviders" class="text-foreground block text-sm font-medium">
                {{ m.allowed_providers() }}
              </label>
              <p class="text-muted-foreground mt-0.5 text-xs">
                {{ m.allowed_providers_description() }}
              </p>
            </div>
            <MultiSelect
              v-model="formSettings.providers"
              input-id="allowedProviders"
              :options="[...PROVIDERS]"
              :placeholder="m.none()"
              display="chip"
            >
              <template #option="{ option }: { option: Provider }">
                <ProviderName :provider="option" size="small" />
              </template>
              <template #chip="{ value }: { value: Provider }">
                <Chip>
                  <ProviderName :provider="value" size="small" />
                </Chip>
              </template>
            </MultiSelect>
          </div>
        </div>

        <!-- Actions -->
        <div class="border-border/30 flex gap-2 border-t p-4">
          <Button
            variant="brand"
            class="flex-1"
            type="submit"
            size="sm"
            :disabled="!settings.isQueueSettingsModified(formSettings)"
          >
            {{ m.save() }}
          </Button>
          <Button
            variant="outline"
            class="flex-1"
            type="reset"
            size="sm"
            :disabled="!settings.isQueueSettingsModified(formSettings)"
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
      <p class="text-muted-foreground mt-1 text-sm">Only broadcasters can access queue settings.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Provider } from '@cq/schemas/settings'
import { PROVIDERS } from '@cq/schemas/settings'
import { Button, Chip, InputNumber, MultiSelect, ToggleSwitch } from '@cq/ui'

import ProviderName from '@/components/ProviderName.vue'
import { NavInbox, StatusLock } from '@/composables/icons'
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
