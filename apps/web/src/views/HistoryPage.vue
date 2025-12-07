<template>
  <div class="bg-background flex h-dvh flex-col overflow-hidden">
    <!-- Header Bar - Glassmorphism -->
    <div
      class="border-border/50 bg-card/80 flex flex-shrink-0 items-center justify-between gap-3 border-b px-3 py-2 backdrop-blur-sm"
    >
      <div class="flex items-center gap-2">
        <div class="bg-brand/10 flex h-8 w-8 items-center justify-center rounded-lg">
          <NavHistory class="text-brand h-4 w-4" />
        </div>
        <div>
          <h1 class="text-foreground text-sm font-semibold">{{ m.history() }}</h1>
          <p class="text-muted-foreground text-xs">
            {{ history.entries.value.length }} clips watched
          </p>
        </div>
      </div>

      <!-- Search and Actions -->
      <div class="flex items-center gap-2">
        <div class="relative">
          <UiSearch
            :size="14"
            class="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2"
          />
          <Input
            v-model="searchQuery"
            :placeholder="m.search()"
            class="h-8 w-40 pl-8 text-xs sm:w-56"
          />
        </div>

        <div v-if="user.canControlQueue" class="flex gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            class="h-8 gap-1.5 px-2.5 text-xs"
            :disabled="isQueueClipsDisabled"
            @click="queueClips()"
          >
            <ActionPlay class="h-3.5 w-3.5" />
            <span class="hidden sm:inline">{{ m.queue() }}</span>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            class="h-8 gap-1.5 px-2.5 text-xs"
            :disabled="!selection.length"
            @click="deleteClips()"
          >
            <ActionTrash class="h-3.5 w-3.5" />
            <span class="hidden sm:inline">{{ m.delete_label() }}</span>
          </Button>
        </div>
      </div>
    </div>

    <!-- Table Container - Takes remaining space -->
    <div class="relative min-h-0 flex-1 overflow-hidden">
      <div class="absolute inset-0 overflow-auto">
        <DataTable
          ref="dataTableRef"
          :data="filteredClips"
          :columns="columns"
          paginator
          :rows="20"
          :rows-per-page-options="[20, 50, 100]"
          class="[&_.p-datatable-wrapper]:border-border/50 [&_.p-datatable-wrapper]:bg-card/50 [&_.p-datatable-wrapper]:rounded-none [&_.p-datatable-wrapper]:border-0"
        >
          <template #empty>
            <div class="flex flex-col items-center justify-center py-16">
              <div class="bg-brand/10 mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                <NavHistory class="text-brand h-8 w-8" />
              </div>
              <p class="text-foreground mb-1 text-base font-semibold">
                {{ m.no_clips_previously_watched() }}
              </p>
              <p class="text-muted-foreground max-w-xs text-center text-sm">
                Clips you've watched will appear here for easy reference
              </p>
            </div>
          </template>
        </DataTable>

        <!-- Infinite scroll trigger -->
        <div ref="loadMoreTrigger" class="h-1" />

        <!-- Loading indicator -->
        <div
          v-if="history.loading.value"
          class="text-muted-foreground border-border/30 border-t py-3 text-center text-xs"
        >
          Loading more history...
        </div>

        <!-- Error message -->
        <div v-if="history.error.value" class="text-destructive py-3 text-center text-xs">
          {{ history.error.value }}
        </div>
      </div>
    </div>

    <!-- Status Bar - Compact footer -->
    <div
      class="border-border/50 bg-card/50 flex flex-shrink-0 items-center justify-between px-3 py-1.5 text-xs backdrop-blur-sm"
      :class="selection.length > 0 ? 'border-t' : 'border-t'"
    >
      <div class="text-muted-foreground flex items-center gap-1">
        <span class="font-semibold tabular-nums">{{ filteredClips.length }}</span>
        <span>{{ filteredClips.length === 1 ? 'clip' : 'clips' }}</span>
        <template v-if="searchQuery">
          <span class="text-border mx-1">|</span>
          <span>filtered from {{ history.entries.value.length }}</span>
        </template>
      </div>
      <div v-if="selection.length > 0" class="text-brand flex items-center gap-1 font-medium">
        <UiCheck class="h-3.5 w-3.5" />
        <span class="tabular-nums">{{ selection.length }}</span>
        <span>selected</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, Table } from '@tanstack/vue-table'
import { useIntersectionObserver } from '@vueuse/core'
import { computed, h, onMounted, ref } from 'vue'

import { toClipUUID } from '@cq/platforms'
import { Button, Checkbox, DataTable, Input, useConfirm } from '@cq/ui'

import type { PlayLogEntry } from '@/composables/use-history'
import PlatformName from '@/components/PlatformName.vue'
import {
  ActionExternalLink,
  ActionPlay,
  ActionTrash,
  NavHistory,
  UiCheck,
  UiSearch
} from '@/composables/icons'
import { useToastNotifications } from '@/composables/toast'
import { useHistory } from '@/composables/use-history'
import * as m from '@/paraglide/messages'
import { useLogger } from '@/stores/logger'
import { useQueueServer as useQueue } from '@/stores/queue-server'
import { useUser } from '@/stores/user'

interface DataTableExposed<T> {
  table: Table<T>
  selectedRows: T[]
}

const confirm = useConfirm()
const { batchResult } = useToastNotifications()
const queue = useQueue()
const logger = useLogger()
const user = useUser()
const history = useHistory(50)

const searchQuery = ref('')
const dataTableRef = ref<DataTableExposed<PlayLogEntry> | null>(null)
const loadMoreTrigger = ref<HTMLElement | null>(null)

const selection = computed<PlayLogEntry[]>(() => {
  return (dataTableRef.value?.selectedRows ?? []) as PlayLogEntry[]
})

onMounted(() => {
  history.loadMore()
})

useIntersectionObserver(loadMoreTrigger, (entries) => {
  const entry = entries[0]
  if (entry?.isIntersecting && history.hasMore.value && !history.loading.value) {
    history.loadMore()
  }
})

const filteredClips = computed(() => {
  const entries = history.entries.value
  if (!searchQuery.value) return entries

  const query = searchQuery.value.toLowerCase()
  return entries.filter(
    (entry) =>
      entry.clip.title.toLowerCase().includes(query) ||
      entry.clip.channel.toLowerCase().includes(query) ||
      entry.clip.creator?.toLowerCase().includes(query) ||
      entry.clip.category?.toLowerCase().includes(query) ||
      entry.clip.platform.toLowerCase().includes(query) ||
      entry.clip.submitters.some((s: string) => s.toLowerCase().includes(query))
  )
})

const isQueueClipsDisabled = computed(() => {
  return (
    selection.value.length === 0 ||
    selection.value.every((entry) => queue.upcoming.includes(entry.clip))
  )
})

const columns = computed<ColumnDef<PlayLogEntry>[]>(() => [
  {
    id: 'select',
    header: ({ table }) =>
      h(Checkbox, {
        checked: table.getIsAllPageRowsSelected(),
        'onUpdate:checked': (value: boolean) => table.toggleAllPageRowsSelected(!!value)
      }),
    cell: ({ row }) =>
      h(Checkbox, {
        checked: row.getIsSelected(),
        'onUpdate:checked': (value: boolean) => row.toggleSelected(!!value)
      }),
    enableSorting: false
  },
  {
    accessorKey: 'clip.title',
    header: m.info(),
    cell: ({ row }) => {
      const clip = row.original.clip
      return h('div', { class: 'flex items-center' }, [
        h('img', {
          class: 'hidden aspect-video w-20 rounded sm:block',
          src: clip.thumbnailUrl,
          alt: clip.title
        }),
        h('div', { class: 'text-left text-sm sm:ml-3' }, [
          h('p', { class: 'font-medium text-foreground line-clamp-1' }, [
            clip.title,
            clip.url &&
              h('span', [
                h(
                  'a',
                  {
                    href: clip.url,
                    target: '_blank',
                    rel: 'noreferrer',
                    class: 'text-muted-foreground hover:text-brand ml-1.5 inline-flex'
                  },
                  [h(ActionExternalLink, { size: 14 })]
                )
              ])
          ]),
          h('div', { class: 'text-muted-foreground text-xs' }, [
            clip.category ? h('p', `${clip.channel} - ${clip.category}`) : h('p', clip.channel)
          ])
        ])
      ])
    }
  },
  {
    accessorKey: 'clip.platform',
    header: m.platform(),
    cell: ({ row }) => h(PlatformName, { platform: row.original.clip.platform, size: 'small' })
  },
  {
    accessorKey: 'clip.creator',
    header: m.creator(),
    cell: ({ row }) =>
      h(
        'span',
        { class: 'text-sm' },
        row.original.clip.creator ?? h('span', { class: 'text-muted-foreground' }, m.unknown())
      )
  },
  {
    accessorKey: 'clip.submitters',
    header: m.submitter(),
    cell: ({ row }) =>
      h(
        'span',
        { class: row.original.clip.submitters[0] ? 'text-brand text-sm font-medium' : 'text-sm' },
        row.original.clip.submitters[0] ?? ''
      )
  }
])

async function queueClips() {
  const entries = [...selection.value]
  dataTableRef.value?.table.resetRowSelection()
  logger.debug(`[History]: queuing ${entries.length} clip(s).`)
  for (const entry of entries) {
    try {
      await queue.submit(entry.clip.url, entry.clip.submitters[0] || 'unknown')
    } catch (error) {
      logger.error(`[History]: Failed to queue clip: ${error}`)
    }
  }
}

function deleteClips() {
  const entries = [...selection.value]
  logger.debug(`[History]: attempting to delete ${entries.length} clip(s).`)
  confirm.require({
    header: m.delete_history(),
    message: m.delete_history_confirm({ length: entries.length }),
    rejectProps: {
      label: m.cancel()
    },
    acceptProps: {
      label: m.confirm()
    },
    accept: async () => {
      const results = { succeeded: 0, failed: 0 }

      for (const entry of entries) {
        try {
          await queue.removeFromHistory(toClipUUID(entry.clip))
          results.succeeded++
          logger.debug(`[History]: Deleted clip: ${entry.clip.title}`)
        } catch (error) {
          results.failed++
          logger.error(`[History]: Failed to delete clip ${entry.clip.title}: ${error}`)
        }
      }

      if (results.succeeded > 0) {
        dataTableRef.value?.table.resetRowSelection()
        history.reset()
        history.loadMore()
      }

      batchResult(results.succeeded, results.failed, 'Deleted from history')
    },
    reject: () => {
      logger.debug(`[History]: deletion of ${entries.length} clip(s) was cancelled.`)
    }
  })
}
</script>
