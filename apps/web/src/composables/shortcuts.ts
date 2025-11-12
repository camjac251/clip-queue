import { useMagicKeys, whenever } from '@vueuse/core'
import { ref } from 'vue'

/**
 * Enhanced keyboard shortcuts composable with complex combinations and sequences
 *
 * Provides advanced keyboard shortcut detection including:
 * - Complex combinations (Ctrl+Shift+P, Ctrl+/)
 * - Sequences (Konami code, custom sequences)
 * - Conditional execution based on user roles or state
 *
 * @example
 * // Simple usage in component
 * const shortcuts = useEnhancedShortcuts()
 *
 * shortcuts.register('Ctrl+Shift+P', () => {
 *   openCommandPalette()
 * })
 *
 * shortcuts.register('Ctrl+/', () => {
 *   toggleHelp()
 * })
 *
 * @example
 * // Sequence shortcuts (e.g., Konami code)
 * shortcuts.registerSequence(
 *   ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'],
 *   () => {
 *     unlockEasterEgg()
 *   }
 * )
 */
export function useEnhancedShortcuts() {
  const keys = useMagicKeys()
  const sequenceBuffer = ref<string[]>([])
  const sequenceTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
  const SEQUENCE_TIMEOUT_MS = 1000 // Time between key presses to consider it part of sequence

  /**
   * Register a keyboard shortcut
   *
   * @param combination - Key combination (e.g., 'Ctrl+Shift+P', 'Alt+K', '/')
   * @param handler - Function to execute when shortcut is triggered
   */
  function register(combination: string, handler: () => void) {
    const key = keys[combination]
    if (key) {
      whenever(key, (value) => {
        if (value) {
          handler()
        }
      })
    }
  }

  /**
   * Register a key sequence (e.g., Konami code)
   *
   * @param sequence - Array of key names in order
   * @param handler - Function to execute when sequence is completed
   */
  function registerSequence(sequence: string[], handler: () => void) {
    // Set up listeners for each key in the sequence
    sequence.forEach((keyName) => {
      const keyRef = keys[keyName]
      if (!keyRef) return

      whenever(keyRef, (value) => {
        if (!value) return

        // Clear timeout if exists
        if (sequenceTimeout.value) {
          clearTimeout(sequenceTimeout.value)
        }

        // Add key to buffer
        sequenceBuffer.value.push(keyName)

        // Keep buffer size reasonable
        if (sequenceBuffer.value.length > sequence.length) {
          sequenceBuffer.value.shift()
        }

        // Check if sequence matches
        const bufferMatches = sequence.every((key, index) => sequenceBuffer.value[index] === key)

        if (bufferMatches && sequenceBuffer.value.length === sequence.length) {
          handler()
          sequenceBuffer.value = [] // Reset on success
        }

        // Set timeout to reset buffer
        sequenceTimeout.value = setTimeout(() => {
          sequenceBuffer.value = []
        }, SEQUENCE_TIMEOUT_MS)
      })
    })
  }

  /**
   * Check if a specific key combination is currently pressed
   *
   * @param combination - Key combination to check
   * @returns Whether the combination is pressed
   */
  function isPressed(combination: string): boolean {
    return keys[combination]?.value ?? false
  }

  return {
    register,
    registerSequence,
    isPressed,
    keys
  }
}

/**
 * Pre-configured keyboard shortcuts for common actions
 *
 * @example
 * const shortcuts = useCommonShortcuts()
 *
 * shortcuts.commandPalette(() => openCommandPalette())
 * shortcuts.help(() => toggleHelp())
 * shortcuts.search(() => focusSearch())
 * shortcuts.settings(() => navigateToSettings())
 */
export function useCommonShortcuts() {
  const shortcuts = useEnhancedShortcuts()

  return {
    /**
     * Command palette (Ctrl+Shift+P / Cmd+Shift+P)
     */
    commandPalette: (handler: () => void) => {
      shortcuts.register('Ctrl+Shift+P', handler)
      shortcuts.register('Meta+Shift+P', handler)
    },

    /**
     * Help toggle (Ctrl+/ / Cmd+/)
     */
    help: (handler: () => void) => {
      shortcuts.register('Ctrl+/', handler)
      shortcuts.register('Meta+/', handler)
    },

    /**
     * Search focus (Ctrl+K / Cmd+K)
     */
    search: (handler: () => void) => {
      shortcuts.register('Ctrl+K', handler)
      shortcuts.register('Meta+K', handler)
    },

    /**
     * Settings navigation (Ctrl+, / Cmd+,)
     */
    settings: (handler: () => void) => {
      shortcuts.register('Ctrl+,', handler)
      shortcuts.register('Meta+,', handler)
    },

    /**
     * Refresh (Ctrl+R / Cmd+R)
     */
    refresh: (handler: () => void) => {
      shortcuts.register('Ctrl+R', handler)
      shortcuts.register('Meta+R', handler)
    },

    /**
     * Escape key
     */
    escape: (handler: () => void) => {
      shortcuts.register('Escape', handler)
    },

    /**
     * Konami code easter egg
     */
    konami: (handler: () => void) => {
      shortcuts.registerSequence(
        [
          'ArrowUp',
          'ArrowUp',
          'ArrowDown',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'ArrowLeft',
          'ArrowRight',
          'b',
          'a'
        ],
        handler
      )
    }
  }
}
