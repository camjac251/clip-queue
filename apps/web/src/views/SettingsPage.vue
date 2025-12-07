<template>
  <div class="bg-background flex h-dvh flex-col overflow-hidden">
    <!-- Header Bar - Glassmorphism -->
    <div
      class="border-border/50 bg-card/80 flex flex-shrink-0 items-center gap-3 border-b px-3 py-2 backdrop-blur-sm"
    >
      <!-- Mobile Menu Toggle -->
      <Button
        variant="ghost"
        size="icon-sm"
        class="h-8 w-8 rounded-full lg:hidden"
        @click="toggleSidebar"
      >
        <UiMenu class="h-4 w-4" />
      </Button>

      <!-- Title -->
      <div class="flex items-center gap-2">
        <div class="bg-brand/10 hidden h-8 w-8 items-center justify-center rounded-lg sm:flex">
          <NavSettings class="text-brand h-4 w-4" />
        </div>
        <div>
          <h1 class="text-foreground text-sm font-semibold">{{ m.settings() }}</h1>
          <p class="text-muted-foreground hidden text-xs sm:block">
            Configure your application preferences
          </p>
        </div>
      </div>

      <div class="flex-1" />

      <!-- Search Button -->
      <Button
        variant="outline"
        size="sm"
        class="text-muted-foreground h-8 gap-2 px-2.5 text-xs"
        @click="openSearch"
      >
        <UiSearch class="h-3.5 w-3.5" />
        <span class="hidden sm:inline">{{ m.search_settings() }}</span>
        <KeyboardShortcut :keys="['K']" class="hidden sm:flex" />
      </Button>
    </div>

    <!-- Main Layout -->
    <div class="flex min-h-0 flex-1 overflow-hidden">
      <!-- Sidebar -->
      <SettingsSidebar :is-open="isSidebarOpen" @open-search="openSearch" />

      <!-- Content Area -->
      <main class="min-h-0 flex-1 overflow-y-auto">
        <div class="mx-auto max-w-3xl px-4 py-6 lg:px-6">
          <RouterView />
        </div>
      </main>
    </div>

    <!-- Search Dialog -->
    <SettingsSearch v-model:open="isSearchOpen" />

    <!-- Mobile Sidebar Overlay -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isSidebarOpen"
        class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
        @click="closeSidebar"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { useMagicKeys, whenever } from '@vueuse/core'
import { ref } from 'vue'

import { Button } from '@cq/ui'

import KeyboardShortcut from '@/components/KeyboardShortcut.vue'
import SettingsSearch from '@/components/SettingsSearch.vue'
import SettingsSidebar from '@/components/SettingsSidebar.vue'
import { NavSettings, UiMenu, UiSearch } from '@/composables/icons'
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
const keys = useMagicKeys()

whenever(keys['Ctrl+K']!, (value) => {
  if (value) openSearch()
})

whenever(keys['Meta+K']!, (value) => {
  if (value) openSearch()
})
</script>
