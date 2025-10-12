<template>
  <Toast position="bottom-center" />
  <ConfirmDialog :draggable="false" />
  <div :key="preferences.preferences.language" class="dark:bg-surface-950 h-full min-h-screen">
    <div class="h-full">
      <AppNavBar />
      <main class="mx-auto h-full max-w-7xl px-4 py-5 text-center sm:px-6 lg:px-8">
        <RouterView />
      </main>
    </div>
  </div>
  <Footer :copyright="config.copyright" :github="config.github" />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

import { ConfirmDialog, Footer, Toast, useToast } from '@cq/ui'

import AppNavBar from '@/components/AppNavBar.vue'
import { config } from '@/config'
import { usePreferences } from './stores/preferences'
import { useQueueServer } from './stores/queue-server'
import { useUser } from './stores/user'
import { consumeAuthEvent } from './utils/events'

const preferences = usePreferences()
const toast = useToast()
const queueServer = useQueueServer()
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

onMounted(async () => {
  // Handle OAuth callback if present in URL
  await user.handleOAuthCallback()

  // Check if user is already logged in (from existing session)
  await user.checkLoginStatus()

  // Start polling for auth events every 100ms
  authEventInterval = window.setInterval(checkAuthEvents, 100)

  window.addEventListener('auth:failed', handleAuthFailed)
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onUnmounted(() => {
  // Clear auth event polling interval
  if (authEventInterval !== undefined) {
    clearInterval(authEventInterval)
  }

  window.removeEventListener('auth:failed', handleAuthFailed)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  // Also cleanup on component unmount
  queueServer.cleanup()
})
</script>
