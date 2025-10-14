<script setup lang="ts">
import { useConfirm } from '../composables/use-confirm'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog'

const { isOpen, options, confirm, cancel } = useConfirm()
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ options?.header || 'Confirm' }}</DialogTitle>
        <DialogDescription>{{ options?.message }}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button :variant="options?.rejectProps?.variant || 'secondary'" @click="cancel">
          {{ options?.rejectProps?.label || 'Cancel' }}
        </Button>
        <Button :variant="options?.acceptProps?.variant || 'default'" @click="confirm">
          {{ options?.acceptProps?.label || 'Confirm' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
