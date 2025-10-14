<template>
  <CommandDialog v-model:open="isOpen" @update:search-query="handleSearchQuery">
    <Command :filter-function="() => 1">
      <CommandInput :placeholder="m.search_settings_placeholder()" />
      <CommandList>
        <CommandEmpty>{{ m.no_results_found() }}</CommandEmpty>

        <!-- Dynamic grouped results -->
        <CommandGroup
          v-for="(items, category) in groupedResults"
          :key="category"
          :heading="category"
        >
          <CommandItem
            v-for="result in items"
            :key="result.id"
            :value="result.id"
            @select="navigateToResult(result)"
          >
            <component
              :is="getResultIcon(result)"
              class="text-muted-foreground mr-2 shrink-0"
              :size="16"
            />
            <div class="flex flex-1 flex-col gap-0.5 overflow-hidden">
              <div class="flex items-center gap-2">
                <span class="truncate text-sm font-medium">{{ result.title }}</span>
                <ResultValueBadge v-if="result.type === 'setting'" :result="result" />
              </div>
              <span v-if="result.description" class="text-muted-foreground truncate text-xs">
                {{ result.description }}
              </span>
            </div>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </CommandDialog>
</template>

<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { useRouter } from 'vue-router'

import {
  Badge,
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@cq/ui'

import type { SearchResult } from '@/composables/settings-search'
import { routeIcons, StatusCheck, UiChevronDown, UiCircle } from '@/composables/icons'
import { useSettingsSearchIndex } from '@/composables/settings-search'
import * as m from '@/paraglide/messages'

interface Props {
  open: boolean
}

interface Emits {
  (e: 'update:open', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const router = useRouter()

const searchQuery = ref('')
const { filterResults, groupResults } = useSettingsSearchIndex()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const filteredResults = computed(() => {
  return filterResults(searchQuery.value)
})

const groupedResults = computed(() => {
  return groupResults(filteredResults.value)
})

function handleSearchQuery(query: string) {
  searchQuery.value = query
}

function getResultIcon(result: SearchResult) {
  // Page results use route icons
  if (result.type === 'page' && result.icon) {
    return routeIcons[result.icon as keyof typeof routeIcons] || UiCircle
  }

  // Setting results use type-specific icons
  switch (result.settingType) {
    case 'toggle':
      return StatusCheck
    case 'text':
    case 'number':
      return UiCircle
    case 'select':
    case 'multiselect':
      return UiChevronDown
    case 'checkboxlist':
      return StatusCheck
    default:
      return UiCircle
  }
}

const ResultValueBadge = (props: { result: SearchResult }) => {
  const { result } = props
  const valueStr = formatValue(result.value)

  if (!valueStr) return null

  return h(
    Badge,
    {
      variant: 'secondary',
      class: 'shrink-0 text-xs font-mono'
    },
    () => valueStr
  )
}

function formatValue(value: SearchResult['value']): string {
  if (value === undefined || value === null) return ''

  if (typeof value === 'boolean') {
    return value ? m.enabled() : m.disabled()
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : m.none()
  }

  return String(value)
}

function navigateToResult(result: SearchResult) {
  router.push({ name: result.route })
  isOpen.value = false
}
</script>
