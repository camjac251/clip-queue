<template>
  <i v-tooltip="statusTranslations[status]()" :class="`pi pi-circle-fill ${color}`" />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import * as m from '@/paraglide/messages'
import { WebSocketStatus } from '@/stores/websocket'

export interface Props {
  status: WebSocketStatus
}

const { status } = defineProps<Props>()

const statusTranslations: Record<WebSocketStatus, () => string> = {
  [WebSocketStatus.ERROR]: m.error,
  [WebSocketStatus.CONNECTED]: m.connected,
  [WebSocketStatus.DISCONNECTED]: m.disconnected,
  [WebSocketStatus.CONNECTING]: m.unknown
}

const color = computed(() => {
  switch (status) {
    case WebSocketStatus.ERROR:
    case WebSocketStatus.DISCONNECTED:
      return 'text-red-600 dark:text-red-500'
    case WebSocketStatus.CONNECTED:
      return 'text-green-600 dark:text-green-500'
    case WebSocketStatus.CONNECTING:
    default:
      return 'text-yellow-600 dark:text-yellow-500'
  }
})
</script>
