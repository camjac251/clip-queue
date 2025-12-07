<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <div class="bg-brand/10 flex h-10 w-10 items-center justify-center rounded-lg">
        <NavPalette class="text-brand h-5 w-5" />
      </div>
      <div>
        <h2 class="text-foreground text-lg font-semibold">{{ m.settings_preferences() }}</h2>
        <p class="text-muted-foreground text-sm">Customize your interface and language settings</p>
      </div>
    </div>

    <!-- Settings Card -->
    <div class="border-border/50 bg-card/80 rounded-lg border backdrop-blur-sm">
      <form :key="formKey" @submit.prevent="onSubmit" @reset="onReset">
        <div class="divide-border/30 divide-y">
          <!-- Language Setting -->
          <div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0 flex-1">
              <label for="language" class="text-foreground block text-sm font-medium">
                {{ m.language() }}
              </label>
              <p class="text-muted-foreground mt-0.5 text-xs">
                {{ m.language_description() }}
              </p>
            </div>
            <div class="sm:w-48">
              <Select v-model="formPreferences.language">
                <SelectTrigger id="language" class="h-9 text-sm">
                  <SelectValue :placeholder="languageLabels[formPreferences.language]" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="locale in locales" :key="locale" :value="locale">
                    {{ languageLabels[locale] }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <!-- Theme Setting -->
          <div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0 flex-1">
              <label for="theme" class="text-foreground block text-sm font-medium">
                {{ m.theme() }}
              </label>
              <p class="text-muted-foreground mt-0.5 text-xs">
                {{ m.theme_description() }}
              </p>
            </div>
            <div class="sm:w-48">
              <Select v-model="formPreferences.theme">
                <SelectTrigger id="theme" class="h-9 text-sm">
                  <SelectValue :placeholder="themeTranslations[formPreferences.theme]()" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="theme in availableThemes" :key="theme" :value="theme">
                    {{ themeTranslations[theme]() }}
                  </SelectItem>
                </SelectContent>
              </Select>
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
            :disabled="!preferences.isModifiedFrom(formPreferences)"
          >
            {{ m.save() }}
          </Button>
          <Button
            variant="outline"
            class="flex-1"
            type="reset"
            size="sm"
            :disabled="!preferences.isModifiedFrom(formPreferences)"
          >
            {{ m.cancel() }}
          </Button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@cq/ui'

import type { Locale } from '@/paraglide/runtime'
import type { Theme } from '@/stores/preferences'
import { NavPalette } from '@/composables/icons'
import { useSettingsForm } from '@/composables/use-settings-form'
import * as m from '@/paraglide/messages'
import { locales } from '@/paraglide/runtime'
import { availableThemes, usePreferences } from '@/stores/preferences'

const preferences = usePreferences()

const {
  formData: formPreferences,
  formKey,
  onReset,
  onSubmit
} = useSettingsForm(
  () => preferences.preferences,
  (value) => {
    preferences.preferences = value
  },
  async () => {},
  m.preferences_saved()
)

const themeTranslations: Record<Theme, () => string> = {
  dark: m.theme_dark,
  light: m.theme_light
}

const languageLabels: Record<Locale, string> = {
  ar: 'عربي (Arabic)',
  de: 'Deutsch (German)',
  en: 'English',
  es: 'Español (Spanish)',
  fr: 'Français (French)',
  hi: 'हिंदी (Hindi)',
  it: 'Italiano (Italian)',
  ja: '日本語 (Japanese)',
  ko: '한국인 (Korean)',
  pt: 'Português (Portuguese)',
  ru: 'русский (Russian)',
  tr: 'Türkçe (Turkish)',
  zh: '中文 (Chinese)'
}
</script>
