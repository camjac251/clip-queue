<script setup lang="ts">
import { cn } from '../../../lib/utils'

defineProps<{
  class?: string
}>()
</script>

<template>
  <div :class="cn('bg-muted animate-pulse rounded-md motion-reduce:animate-none', $props.class)" />
</template>
