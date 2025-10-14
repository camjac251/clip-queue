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
import { onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'

import { GlobalConfirmDialog, Toaster, useToast } from '@cq/ui'

import AppNavBar from '@/components/AppNavBar.vue'
import { useSidebar } from '@/composables/sidebar'
import { usePreferences } from './stores/preferences'
import { useQueueServer } from './stores/queue-server'
import { useSettings } from './stores/settings'
import { useUser } from './stores/user'
import { consumeAuthEvent } from './utils/events'

const route = useRoute()
const sidebar = useSidebar()

const preferences = usePreferences()
const toast = useToast()
const queueServer = useQueueServer()
const settings = useSettings()
const user = useUser()

// Poll for auth events and display toast notifications
let authEventInterval: number | undefined

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

// Handle Ctrl+B keyboard shortcut for sidebar toggle
const handleKeydown = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
    event.preventDefault()
    sidebar.toggleCollapse()
  }
}

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

  // Start polling for auth events every 100ms
  authEventInterval = window.setInterval(checkAuthEvents, 100)

  window.addEventListener('auth:failed', handleAuthFailed)
  window.addEventListener('beforeunload', handleBeforeUnload)
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  // Clear auth event polling interval
  if (authEventInterval !== undefined) {
    clearInterval(authEventInterval)
  }

  window.removeEventListener('auth:failed', handleAuthFailed)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  window.removeEventListener('keydown', handleKeydown)
  // Also cleanup on component unmount
  queueServer.cleanup()
})
</script>
