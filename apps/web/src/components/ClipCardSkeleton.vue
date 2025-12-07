<template>
  <Card class="max-w-2xs shrink-0 overflow-hidden text-left">
    <Skeleton class="aspect-video w-full" />
    <CardHeader>
      <Skeleton class="h-5 w-3/4" />
      <Skeleton class="mt-1.5 h-4 w-1/2" />
    </CardHeader>
    <CardContent>
      <div class="space-y-1.5">
        <Skeleton class="h-3 w-24" />
        <Skeleton class="h-3 w-32" />
        <Skeleton class="h-3 w-20" />
      </div>
    </CardContent>
    <CardFooter v-if="showActions">
      <div class="flex w-full justify-between gap-2">
        <Skeleton class="h-8 grow" />
        <Skeleton class="h-8 grow" />
      </div>
    </CardFooter>
  </Card>
</template>

<script setup lang="ts">
import { Card, CardContent, CardFooter, CardHeader, Skeleton } from '@cq/ui'

withDefaults(
  defineProps<{
    showActions?: boolean
  }>(),
  {
    showActions: false
  }
)
</script>
