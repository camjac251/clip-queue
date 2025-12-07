<template>
  <Card
    class="hover:shadow-brand/10 max-w-2xs shrink-0 overflow-hidden text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
  >
    <div class="group relative overflow-hidden">
      <img
        class="aspect-video w-full transition-transform duration-300 group-hover:scale-105"
        :alt="clip.title"
        :src="clip.thumbnailUrl"
        @error="emit('remove')"
      />
      <div
        class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      />
    </div>
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
        <p v-if="clip.submitters[0]" class="text-brand line-clamp-1 font-medium">
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
