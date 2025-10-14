<template>
  <CommandDialog v-model:open="isOpen">
    <Command>
      <CommandInput :placeholder="m.search_settings_placeholder()" />
      <CommandList>
        <CommandEmpty>{{ m.no_results_found() }}</CommandEmpty>

        <!-- General Settings -->
        <CommandGroup :heading="m.general()">
          <CommandItem
            v-for="route in generalRoutes"
            :key="route.name"
            :value="String(route.name ?? '')"
            @select="navigateToSetting(route.name)"
          >
            <component :is="getRouteIcon(route.meta?.icon)" class="mr-2" :size="16" />
            <span>{{ routeTranslations[route.name as RouteNameConstants]() }}</span>
          </CommandItem>
        </CommandGroup>

        <!-- System Settings -->
        <CommandGroup :heading="m.system()">
          <CommandItem
            v-for="route in systemRoutes"
            :key="route.name"
            :value="String(route.name ?? '')"
            @select="navigateToSetting(route.name)"
          >
            <component :is="getRouteIcon(route.meta?.icon)" class="mr-2" :size="16" />
            <span>{{ routeTranslations[route.name as RouteNameConstants]() }}</span>
          </CommandItem>
        </CommandGroup>

        <!-- Information -->
        <CommandGroup :heading="m.information()">
          <CommandItem
            v-for="route in infoRoutes"
            :key="route.name"
            :value="String(route.name ?? '')"
            @select="navigateToSetting(route.name)"
          >
            <component :is="getRouteIcon(route.meta?.icon)" class="mr-2" :size="16" />
            <span>{{ routeTranslations[route.name as RouteNameConstants]() }}</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </CommandDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@cq/ui'

import { routeIcons } from '@/composables/icons'
import * as m from '@/paraglide/messages'
import { allowedRoutes, RouteNameConstants, routeTranslations } from '@/router'

interface Props {
  open: boolean
}

interface Emits {
  (e: 'update:open', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const router = useRouter()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const settingsRoutes = computed(
  () => allowedRoutes.value.find((r) => r.name === RouteNameConstants.SETTINGS)?.children ?? []
)

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

function navigateToSetting(name: string | symbol | undefined) {
  if (name) {
    router.push({ name })
    isOpen.value = false
  }
}
</script>
