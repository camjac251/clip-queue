<template>
  <div class="mx-auto max-w-xl space-y-4">
    <!-- Project Info Card -->
    <Card>
      <template #content>
        <div class="space-y-4 text-left">
          <div class="flex items-center gap-3">
            <img src="/icon.png" alt="Clip Queue" class="h-16 w-16" />
            <div>
              <h2 class="text-surface-800 dark:text-surface-100 text-2xl font-bold">
                {{ config.title }}
              </h2>
              <p class="text-surface-500 dark:text-surface-400 text-sm">
                {{ m.application_version({ version }) }}
              </p>
            </div>
          </div>
          <p class="text-surface-600 dark:text-surface-300">
            {{ m.about_description() }}
          </p>
        </div>
      </template>
    </Card>

    <!-- Features Section -->
    <Card>
      <template #content>
        <div class="space-y-4 text-left">
          <h3 class="text-surface-800 dark:text-surface-100 text-lg font-semibold">
            {{ m.about_features() }}
          </h3>
          <div class="space-y-3">
            <div v-for="feature in features" :key="feature.title" class="space-y-1">
              <div class="text-surface-900 dark:text-surface-50 text-sm font-semibold">
                {{ feature.title }}
              </div>
              <div class="text-surface-600 dark:text-surface-400 text-sm leading-relaxed">
                {{ feature.description }}
              </div>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <!-- Credits & License Card -->
    <Card>
      <template #content>
        <div class="space-y-3 text-left">
          <h3 class="text-surface-800 dark:text-surface-100 mb-2 text-lg font-semibold">
            {{ m.about_credits() }}
          </h3>
          <div class="text-surface-600 dark:text-surface-300 space-y-2 text-sm">
            <p>{{ m.about_fork_notice() }}</p>
            <p>
              {{ m.about_original_author() }}
              <a
                :href="config.github"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary-600 dark:text-primary-400 hover:underline"
              >
                {{ config.copyright.owner }}
              </a>
            </p>
            <p class="text-surface-500 dark:text-surface-400">
              {{ m.about_license() }}
            </p>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { Card } from '@cq/ui'

import { config } from '@/config'
import * as m from '@/paraglide/messages'

const version = __APP_VERSION__

const features = computed(() => [
  {
    title: m.about_feature_connect_title(),
    description: m.about_feature_connect_description(),
    icon: 'pi pi-comments'
  },
  {
    title: m.about_feature_duplicate_prevent_title(),
    description: m.about_feature_duplicate_prevent_description(),
    icon: 'pi pi-copy'
  },
  {
    title: m.about_feature_popularity_title(),
    description: m.about_feature_popularity_description(),
    icon: 'pi pi-chart-line'
  },
  {
    title: m.about_feature_commands_title(),
    description: m.about_feature_commands_description(),
    icon: 'pi pi-bolt'
  },
  {
    title: m.about_feature_moderation_title(),
    description: m.about_feature_moderation_description(),
    icon: 'pi pi-flag'
  },
  {
    title: m.about_feature_settings_title(),
    description: m.about_feature_settings_description(),
    icon: 'pi pi-cog'
  }
])
</script>
