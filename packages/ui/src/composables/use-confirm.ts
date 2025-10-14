import { ref } from 'vue'

export interface ConfirmOptions {
  header?: string
  message: string
  accept?: () => void
  reject?: () => void
  acceptProps?: {
    label?: string
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  }
  rejectProps?: {
    label?: string
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  }
}

const isOpen = ref(false)
const options = ref<ConfirmOptions | null>(null)

export function useConfirm() {
  function require(opts: ConfirmOptions) {
    options.value = opts
    isOpen.value = true
  }

  function confirm() {
    options.value?.accept?.()
    close()
  }

  function cancel() {
    options.value?.reject?.()
    close()
  }

  function close() {
    isOpen.value = false
    options.value = null
  }

  return {
    require,
    confirm,
    cancel,
    close,
    isOpen,
    options
  }
}
