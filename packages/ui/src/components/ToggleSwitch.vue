<script setup lang="ts">
import { Switch } from './ui/switch'

interface Props {
  modelValue?: boolean
  inputId?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <Switch
    :id="props.inputId"
    :checked="props.modelValue"
    @update:checked="emit('update:modelValue', $event)"
  />
</template>
