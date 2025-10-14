<template>
  <div class="bg-background flex min-h-screen flex-col">
    <!-- Header Bar -->
    <div
      class="border-border bg-card/95 supports-[backdrop-filter]:bg-card/60 sticky top-0 z-10 border-b backdrop-blur"
    >
      <div class="flex h-14 items-center px-4 lg:px-6">
        <!-- Mobile Menu Toggle -->
        <Button variant="ghost" size="icon" class="mr-2 lg:hidden" @click="toggleSidebar">
          <UiMenu :size="20" />
        </Button>

        <!-- Title -->
        <div class="flex-1">
          <h1
            class="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-lg font-bold text-transparent sm:text-xl dark:from-violet-400 dark:to-purple-400"
          >
            {{ m.settings() }}
          </h1>
        </div>

        <!-- Search Button (Mobile) -->
        <Button variant="ghost" size="icon" class="lg:hidden" @click="openSearch">
          <UiSearch :size="20" />
        </Button>
      </div>
    </div>

    <!-- Main Layout -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Sidebar -->
      <SettingsSidebar :is-open="isSidebarOpen" @open-search="openSearch" />

      <!-- Content Area -->
      <main class="flex-1 overflow-y-auto">
        <div class="mx-auto max-w-4xl px-4 py-8 lg:px-6 lg:py-12">
          <RouterView />
        </div>
      </main>
    </div>

    <!-- Search Dialog -->
    <SettingsSearch v-model:open="isSearchOpen" />

    <!-- Mobile Sidebar Overlay -->
    <Transition
      enter-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-300"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isSidebarOpen"
        class="fixed inset-0 z-40 bg-black/50 lg:hidden"
        @click="closeSidebar"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import { Button } from '@cq/ui'

import SettingsSearch from '@/components/SettingsSearch.vue'
import SettingsSidebar from '@/components/SettingsSidebar.vue'
import { UiMenu, UiSearch } from '@/composables/icons'
import * as m from '@/paraglide/messages'

const isSidebarOpen = ref(false)
const isSearchOpen = ref(false)

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value
}

function closeSidebar() {
  isSidebarOpen.value = false
}

function openSearch() {
  isSearchOpen.value = true
}

// Keyboard shortcuts
function handleKeydown(event: KeyboardEvent) {
  // Cmd/Ctrl + K for search
  if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
    event.preventDefault()
    openSearch()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>
