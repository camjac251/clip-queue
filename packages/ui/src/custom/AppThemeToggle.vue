<template>
  <Button
    :icon="isDarkMode ? 'pi pi-sun' : 'pi pi-moon'"
    size="small"
    text
    rounded
    aria-label="Theme"
    @click="() => emit('toggle')"
  ></Button>
</template>

<script setup lang="ts">
import { toRefs } from 'vue'

import Button from '../volt/Button.vue'

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
