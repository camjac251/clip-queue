<script setup lang="ts">
import { Input } from './ui/input'

interface Props {
  modelValue?: number | null
  placeholder?: string
  disabled?: boolean
  min?: number
  max?: number
  class?: string
  inputId?: string
  allowEmpty?: boolean
  locale?: string
  step?: number
  showButtons?: boolean
  required?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

function handleInput(value: string | number) {
  if (props.allowEmpty && (value === '' || value === null)) {
    emit('update:modelValue', null)
    return
  }
  const num = typeof value === 'number' ? value : parseFloat(value)
  if (!isNaN(num)) {
    emit('update:modelValue', num)
  }
}
</script>

<template>
  <Input
    :id="props.inputId"
    type="number"
    :model-value="props.modelValue ?? undefined"
    :placeholder="props.placeholder"
    :disabled="props.disabled"
    :min="props.min"
    :max="props.max"
    :step="props.step"
    :class="props.class"
    :required="props.required"
    @update:model-value="handleInput"
  />
</template>
