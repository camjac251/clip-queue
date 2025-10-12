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
import { Card } from '@cq/ui'

import { config } from '@/config'
import * as m from '@/paraglide/messages'

const version = __APP_VERSION__
</script>
