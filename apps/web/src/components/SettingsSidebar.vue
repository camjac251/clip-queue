<template>
  <aside
    :class="[
      'border-border/50 bg-card/80 flex flex-col border-r backdrop-blur-sm transition-all duration-200',
      isOpen
        ? 'fixed inset-y-0 left-0 z-50 w-64 lg:relative lg:z-auto'
        : 'w-0 overflow-hidden lg:w-56'
    ]"
  >
    <!-- Navigation Categories -->
    <ScrollArea class="flex-1">
      <div class="space-y-1 p-2">
        <!-- General Section -->
        <div class="px-2 py-1.5">
          <h3
            class="text-muted-foreground mb-1 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase"
          >
            <UiCircle class="fill-brand text-brand h-1 w-1" />
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
              'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-all duration-150',
              isActive
                ? 'bg-brand/10 text-brand shadow-sm'
                : 'text-foreground hover:bg-muted/50 hover:text-brand'
            ]"
            @click="navigate"
          >
            <component
              :is="getRouteIcon(route.meta?.icon)"
              :size="16"
              :class="isActive ? 'text-brand' : 'text-muted-foreground'"
            />
            <span>{{ routeTranslations[route.name as RouteNameConstants]() }}</span>
          </button>
        </RouterLink>

        <!-- System Section -->
        <div class="mt-4 px-2 py-1.5">
          <h3
            class="text-muted-foreground mb-1 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase"
          >
            <UiCircle class="fill-brand text-brand h-1 w-1" />
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
              'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-all duration-150',
              isActive
                ? 'bg-brand/10 text-brand shadow-sm'
                : 'text-foreground hover:bg-muted/50 hover:text-brand'
            ]"
            @click="navigate"
          >
            <component
              :is="getRouteIcon(route.meta?.icon)"
              :size="16"
              :class="isActive ? 'text-brand' : 'text-muted-foreground'"
            />
            <span>{{ routeTranslations[route.name as RouteNameConstants]() }}</span>
          </button>
        </RouterLink>

        <!-- About Section -->
        <div class="mt-4 px-2 py-1.5">
          <h3
            class="text-muted-foreground mb-1 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase"
          >
            <UiCircle class="fill-brand text-brand h-1 w-1" />
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
              'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-all duration-150',
              isActive
                ? 'bg-brand/10 text-brand shadow-sm'
                : 'text-foreground hover:bg-muted/50 hover:text-brand'
            ]"
            @click="navigate"
          >
            <component
              :is="getRouteIcon(route.meta?.icon)"
              :size="16"
              :class="isActive ? 'text-brand' : 'text-muted-foreground'"
            />
            <span>{{ routeTranslations[route.name as RouteNameConstants]() }}</span>
          </button>
        </RouterLink>
      </div>
    </ScrollArea>

    <!-- Footer with search hint -->
    <div class="border-border/30 border-t p-2">
      <Button
        variant="ghost"
        size="sm"
        class="text-muted-foreground hover:text-foreground w-full justify-start gap-2 text-xs"
        @click="emit('openSearch')"
      >
        <UiSearch :size="14" />
        <span class="flex-1 text-left">{{ m.search_settings() }}</span>
        <KeyboardShortcut :keys="['K']" class="hidden sm:flex" />
      </Button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { Button, ScrollArea } from '@cq/ui'

import KeyboardShortcut from '@/components/KeyboardShortcut.vue'
import { routeIcons, UiCircle, UiSearch } from '@/composables/icons'
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
