<template>
  <aside
    :class="[
      'border-border bg-card flex flex-col border-r transition-all duration-300',
      isOpen ? 'w-64' : 'w-0 overflow-hidden lg:w-64'
    ]"
  >
    <!-- Search -->
    <div class="border-border border-b p-3 lg:p-4">
      <Button
        variant="outline"
        size="sm"
        class="text-muted-foreground w-full justify-start gap-2"
        @click="emit('openSearch')"
      >
        <UiSearch :size="16" />
        <span class="flex-1 text-left">{{ m.search_settings() }}</span>
        <KeyboardShortcut :keys="['K']" class="hidden sm:flex" />
      </Button>
    </div>

    <!-- Navigation Categories -->
    <ScrollArea class="flex-1">
      <div class="space-y-1 p-2">
        <!-- General Section -->
        <div class="px-2 py-1.5">
          <h3 class="text-muted-foreground mb-1 text-xs font-semibold tracking-wider uppercase">
            {{ m.general() }}
          </h3>
        </div>
        <RouterLink
          v-for="route in generalRoutes"
          :key="route.name"
          v-slot="{ navigate, isActive }"
          :to="{ name: route.name }"
          custom
        >
          <button
            :class="[
              'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
              isActive
                ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
                : 'text-foreground hover:bg-muted/50'
            ]"
            @click="navigate"
          >
            <component :is="getRouteIcon(route.meta?.icon)" :size="18" />
            <span>{{ routeTranslations[route.name as RouteNameConstants]() }}</span>
          </button>
        </RouterLink>

        <!-- System Section -->
        <div class="mt-4 px-2 py-1.5">
          <h3 class="text-muted-foreground mb-1 text-xs font-semibold tracking-wider uppercase">
            {{ m.system() }}
          </h3>
        </div>
        <RouterLink
          v-for="route in systemRoutes"
          :key="route.name"
          v-slot="{ navigate, isActive }"
          :to="{ name: route.name }"
          custom
        >
          <button
            :class="[
              'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
              isActive
                ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
                : 'text-foreground hover:bg-muted/50'
            ]"
            @click="navigate"
          >
            <component :is="getRouteIcon(route.meta?.icon)" :size="18" />
            <span>{{ routeTranslations[route.name as RouteNameConstants]() }}</span>
          </button>
        </RouterLink>

        <!-- About Section -->
        <div class="mt-4 px-2 py-1.5">
          <h3 class="text-muted-foreground mb-1 text-xs font-semibold tracking-wider uppercase">
            {{ m.information() }}
          </h3>
        </div>
        <RouterLink
          v-for="route in infoRoutes"
          :key="route.name"
          v-slot="{ navigate, isActive }"
          :to="{ name: route.name }"
          custom
        >
          <button
            :class="[
              'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
              isActive
                ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
                : 'text-foreground hover:bg-muted/50'
            ]"
            @click="navigate"
          >
            <component :is="getRouteIcon(route.meta?.icon)" :size="18" />
            <span>{{ routeTranslations[route.name as RouteNameConstants]() }}</span>
          </button>
        </RouterLink>
      </div>
    </ScrollArea>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { Button, ScrollArea } from '@cq/ui'

import KeyboardShortcut from '@/components/KeyboardShortcut.vue'
import { routeIcons, UiSearch } from '@/composables/icons'
import * as m from '@/paraglide/messages'
import { allowedRoutes, RouteNameConstants, routeTranslations } from '@/router'

interface Props {
  isOpen: boolean
}

interface Emits {
  (e: 'openSearch'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const settingsRoutes = computed(
  () => allowedRoutes.value.find((r) => r.name === RouteNameConstants.SETTINGS)?.children ?? []
)

// Categorize routes
const generalRoutes = computed(() =>
  settingsRoutes.value.filter((r) =>
    [
      RouteNameConstants.SETTINGS_PREFERENCES,
      RouteNameConstants.SETTINGS_QUEUE,
      RouteNameConstants.SETTINGS_CHAT
    ].includes(r.name as RouteNameConstants)
  )
)

const systemRoutes = computed(() =>
  settingsRoutes.value.filter((r) =>
    [RouteNameConstants.SETTINGS_LOGS, RouteNameConstants.SETTINGS_OTHER].includes(
      r.name as RouteNameConstants
    )
  )
)

const infoRoutes = computed(() =>
  settingsRoutes.value.filter((r) =>
    [RouteNameConstants.SETTINGS_ABOUT].includes(r.name as RouteNameConstants)
  )
)

function getRouteIcon(iconKey?: string) {
  if (!iconKey) return null
  return routeIcons[iconKey as keyof typeof routeIcons]
}
</script>
