<!-- eslint-disable -->
<script setup lang="ts" generic="T">
import { computed, ref } from 'vue'

import { IconCheck, IconChevronsUpDown } from '@cq/ui'

import { cn } from '../lib/utils'
import { Button } from './ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from './ui/command'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

function handleDataKey(item: any, dataKey?: string): any {
  return dataKey ? item?.[dataKey] : item
}

const props = defineProps<{
  modelValue?: T[]
  options?: T[]
  placeholder?: string
  inputId?: string
  optionLabel?: string | ((option: T) => string)
  dataKey?: string
}>()
const emit = defineEmits<{
  'update:modelValue': [value: T[]]
}>()

const open = ref(false)

const selected = computed({
  get: () => props.modelValue || [],
  set: (val) => emit('update:modelValue', val)
})

function getLabel(option: T): string {
  if (!option) return ''
  if (typeof props.optionLabel === 'function') {
    return props.optionLabel(option)
  }
  if (typeof props.optionLabel === 'string') {
    return String((option as any)[props.optionLabel])
  }
  return String(option)
}

function isSelected(option: T): boolean {
  if (props.dataKey && option) {
    const dataKey = props.dataKey as keyof T
    return selected.value.some((item) => item?.[dataKey] === option?.[dataKey])
  }
  return selected.value.includes(option)
}

function toggleSelection(option: T) {
  const current = [...selected.value]
  if (isSelected(option)) {
    if (props.dataKey && option) {
      const dataKey = props.dataKey as keyof T
      selected.value = current.filter((item) => item?.[dataKey] !== option?.[dataKey])
    } else {
      selected.value = current.filter((item) => item !== option)
    }
  } else {
    selected.value = [...current, option]
  }
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        :id="props.inputId"
        variant="outline"
        role="combobox"
        :aria-expanded="open"
        class="w-full justify-between"
      >
        <span v-if="selected.length === 0" class="text-muted-foreground">
          {{ props.placeholder || 'Select...' }}
        </span>
        <span v-else> {{ selected.length }} selected </span>
        <IconChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-full p-0">
      <Command>
        <CommandInput placeholder="Search..." />
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandList>
          <CommandGroup>
            <CommandItem
              v-for="(option, index) in props.options"
              :key="index"
              :value="getLabel(option)"
              @select="toggleSelection(option)"
            >
              <IconCheck
                :class="cn('mr-2 h-4 w-4', isSelected(option) ? 'opacity-100' : 'opacity-0')"
              />
              <slot name="option" :option="option">
                {{ getLabel(option) }}
              </slot>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>

  <!-- Selected chips display -->
  <div v-if="selected.length > 0" class="mt-2 flex flex-wrap gap-2">
    <slot v-for="(item, index) in selected" :key="index" name="chip" :value="item">
      <span class="bg-muted inline-flex items-center rounded-md px-2 py-1 text-xs">
        {{ getLabel(item) }}
      </span>
    </slot>
  </div>
</template>
