<template>
  <div>
    <Card class="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <NavPalette :size="20" class="text-violet-600 dark:text-violet-500" />
          Preferences
        </CardTitle>
        <CardDescription> Customize your interface and language settings </CardDescription>
      </CardHeader>
      <CardContent>
        <form :key="formKey" @submit.prevent="onSubmit" @reset="onReset">
          <div class="flex flex-col gap-8 text-left">
            <div>
              <label for="language" class="mb-2.5 block text-sm font-semibold">{{
                m.language()
              }}</label>
              <Select v-model="formPreferences.language">
                <SelectTrigger id="language" aria-describedby="language-help">
                  <SelectValue :placeholder="languageLabels[formPreferences.language]" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="locale in locales" :key="locale" :value="locale">
                    {{ languageLabels[locale] }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Message
                id="language-help"
                size="sm"
                severity="secondary"
                variant="simple"
                class="mt-2.5 text-xs leading-relaxed"
                >{{ m.language_description() }}</Message
              >
            </div>
            <div>
              <label for="theme" class="mb-2.5 block text-sm font-semibold">{{ m.theme() }}</label>
              <Select v-model="formPreferences.theme">
                <SelectTrigger id="theme" aria-describedby="theme-help">
                  <SelectValue :placeholder="themeTranslations[formPreferences.theme]()" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="theme in availableThemes" :key="theme" :value="theme">
                    {{ themeTranslations[theme]() }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Message
                id="theme-help"
                size="sm"
                severity="secondary"
                variant="simple"
                class="mt-2.5 text-xs leading-relaxed"
                >{{ m.theme_description() }}</Message
              >
            </div>
          </div>
          <div class="border-border/50 mt-8 flex gap-2 border-t pt-6">
            <Button
              variant="default"
              class="flex-1"
              type="submit"
              size="sm"
              :disabled="!preferences.isModifiedFrom(formPreferences)"
            >
              {{ m.save() }}
            </Button>
            <Button
              variant="destructive"
              class="flex-1"
              type="reset"
              size="sm"
              :disabled="!preferences.isModifiedFrom(formPreferences)"
            >
              {{ m.cancel() }}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Message,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@cq/ui'

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
