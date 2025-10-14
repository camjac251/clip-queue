<template>
  <div class="mx-auto max-w-3xl space-y-4">
    <!-- Project Info Card -->
    <Card>
      <CardHeader>
        <div class="flex items-center gap-3">
          <img src="/icon.png" alt="Clip Queue" class="h-12 w-12 rounded-lg" />
          <div>
            <CardTitle>{{ config.title }}</CardTitle>
            <CardDescription>
              {{ m.application_version({ version }) }}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent class="text-left">
        <p class="text-foreground">
          {{ m.about_description() }}
        </p>
      </CardContent>
    </Card>

    <!-- Features Section -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <NavInfo :size="20" class="text-violet-600 dark:text-violet-500" />
          {{ m.about_features() }}
        </CardTitle>
        <CardDescription> Key features and capabilities </CardDescription>
      </CardHeader>
      <CardContent class="text-left">
        <div class="space-y-3">
          <div v-for="feature in features" :key="feature.title" class="space-y-1">
            <div class="text-foreground text-sm font-semibold">
              {{ feature.title }}
            </div>
            <div class="text-muted-foreground text-sm leading-relaxed">
              {{ feature.description }}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Credits & License Card -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <NavInfo :size="20" class="text-violet-600 dark:text-violet-500" />
          {{ m.about_credits() }}
        </CardTitle>
        <CardDescription> Attribution and licensing information </CardDescription>
      </CardHeader>
      <CardContent class="text-left">
        <div class="text-foreground space-y-2 text-sm">
          <p>{{ m.about_fork_notice() }}</p>
          <p>
            {{ m.about_original_author() }}
            <a
              :href="config.github"
              target="_blank"
              rel="noopener noreferrer"
              class="text-violet-600 hover:underline dark:text-violet-500"
            >
              {{ config.copyright.owner }}
            </a>
          </p>
          <p class="text-muted-foreground">
            {{ m.about_license() }}
          </p>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@cq/ui'

import { NavInfo } from '@/composables/icons'
import { config } from '@/config'
import * as m from '@/paraglide/messages'

const version = __APP_VERSION__

const features = computed(() => [
  {
    title: m.about_feature_connect_title(),
    description: m.about_feature_connect_description()
  },
  {
    title: m.about_feature_duplicate_prevent_title(),
    description: m.about_feature_duplicate_prevent_description()
  },
  {
    title: m.about_feature_popularity_title(),
    description: m.about_feature_popularity_description()
  },
  {
    title: m.about_feature_commands_title(),
    description: m.about_feature_commands_description()
  },
  {
    title: m.about_feature_moderation_title(),
    description: m.about_feature_moderation_description()
  },
  {
    title: m.about_feature_settings_title(),
    description: m.about_feature_settings_description()
  }
])
</script>
