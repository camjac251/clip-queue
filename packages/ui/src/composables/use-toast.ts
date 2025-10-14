import { toast } from 'vue-sonner'

export interface ToastOptions {
  severity?: 'success' | 'info' | 'warn' | 'error'
  summary?: string
  detail?: string
  life?: number
}

export function useToast() {
  function add(options: ToastOptions) {
    const message = options.detail || options.summary || ''
    const title = options.summary && options.detail ? options.summary : undefined

    switch (options.severity) {
      case 'success':
        toast.success(title || message, title ? { description: message } : undefined)
        break
      case 'error':
        toast.error(title || message, title ? { description: message } : undefined)
        break
      case 'warn':
        toast.warning(title || message, title ? { description: message } : undefined)
        break
      case 'info':
      default:
        toast.info(title || message, title ? { description: message } : undefined)
        break
    }
  }

  return {
    add
  }
}
