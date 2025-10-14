<script setup lang="ts">
import { computed } from 'vue'

import { Slider } from './ui/slider'

interface Props {
  modelValue?: number
  min?: number
  max?: number
  step?: number
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: 0,
  min: 0,
  max: 100,
  step: 1
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const internalValue = computed({
  get: () => [(props.modelValue ?? props.min) as number],
  set: (val) => emit('update:modelValue', val[0] ?? props.min)
})
</script>

<template>
  <Slider
    v-model="internalValue"
    :min="props.min as number"
    :max="props.max as number"
    :step="props.step as number"
    :class="props.class"
  />
</template>
