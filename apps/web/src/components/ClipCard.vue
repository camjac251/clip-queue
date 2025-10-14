<template>
  <Card class="max-w-2xs shrink-0 overflow-hidden text-left">
    <img
      class="aspect-video w-full"
      :alt="clip.title"
      :src="clip.thumbnailUrl"
      @error="emit('remove')"
    />
    <CardHeader>
      <CardTitle class="line-clamp-1 text-base font-normal" :title="clip.title">
        {{ clip.title }}
      </CardTitle>
      <CardDescription class="line-clamp-1" :title="subtitle">
        {{ subtitle }}
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div class="text-muted-foreground text-xs">
        <p
          v-if="clip.submitters[0]"
          class="line-clamp-1 font-medium text-violet-600 dark:text-violet-400"
        >
          {{ m.submitter_name({ name: clip.submitters[0] }) }}
        </p>
        <p class="line-clamp-1">
          {{ m.creator_name({ name: clip.creator ?? m.unknown() }) }}
        </p>
        <div class="flex items-center gap-1">
          <p>{{ m.platform_colon() }}</p>
          <PlatformName :platform="clip.platform" class="font-normal" />
        </div>
      </div>
    </CardContent>
    <CardFooter v-if="canControl">
      <div class="flex w-full justify-between gap-2">
        <Button class="grow" variant="secondary" size="sm" @click="emit('play')">
          {{ m.play() }}
        </Button>
        <Button class="grow" variant="destructive" size="sm" @click="emit('remove')">
          {{ m.remove() }}
        </Button>
      </div>
    </CardFooter>
  </Card>
</template>

<script setup lang="ts">
import { computed, toRefs } from 'vue'

import type { Clip } from '@cq/platforms'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@cq/ui'

import PlatformName from '@/components/PlatformName.vue'
import * as m from '@/paraglide/messages'

export interface Props {
  clip: Clip
  canControl?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  canControl: false
})
const { clip, canControl } = toRefs(props)

const subtitle = computed(() => {
  if (clip.value.category) {
    return `${clip.value.channel} - ${clip.value.category}`
  }
  return clip.value.channel
})

const emit = defineEmits<{
  (e: 'play'): void
  (e: 'remove'): void
}>()
</script>
