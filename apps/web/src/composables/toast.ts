import { useToast } from '@cq/ui'

import * as m from '@/paraglide/messages'

export function useToastNotifications() {
  const toast = useToast()

  function success(detail: string) {
    toast.add({
      severity: 'success',
      summary: m.success(),
      detail,
      life: 3000
    })
  }

  function error(detail: string) {
    toast.add({
      severity: 'error',
      summary: m.error(),
      detail,
      life: 3000
    })
  }

  function warning(detail: string) {
    toast.add({
      severity: 'warn',
      summary: m.warning(),
      detail,
      life: 3000
    })
  }

  function info(detail: string) {
    toast.add({
      severity: 'info',
      summary: m.info(),
      detail,
      life: 3000
    })
  }

  function batchResult(succeeded: number, failed: number, operation: string) {
    const total = succeeded + failed
    if (failed === 0) {
      success(`${operation}: ${succeeded} of ${total} ${total === 1 ? 'clip' : 'clips'}`)
    } else if (succeeded === 0) {
      error(`${operation} failed: ${failed} of ${total} ${total === 1 ? 'clip' : 'clips'}`)
    } else {
      warning(`${operation}: ${succeeded} succeeded, ${failed} failed out of ${total} clips`)
    }
  }

  return { success, error, warning, info, batchResult }
}
