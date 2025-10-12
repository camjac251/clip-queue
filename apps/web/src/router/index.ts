import type { RouteRecordRaw } from 'vue-router'
import { computed } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

import { config } from '@/config'
import * as m from '@/paraglide/messages'
import { useLogger } from '@/stores/logger'
import { useQueueServer as useQueue } from '@/stores/queue-server'
import { useSettings } from '@/stores/settings'
import { useUser } from '@/stores/user'
import HistoryPage from '@/views/HistoryPage.vue'
import LogsPage from '@/views/LogsPage.vue'
import QueuePage from '@/views/QueuePage.vue'
import AboutSettings from '@/views/settings/AboutSettings.vue'
import ChatSettings from '@/views/settings/ChatSettings.vue'
import LoggerSettings from '@/views/settings/LoggerSettings.vue'
import OtherSettings from '@/views/settings/OtherSettings.vue'
import PreferenceSettings from '@/views/settings/PreferenceSettings.vue'
import QueueSettings from '@/views/settings/QueueSettings.vue'

declare module 'vue-router' {
  interface RouteMeta {
    icon: string
    requiresAuth: boolean
  }
}

export enum RouteNameConstants {
  QUEUE = 'queue',
  HISTORY = 'history',
  LOGS = 'logs',
  SETTINGS = 'settings',
  SETTINGS_CHAT = 'settings_chat',
  SETTINGS_QUEUE = 'settings_queue',
  SETTINGS_PREFERENCES = 'settings_preferences',
  SETTINGS_LOGS = 'settings_logs',
  SETTINGS_OTHER = 'settings_other',
  SETTINGS_ABOUT = 'settings_about'
}

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: RouteNameConstants.QUEUE,
    component: QueuePage,
    meta: {
      icon: 'pi pi-list',
      requiresAuth: false
    }
  },
  {
    path: '/history',
    name: RouteNameConstants.HISTORY,
    component: HistoryPage,
    meta: {
      icon: 'pi pi-history',
      requiresAuth: true
    }
  },
  {
    path: '/settings',
    name: RouteNameConstants.SETTINGS,
    redirect: { name: RouteNameConstants.SETTINGS_CHAT },
    component: () => import('@/views/SettingsPage.vue'),
    meta: {
      icon: 'pi pi-cog',
      requiresAuth: true
    },
    children: [
      {
        path: 'chat',
        name: RouteNameConstants.SETTINGS_CHAT,
        component: ChatSettings,
        meta: {
          icon: 'pi pi-comments',
          requiresAuth: true
        }
      },
      {
        path: 'queue',
        name: RouteNameConstants.SETTINGS_QUEUE,
        component: QueueSettings,
        meta: {
          icon: 'pi pi-list',
          requiresAuth: true
        }
      },
      {
        path: 'preferences',
        name: RouteNameConstants.SETTINGS_PREFERENCES,
        component: PreferenceSettings,
        meta: {
          icon: 'pi pi-palette',
          requiresAuth: true
        }
      },
      {
        path: 'logs',
        name: RouteNameConstants.SETTINGS_LOGS,
        component: LoggerSettings,
        meta: {
          icon: 'pi pi-book',
          requiresAuth: true
        }
      },
      {
        path: 'other',
        name: RouteNameConstants.SETTINGS_OTHER,
        component: OtherSettings,
        meta: {
          icon: 'pi pi-cog',
          requiresAuth: true
        }
      },
      {
        path: 'about',
        name: RouteNameConstants.SETTINGS_ABOUT,
        component: AboutSettings,
        meta: {
          icon: 'pi pi-info-circle',
          requiresAuth: true
        }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes: [
    ...routes,
    {
      path: '/logs',
      name: RouteNameConstants.LOGS,
      component: LogsPage,
      meta: {
        icon: 'pi pi-book',
        requiresAuth: true
      }
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: RouteNameConstants.QUEUE }
    }
  ]
})

router.beforeEach(async (to, from, next) => {
  document.title = config.title
  const logger = useLogger()
  const user = useUser()
  const queue = useQueue()
  const settings = useSettings()

  // Initialize queue polling for all users (read-only for unauthenticated)
  queue.initialize()

  // Initialize settings only for logged in users
  if (user.isLoggedIn) {
    settings.initialize()
    await settings.loadSettings()
  }

  // Redirect to queue if trying to access protected route while not logged in
  if (!user.isLoggedIn && to.meta.requiresAuth) {
    logger.debug(`[Router]: User is not logged in, redirecting to queue page from ${to.fullPath}.`)
    next({ name: RouteNameConstants.QUEUE })
    return
  }
  logger.debug(`[Router]: Navigating from ${from.fullPath} to ${to.fullPath}.`)
  next()
})

router.afterEach(() => {
  const user = useUser()
  const queue = useQueue()

  // Cleanup polling on logout
  if (!user.isLoggedIn) {
    queue.cleanup()
  }
})

export default router

// Translations for each of the routes.
export const routeTranslations = {
  [RouteNameConstants.QUEUE]: m.queue,
  [RouteNameConstants.HISTORY]: m.history,
  [RouteNameConstants.LOGS]: m.logs,
  [RouteNameConstants.SETTINGS]: m.settings,
  [RouteNameConstants.SETTINGS_CHAT]: m.settings_chat,
  [RouteNameConstants.SETTINGS_QUEUE]: m.settings_queue,
  [RouteNameConstants.SETTINGS_PREFERENCES]: m.settings_preferences,
  [RouteNameConstants.SETTINGS_LOGS]: m.logs,
  [RouteNameConstants.SETTINGS_OTHER]: m.settings_other,
  [RouteNameConstants.SETTINGS_ABOUT]: m.settings_about
}

/**
 * Returns list of allowed routes for the current user.
 */
export const allowedRoutes = computed(() => {
  const user = useUser()
  return routes.filter((r) => (r.meta?.requiresAuth && user.isLoggedIn) || !r.meta?.requiresAuth)
})
