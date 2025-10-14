<script setup lang="ts">
import { cn } from '../lib/utils'

interface Props {
  severity?: 'success' | 'info' | 'warn' | 'error' | 'secondary'
  size?: 'sm' | 'md'
  variant?: 'simple' | 'default'
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  severity: 'info',
  size: 'md',
  variant: 'default'
})

const severityClasses = {
  success:
    'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300',
  info: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300',
  warn: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300',
  error:
    'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300',
  secondary:
    'bg-zinc-50 dark:bg-zinc-900/20 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
}

const sizeClasses = {
  sm: 'p-2 text-xs',
  md: 'p-4 text-sm'
}

const variantClasses = {
  simple: 'bg-transparent border-none',
  default: ''
}
</script>

<template>
  <div
    :class="
      cn(
        'rounded-lg border',
        sizeClasses[props.size],
        variantClasses[props.variant],
        props.variant === 'default' ? severityClasses[props.severity] : '',
        props.class
      )
    "
  >
    <slot />
  </div>
</template>
