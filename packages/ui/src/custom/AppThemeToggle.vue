<template>
  <Button variant="ghost" size="sm" class="gap-2" aria-label="Theme" @click="() => emit('toggle')">
    <IconSun v-if="isDarkMode" :size="18" />
    <IconMoon v-else :size="18" />
  </Button>
</template>

<script setup lang="ts">
import { toRefs } from 'vue'

import { IconMoon, IconSun } from '@cq/ui'

import { Button } from '../components/ui/button'

export interface Props {
  isDarkMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isDarkMode: false
})
const { isDarkMode } = toRefs(props)

const emit = defineEmits<{
  (e: 'toggle'): void
}>()
</script>
