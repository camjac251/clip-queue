<template>
  <Toaster position="bottom-center" />
  <GlobalConfirmDialog />
  <div :key="preferences.preferences.language" class="bg-background h-full min-h-screen">
    <AppNavBar />
    <main
      class="h-full min-h-screen text-center transition-all duration-300"
      :class="sidebar.isCollapsed.value ? 'ml-16' : 'ml-64'"
    >
      <div
        v-if="route.name !== 'queue' && !route.name?.toString().startsWith('settings')"
        class="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8"
      >
        <RouterView />
      </div>
      <RouterView v-else />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useIntervalFn, useMagicKeys, whenever } from '@vueuse/core'
import { onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { GlobalConfirmDialog, Toaster, useToast } from '@cq/ui'

import AppNavBar from '@/components/AppNavBar.vue'
import { useCommonShortcuts } from '@/composables/shortcuts'
import { useSidebar } from '@/composables/sidebar'
import { usePreferences } from './stores/preferences'
import { useQueueServer } from './stores/queue-server'
import { useSettings } from './stores/settings'
import { useUser } from './stores/user'
import { consumeAuthEvent } from './utils/events'

const route = useRoute()
const router = useRouter()
const sidebar = useSidebar()

const preferences = usePreferences()
const toast = useToast()
const queueServer = useQueueServer()
const settings = useSettings()
const user = useUser()

// Poll for auth events and display toast notifications
const checkAuthEvents = () => {
  const event = consumeAuthEvent()
  if (event) {
    toast.add({
      severity: event.type === 'forbidden' ? 'error' : 'warn',
      summary:
        event.type === 'forbidden'
          ? 'Permission Denied'
          : event.type === 'expired'
            ? 'Session Expired'
            : 'Authentication Required',
      detail: event.message,
      life: 5000
    })
  }
}

const { pause: pauseAuthPolling } = useIntervalFn(checkAuthEvents, 100)

// Listen for auth:failed events from login flow
const handleAuthFailed = (event: Event) => {
  const customEvent = event as CustomEvent<{ message: string }>
  toast.add({
    severity: 'error',
    summary: 'Login Failed',
    detail: customEvent.detail.message,
    life: 5000
  })
}

// Clean up polling on browser close/refresh
const handleBeforeUnload = () => {
  queueServer.cleanup()
}

// Keyboard shortcuts
const keys = useMagicKeys()
const shortcuts = useCommonShortcuts()

// Sidebar toggle (Ctrl+B / Cmd+B)
whenever(keys['Ctrl+B']!, (value) => {
  if (value) sidebar.toggleCollapse()
})

whenever(keys['Meta+B']!, (value) => {
  if (value) sidebar.toggleCollapse()
})

// Settings navigation (Ctrl+, / Cmd+,)
shortcuts.settings(() => {
  if (user.canManageSettings) {
    router.push('/settings')
  }
})

// Help/keyboard shortcuts reference (Ctrl+/ / Cmd+/)
shortcuts.help(() => {
  toast.add({
    severity: 'info',
    summary: 'Keyboard Shortcuts',
    detail: 'Ctrl+B: Toggle sidebar, Ctrl+,: Settings, Space: Play/Pause, ←→: Navigate',
    life: 5000
  })
})

// Konami code easter egg
shortcuts.konami(() => {
  toast.add({
    severity: 'success',
    summary: '🎮 Konami Code!',
    detail: 'You found the secret! ↑↑↓↓←→←→BA',
    life: 10000
  })
})

onMounted(async () => {
  // Handle OAuth callback if present in URL
  await user.handleOAuthCallback()

  // Check if user is already logged in (from existing session)
  await user.checkLoginStatus()

  // Initialize stores
  queueServer.initialize()
  settings.initialize()

  // Only load settings if authenticated as broadcaster
  if (user.canManageSettings) {
    await settings.loadSettings()
  }

  window.addEventListener('auth:failed', handleAuthFailed)
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onUnmounted(() => {
  pauseAuthPolling()
  window.removeEventListener('auth:failed', handleAuthFailed)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  // Also cleanup on component unmount
  queueServer.cleanup()
})
</script>
