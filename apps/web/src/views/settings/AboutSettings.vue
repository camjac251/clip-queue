<template>
  <div class="space-y-4">
    <!-- Header with App Info -->
    <div class="border-border/50 bg-card/80 rounded-lg border backdrop-blur-sm">
      <div class="flex items-center gap-4 p-4">
        <div class="bg-brand/10 flex h-14 w-14 items-center justify-center rounded-xl">
          <img src="/icon.png" alt="Clip Queue" class="h-10 w-10" />
        </div>
        <div class="flex-1">
          <h1 class="text-foreground text-lg font-semibold">{{ config.title }}</h1>
          <div class="text-muted-foreground mt-0.5 flex items-center gap-2 text-sm">
            <Badge variant="secondary" class="bg-brand/10 text-brand h-5 px-1.5 text-xs">
              v{{ version }}
            </Badge>
            <span>{{ m.about_description() }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Features Card -->
    <div class="border-border/50 bg-card/80 rounded-lg border backdrop-blur-sm">
      <div class="border-border/30 flex items-center gap-2 border-b px-4 py-2.5">
        <NavStar class="text-brand h-4 w-4" />
        <span class="text-foreground text-sm font-medium">{{ m.about_features() }}</span>
      </div>
      <div class="divide-border/30 divide-y">
        <div
          v-for="(feature, index) in features"
          :key="index"
          class="hover:bg-muted/30 flex gap-3 p-3 transition-colors"
        >
          <div
            class="bg-brand/10 mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded"
          >
            <UiCheck class="text-brand h-3.5 w-3.5" />
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="text-foreground text-sm font-medium">{{ feature.title }}</h3>
            <p class="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              {{ feature.description }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Credits Card -->
    <div class="border-border/50 bg-card/80 rounded-lg border backdrop-blur-sm">
      <div class="border-border/30 flex items-center gap-2 border-b px-4 py-2.5">
        <NavInfo class="text-brand h-4 w-4" />
        <span class="text-foreground text-sm font-medium">{{ m.about_credits() }}</span>
      </div>
      <div class="space-y-3 p-4">
        <p class="text-foreground text-sm">{{ m.about_fork_notice() }}</p>
        <p class="text-foreground text-sm">
          {{ m.about_original_author() }}
          <a
            :href="config.github"
            target="_blank"
            rel="noopener noreferrer"
            class="text-brand hover:underline"
          >
            {{ config.copyright.owner }}
          </a>
        </p>
        <p class="text-muted-foreground text-xs">{{ m.about_license() }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { Badge } from '@cq/ui'

import { NavInfo, NavStar, UiCheck } from '@/composables/icons'
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
