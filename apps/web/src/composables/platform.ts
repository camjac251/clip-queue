import { computed, ref } from 'vue'

/**
 * Detect platform from user agent
 */
function detectPlatform(): 'mac' | 'windows' | 'linux' {
  const ua = navigator.userAgent.toLowerCase()

  if (ua.includes('mac')) return 'mac'
  if (ua.includes('win')) return 'windows'
  return 'linux'
}

const platform = ref(detectPlatform())

/**
 * Composable for platform detection and keyboard shortcuts
 */
export function usePlatform() {
  const isMac = computed(() => platform.value === 'mac')
  const isWindows = computed(() => platform.value === 'windows')
  const isLinux = computed(() => platform.value === 'linux')

  const modifierKey = computed(() => (isMac.value ? '⌘' : 'Ctrl'))
  const modifierKeyFull = computed(() => (isMac.value ? 'Cmd' : 'Ctrl'))

  return {
    platform,
    isMac,
    isWindows,
    isLinux,
    modifierKey,
    modifierKeyFull
  }
}
