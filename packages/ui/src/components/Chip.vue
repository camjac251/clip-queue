<script setup lang="ts">
import { IconX } from '@cq/ui'

import { Badge } from './ui/badge'
import { Button } from './ui/button'

interface Props {
  removable?: boolean
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  removable: false,
  variant: 'secondary'
})

const emit = defineEmits<{
  remove: []
}>()
</script>

<template>
  <Badge :variant="props.variant" :class="props.class">
    <slot />
    <Button
      v-if="props.removable"
      variant="ghost"
      size="icon"
      class="ml-1 h-4 w-4 p-0 hover:bg-transparent"
      @click="emit('remove')"
    >
      <IconX class="h-3 w-3" />
    </Button>
  </Badge>
</template>
