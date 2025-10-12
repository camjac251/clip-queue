<template>
  <div v-if="user.canControlQueue" class="flex flex-row-reverse gap-2">
    <DangerButton
      icon="pi pi-trash"
      :label="m.delete_label()"
      :disabled="!selection.length"
      severity="danger"
      size="small"
      @click="deleteClips()"
    ></DangerButton>
    <SecondaryButton
      icon="pi pi-history"
      :label="m.play()"
      :disabled="!selection.length"
      severity="secondary"
      size="small"
      @click="replayClips()"
    ></SecondaryButton>
    <SecondaryButton
      icon="pi pi-plus"
      :label="m.queue()"
      :disabled="isQueueClipsDisabled"
      severity="info"
      size="small"
      @click="queueClips()"
    ></SecondaryButton>
  </div>
  <DataTable
    v-model:selection="selection"
    v-model:filters="filters"
    :global-filter-fields="['category', 'channel', 'platform', 'submitters', 'title']"
    :value="queue.history.toArray()"
    size="small"
    paginator
    removable-sort
    :rows="10"
    :rows-per-page-options="[10, 20, 50]"
    class="my-2"
  >
    <template #empty>
      <div class="text-surface-500 p-4">
        {{ m.no_clips_previously_watched() }}
      </div>
    </template>
    <template #header>
      <div class="mb-2 flex items-center justify-between">
        <span class="text-xl">{{ m.history() }}</span>
        <div class="relative">
          <i
            class="pi pi-search text-surface-400 absolute start-3 top-1/2 z-1 -mt-2 leading-none"
          />
          <InputText v-model="filters['global'].value" :placeholder="m.search()" pt:root="ps-10" />
        </div>
      </div>
    </template>
    <Column selection-mode="multiple" header-style="width: 3rem"></Column>
    <Column field="title" :header="m.info()" sortable :sort-field="(data: Clip) => data.title">
      <template #body="{ data }: { data: Clip }">
        <div class="flex items-center">
          <img
            class="hidden aspect-video w-24 rounded-lg sm:block"
            :src="data.thumbnailUrl"
            :alt="data.title"
          />
          <div class="text-left text-sm sm:ml-3">
            <p class="font-normal">
              {{ data.title }}
              <span v-if="data.url">
                <a
                  :href="data.url"
                  target="_blank"
                  rel="noreferrer"
                  class="text-surface-400 hover:text-surface-600 dark:text-surface-600 dark:hover:text-surface-200 no-underline"
                >
                  <i class="pi pi-external-link"></i>
                </a>
              </span>
            </p>
            <div class="text-surface-400 text-xs">
              <p v-if="data.category">{{ data.channel }} - {{ data.category }}</p>
              <p v-else>
                {{ data.channel }}
              </p>
            </div>
          </div>
        </div>
      </template>
    </Column>
    <Column field="platform" sortable :header="m.platform()">
      <template #body="{ data }: { data: Clip }">
        <PlatformName :platform="data.platform" />
      </template>
    </Column>
    <Column
      :field="(data: Clip) => data.creator ?? m.unknown()"
      sortable
      :sort-field="(data: Clip) => data.creator"
      :header="m.creator()"
    >
    </Column>
    <Column
      :field="(data: Clip) => data.submitters[0] ?? ''"
      sortable
      :sort-field="(data: Clip) => data.submitters[0] ?? ''"
      :header="m.submitter()"
    >
    </Column>
  </DataTable>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Clip } from '@cq/platforms'
import { toClipUUID } from '@cq/platforms'
import {
  Column,
  DangerButton,
  DataTable,
  InputText,
  SecondaryButton,
  useConfirm,
  useToast
} from '@cq/ui'

import PlatformName from '@/components/PlatformName.vue'
import * as m from '@/paraglide/messages'
import { useLogger } from '@/stores/logger'
import { useQueueServer as useQueue } from '@/stores/queue-server'
import { useUser } from '@/stores/user'

const filters = ref({
  global: { value: null, matchMode: 'contains' }
})

const confirm = useConfirm()
const toast = useToast()
const queue = useQueue()
const logger = useLogger()
const user = useUser()

const selection = ref<Clip[]>([])

const isQueueClipsDisabled = computed(() => {
  return selection.value.length === 0 || selection.value.every((c) => queue.upcoming.includes(c))
})

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

  // Clear selection on success
  if (results.succeeded > 0) {
    selection.value = []
  }

  // Show appropriate toast based on results
  if (results.failed === 0) {
    toast.add({
      severity: 'success',
      summary: m.success(),
      detail: `Replayed ${results.succeeded} clip${results.succeeded === 1 ? '' : 's'} from history`,
      life: 3000
    })
  } else if (results.succeeded === 0) {
    toast.add({
      severity: 'error',
      summary: m.error(),
      detail: `Failed to replay ${results.failed} clip${results.failed === 1 ? '' : 's'}`,
      life: 3000
    })
  } else {
    toast.add({
      severity: 'warning',
      summary: m.warning(),
      detail: `Replayed ${results.succeeded} clip${results.succeeded === 1 ? '' : 's'}, ${results.failed} failed`,
      life: 3000
    })
  }
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

      // Clear selection on success
      if (results.succeeded > 0) {
        selection.value = []
      }

      // Show appropriate toast based on results
      if (results.failed === 0) {
        toast.add({
          severity: 'success',
          summary: m.success(),
          detail: `Deleted ${results.succeeded} clip${results.succeeded === 1 ? '' : 's'} from history`,
          life: 3000
        })
      } else if (results.succeeded === 0) {
        toast.add({
          severity: 'error',
          summary: m.error(),
          detail: `Failed to delete ${results.failed} clip${results.failed === 1 ? '' : 's'}`,
          life: 3000
        })
      } else {
        toast.add({
          severity: 'warning',
          summary: m.warning(),
          detail: `Deleted ${results.succeeded} clip${results.succeeded === 1 ? '' : 's'}, ${results.failed} failed`,
          life: 3000
        })
      }
    },
    reject: () => {
      logger.debug(`[History]: deletion of ${clips.length} clip(s) was cancelled.`)
    }
  })
}
</script>
