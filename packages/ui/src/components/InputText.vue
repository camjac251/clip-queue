<script setup lang="ts">
import { Input } from './ui/input'

interface Props {
  modelValue?: string | number
  placeholder?: string
  disabled?: boolean
  type?: string
  class?: string
  required?: boolean
  maxlength?: number
  inputId?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()
</script>

<template>
  <Input
    :id="props.inputId"
    :model-value="props.modelValue"
    :placeholder="props.placeholder"
    :disabled="props.disabled"
    :type="props.type"
    :class="props.class"
    :required="props.required"
    :maxlength="props.maxlength"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
