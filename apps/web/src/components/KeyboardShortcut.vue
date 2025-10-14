<template>
  <div class="flex items-center gap-0.5">
    <kbd
      class="border-border bg-muted flex h-5 min-w-5 items-center justify-center rounded border px-1 font-mono text-[10px] font-medium shadow-sm"
    >
      <UiKeyboardCommand v-if="isMac" :size="13" class="text-muted-foreground" />
      <span v-else class="text-muted-foreground">Ctrl</span>
    </kbd>
    <kbd
      v-for="key in keys"
      :key="key"
      class="border-border bg-muted flex h-5 min-w-5 items-center justify-center rounded border px-1 font-mono text-[10px] font-medium shadow-sm"
    >
      <span class="text-muted-foreground">{{ key }}</span>
    </kbd>
  </div>
</template>

<script setup lang="ts">
import { UiKeyboardCommand } from '@/composables/icons'
import { usePlatform } from '@/composables/platform'

interface Props {
  keys: string[]
}

defineProps<Props>()

const { isMac } = usePlatform()
</script>
