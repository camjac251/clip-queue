import type { Ref } from 'vue'
import { onMounted, ref, toRaw } from 'vue'

import { useToast } from '@cq/ui'

/**
 * Composable for managing settings form state with save/reset functionality
 *
 * Features:
 * - Automatic form data cloning from store
 * - Save with success/error toast notifications
 * - Reset to original values
 * - Form key for forcing re-renders
 *
 * @example
 * const { formData, formKey, onReset, onSubmit } = useSettingsForm(
 *   () => settings.commands,
 *   (values) => { settings.commands = values },
 *   async () => settings.saveSettings(),
 *   m.chat_settings_saved()
 * )
 */
export function useSettingsForm<T>(
  getter: () => T,
  setter: (value: T) => void,
  save: () => Promise<void>,
  successMessage: string
): {
  formData: Ref<T>
  formKey: Ref<number>
  onReset: () => void
  onSubmit: () => Promise<void>
} {
  const toast = useToast()
  const formKey = ref(1)
  const formData: Ref<T> = ref(structuredClone(toRaw(getter()))) as Ref<T>

  function reset() {
    formData.value = structuredClone(toRaw(getter()))
    formKey.value += 1
  }

  async function submit() {
    try {
      setter(formData.value)
      await save()
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: successMessage,
        life: 3000
      })
      reset()
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to save settings',
        life: 3000
      })
      throw error
    }
  }

  onMounted(() => {
    reset()
  })

  return {
    formData,
    formKey,
    onReset: reset,
    onSubmit: submit
  }
}
