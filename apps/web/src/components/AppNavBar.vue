<template>
  <!-- Sidebar -->
  <aside
    class="bg-background/95 fixed top-0 left-0 z-50 flex h-screen flex-col border-r border-violet-500/10 shadow-xl backdrop-blur-md transition-all duration-300 dark:border-violet-500/20"
    :class="isCollapsed ? 'w-16' : 'w-64'"
  >
    <!-- Collapse Toggle Button (Edge) -->
    <Button
      variant="ghost"
      size="icon"
      class="border-border bg-background absolute top-4 -right-3 z-10 h-6 w-6 rounded-full border shadow-md transition-all duration-300 hover:scale-110 hover:shadow-lg"
      :title="isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'"
      @click="toggleCollapse"
    >
      <component :is="isCollapsed ? UiChevronRight : UiChevronLeft" :size="14" />
    </Button>

    <!-- Logo Section -->
    <div
      class="border-border/50 relative flex items-center justify-center border-b bg-gradient-to-br from-violet-500/5 to-purple-500/5 p-4 transition-all duration-300 dark:from-violet-500/10 dark:to-purple-500/10"
    >
      <div
        class="to-background/20 absolute inset-0 bg-gradient-to-b from-transparent via-transparent"
      ></div>
      <RouterLink
        :to="{ name: RouteNameConstants.QUEUE }"
        class="group relative flex shrink-0 items-center gap-3 transition-all duration-300 hover:scale-105"
      >
        <div class="relative">
          <div
            class="absolute inset-0 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 blur-md transition-opacity duration-300 group-hover:opacity-100 dark:from-violet-400/30 dark:to-purple-400/30"
          ></div>
          <img
            class="relative aspect-square w-10 rounded-lg shadow-md ring-1 ring-violet-500/20 transition-all duration-300 group-hover:ring-2 group-hover:ring-violet-500/40"
            src="/icon.png"
            alt="Clip Queue"
          />
        </div>
        <span
          v-if="!isCollapsed"
          class="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-lg font-bold text-transparent transition-opacity duration-300 dark:from-violet-400 dark:to-purple-400"
        >
          Clip Queue
        </span>
      </RouterLink>
    </div>

    <!-- Navigation Links -->
    <nav
      class="scrollbar-thin scrollbar-thumb-violet-500/20 scrollbar-track-transparent flex-1 space-y-1 overflow-y-auto p-3"
    >
      <RouterLink
        v-for="route in allowedRoutes"
        :key="route.name"
        v-slot="{ isActive }"
        :to="{ name: route.name }"
        custom
      >
        <button
          class="group relative flex w-full items-center gap-3 rounded-md font-medium transition-colors"
          :class="[
            isCollapsed ? 'justify-center p-3' : 'px-3 py-2',
            isActive
              ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
              : 'text-foreground hover:bg-muted/50'
          ]"
          @click="() => router.push({ name: route.name })"
        >
          <component
            :is="getRouteIcon(route.meta?.icon)"
            :size="18"
            class="shrink-0 transition-transform duration-200 group-hover:scale-110"
          />
          <span v-if="!isCollapsed" class="text-sm">
            {{ routeTranslations[route.name as RouteNameConstants]() }}
          </span>
        </button>
      </RouterLink>
    </nav>

    <!-- Queue Status Toggle -->
    <div class="px-3 pb-3">
      <Button
        variant="ghost"
        class="group relative w-full overflow-hidden transition-all duration-300"
        :class="isCollapsed ? 'justify-center p-2' : 'justify-between px-3 py-2'"
        :disabled="!user.isBroadcaster"
        @click="handleQueueToggle"
      >
        <!-- Status Gradient Background -->
        <div
          class="absolute inset-0 transition-all duration-500"
          :class="
            queue.isOpen
              ? 'bg-gradient-to-r from-emerald-500/30 to-green-500/30'
              : 'bg-gradient-to-r from-rose-500/30 to-red-500/30'
          "
        ></div>

        <div class="relative flex items-center gap-2">
          <component
            :is="queue.isOpen ? StatusInboxOpen : StatusInboxClosed"
            :size="20"
            class="shrink-0 transition-colors"
            :class="queue.isOpen ? 'text-emerald-500' : 'text-rose-500'"
          />
          <span v-if="!isCollapsed" class="text-muted-foreground text-xs font-medium">
            {{ m.queue() }}
          </span>
        </div>
        <span
          v-if="!isCollapsed"
          class="relative text-xs font-semibold transition-colors"
          :class="queue.isOpen ? 'text-emerald-500' : 'text-rose-500'"
        >
          {{ queue.isOpen ? m.open() : m.closed() }}
        </span>
      </Button>
    </div>

    <!-- Bottom Section: Theme + User -->
    <div
      class="border-border/50 relative mt-auto space-y-2 border-t bg-gradient-to-t from-violet-500/5 to-transparent p-3 dark:from-violet-500/10"
    >
      <!-- Theme Toggle -->
      <Button
        variant="ghost"
        class="group relative w-full overflow-hidden transition-all duration-300"
        :class="isCollapsed ? 'justify-center p-2' : 'justify-between px-3 py-2'"
        @click="preferences.toggleTheme()"
      >
        <!-- Light Switch Style Gradient -->
        <div
          class="absolute inset-0 transition-all duration-500"
          :class="
            preferences.isDark
              ? 'bg-gradient-to-r from-black/30 to-violet-500/30'
              : 'bg-gradient-to-r from-amber-500/30 to-white/30'
          "
        ></div>

        <div class="relative flex items-center gap-2">
          <ThemeSun
            :size="16"
            class="shrink-0 transition-colors"
            :class="preferences.isDark ? 'text-muted-foreground' : 'text-amber-500'"
          />
          <span v-if="!isCollapsed" class="text-muted-foreground text-xs font-medium">Theme</span>
        </div>
        <ThemeMoon
          v-if="!isCollapsed"
          :size="16"
          class="relative shrink-0 transition-colors"
          :class="preferences.isDark ? 'text-violet-500' : 'text-muted-foreground'"
        />
      </Button>

      <!-- User Section -->
      <DropdownMenu v-if="user.isLoggedIn">
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            class="w-full gap-3 transition-all duration-300"
            :class="isCollapsed ? 'h-10 p-0' : 'h-auto px-3 py-2'"
          >
            <img
              v-if="user.profileImageUrl"
              :src="user.profileImageUrl"
              :alt="user.displayName"
              class="shrink-0 rounded-full object-cover shadow-sm"
              :class="isCollapsed ? 'h-8 w-8' : 'h-10 w-10'"
            />
            <div
              v-else
              class="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 font-bold text-white shadow-md"
              :class="isCollapsed ? 'h-8 w-8 text-sm' : 'h-10 w-10 text-base'"
            >
              {{
                user.displayName?.charAt(0).toUpperCase() || user.username?.charAt(0).toUpperCase()
              }}
            </div>
            <div v-if="!isCollapsed" class="flex flex-1 flex-col items-start overflow-hidden">
              <span class="truncate text-sm font-semibold">{{ user.displayName }}</span>
              <span class="text-muted-foreground text-xs">
                {{ user.isBroadcaster ? 'Broadcaster' : user.isModerator ? 'Moderator' : 'Viewer' }}
              </span>
            </div>
            <UiChevronDown v-if="!isCollapsed" :size="14" class="shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="right"
          class="bg-background/95 border-violet-500/20 shadow-xl backdrop-blur-md dark:border-violet-500/30"
        >
          <DropdownMenuItem variant="destructive" class="cursor-pointer" @click="handleLogout">
            <ActionLogOut :size="16" />
            {{ m.logout() }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        v-else
        class="w-full gap-2 transition-all duration-300"
        :class="isCollapsed ? 'h-10 p-0' : ''"
        @click="() => user.redirect()"
      >
        <BrandTwitch :size="isCollapsed ? 24 : 20" />
        <span v-if="!isCollapsed">{{ m.login() }}</span>
      </Button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@cq/ui'

import {
  ActionLogOut,
  BrandTwitch,
  routeIcons,
  StatusInboxClosed,
  StatusInboxOpen,
  ThemeMoon,
  ThemeSun,
  UiChevronDown,
  UiChevronLeft,
  UiChevronRight
} from '@/composables/icons'
import { useSidebar } from '@/composables/sidebar'
import * as m from '@/paraglide/messages'
import { allowedRoutes, RouteNameConstants, routeTranslations } from '@/router'
import { usePreferences } from '@/stores/preferences'
import { useQueueServer as useQueue } from '@/stores/queue-server'
import { useUser } from '@/stores/user'

const preferences = usePreferences()
const user = useUser()
const queue = useQueue()
const router = useRouter()

const { isCollapsed, toggleCollapse } = useSidebar()

function getRouteIcon(iconKey?: string) {
  if (!iconKey) return null
  return routeIcons[iconKey as keyof typeof routeIcons]
}

async function handleLogout() {
  await user.logout()
  await router.push({ name: RouteNameConstants.QUEUE })
}

async function handleQueueToggle() {
  try {
    if (queue.isOpen) {
      await queue.close()
    } else {
      await queue.open()
    }
  } catch (error) {
    console.error('[AppNavBar]: Failed to toggle queue:', error)
  }
}
</script>
