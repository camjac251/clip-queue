<template>
  <div class="space-y-4">
    <!-- Page Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1
          class="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl dark:from-violet-400 dark:to-purple-400"
        >
          {{ m.history() }}
        </h1>
        <p class="text-muted-foreground mt-1 text-sm">View and manage previously watched clips</p>
      </div>
    </div>

    <!-- Action Bar -->
    <div
      v-if="user.canControlQueue"
      class="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 shadow-sm"
    >
      <div class="relative min-w-[200px] flex-1">
        <UiSearch
          :size="16"
          class="text-muted-foreground absolute start-3 top-1/2 z-1 -mt-2 leading-none"
        />
        <Input v-model="searchQuery" :placeholder="m.search()" class="pl-10" />
      </div>
      <div class="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          :disabled="isQueueClipsDisabled"
          @click="queueClips()"
        >
          {{ m.queue() }}
        </Button>
        <Button variant="secondary" size="sm" :disabled="!selection.length" @click="replayClips()">
          {{ m.play() }}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          :disabled="!selection.length"
          @click="deleteClips()"
        >
          {{ m.delete_label() }}
        </Button>
      </div>
    </div>

    <!-- Search for non-mod users -->
    <div v-else class="relative">
      <UiSearch
        :size="16"
        class="text-muted-foreground absolute start-3 top-1/2 z-1 -mt-2 leading-none"
      />
      <Input v-model="searchQuery" :placeholder="m.search()" class="pl-10" />
    </div>

    <!-- Data Table Card -->
    <Card class="overflow-hidden">
      <DataTable
        :data="filteredClips"
        :columns="columns"
        paginator
        :rows="10"
        :rows-per-page-options="[10, 20, 50]"
      >
        <template #empty>
          <div class="text-muted-foreground flex flex-col items-center justify-center py-12">
            <NavHistory :size="48" class="mb-4 opacity-50" />
            <p class="text-lg font-medium">{{ m.no_clips_previously_watched() }}</p>
            <p class="text-sm">Clips you've watched will appear here</p>
          </div>
        </template>
      </DataTable>
    </Card>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import { computed, h, ref } from 'vue'

import type { Clip } from '@cq/platforms'
import { toClipUUID } from '@cq/platforms'
import { Button, Card, Checkbox, DataTable, Input, useConfirm } from '@cq/ui'

import PlatformName from '@/components/PlatformName.vue'
import { ActionExternalLink, NavHistory, UiSearch } from '@/composables/icons'
import { useToastNotifications } from '@/composables/toast'
import * as m from '@/paraglide/messages'
import { useLogger } from '@/stores/logger'
import { useQueueServer as useQueue } from '@/stores/queue-server'
import { useUser } from '@/stores/user'

const confirm = useConfirm()
const { batchResult } = useToastNotifications()
const queue = useQueue()
const logger = useLogger()
const user = useUser()

const searchQuery = ref('')
const selection = ref<Clip[]>([])

const filteredClips = computed(() => {
  const clips = queue.history.toArray()
  if (!searchQuery.value) return clips

  const query = searchQuery.value.toLowerCase()
  return clips.filter(
    (clip) =>
      clip.title.toLowerCase().includes(query) ||
      clip.channel.toLowerCase().includes(query) ||
      clip.creator?.toLowerCase().includes(query) ||
      clip.category?.toLowerCase().includes(query) ||
      clip.platform.toLowerCase().includes(query) ||
      clip.submitters.some((s) => s.toLowerCase().includes(query))
  )
})

const isQueueClipsDisabled = computed(() => {
  return selection.value.length === 0 || selection.value.every((c) => queue.upcoming.includes(c))
})

const columns = computed<ColumnDef<Clip>[]>(() => [
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
    accessorKey: 'title',
    header: m.info(),
    cell: ({ row }) => {
      const clip = row.original
      return h('div', { class: 'flex items-center' }, [
        h('img', {
          class: 'hidden aspect-video w-24 rounded-lg sm:block',
          src: clip.thumbnailUrl,
          alt: clip.title
        }),
        h('div', { class: 'text-left text-sm sm:ml-3' }, [
          h('p', { class: 'font-normal' }, [
            clip.title,
            clip.url &&
              h('span', [
                h(
                  'a',
                  {
                    href: clip.url,
                    target: '_blank',
                    rel: 'noreferrer',
                    class: 'text-muted-foreground hover:text-foreground no-underline ml-2'
                  },
                  [h(ActionExternalLink, { size: 16 })]
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
    accessorKey: 'platform',
    header: m.platform(),
    cell: ({ row }) => h(PlatformName, { platform: row.original.platform })
  },
  {
    accessorKey: 'creator',
    header: m.creator(),
    cell: ({ row }) => row.original.creator ?? m.unknown()
  },
  {
    accessorKey: 'submitters',
    header: m.submitter(),
    cell: ({ row }) => row.original.submitters[0] ?? ''
  }
])

async function queueClips() {
  const clips = selection.value
  selection.value = []
  logger.debug(`[History]: queuing ${clips.length} clip(s).`)
  for (const clip of clips) {
    try {
      await queue.submit(clip.url, clip.submitters[0] || 'unknown')
    } catch (error) {
      logger.error(`[History]: Failed to queue clip: ${error}`)
    }
  }
}

async function replayClips() {
  const clips = [...selection.value]
  logger.debug(`[History]: replaying ${clips.length} clip(s).`)

  const results = { succeeded: 0, failed: 0 }

  for (const clip of clips) {
    try {
      await queue.replayFromHistory(toClipUUID(clip))
      results.succeeded++
      logger.debug(`[History]: Replayed clip: ${clip.title}`)
    } catch (error) {
      results.failed++
      logger.error(`[History]: Failed to replay clip ${clip.title}: ${error}`)
    }
  }

  if (results.succeeded > 0) {
    selection.value = []
  }

  batchResult(results.succeeded, results.failed, 'Replayed from history')
}

function deleteClips() {
  const clips = [...selection.value]
  logger.debug(`[History]: attempting to delete ${clips.length} clip(s).`)
  confirm.require({
    header: m.delete_history(),
    message: m.delete_history_confirm({ length: clips.length }),
    rejectProps: {
      label: m.cancel()
    },
    acceptProps: {
      label: m.confirm()
    },
    accept: async () => {
      const results = { succeeded: 0, failed: 0 }

      for (const clip of clips) {
        try {
          await queue.removeFromHistory(toClipUUID(clip))
          results.succeeded++
          logger.debug(`[History]: Deleted clip: ${clip.title}`)
        } catch (error) {
          results.failed++
          logger.error(`[History]: Failed to delete clip ${clip.title}: ${error}`)
        }
      }

      if (results.succeeded > 0) {
        selection.value = []
      }

      batchResult(results.succeeded, results.failed, 'Deleted from history')
    },
    reject: () => {
      logger.debug(`[History]: deletion of ${clips.length} clip(s) was cancelled.`)
    }
  })
}
</script>
