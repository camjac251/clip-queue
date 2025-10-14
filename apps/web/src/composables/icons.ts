/**
 * Centralized Icon Registry
 *
 * All icons used throughout the application.
 * - Brands: Simple Icons (official logos)
 * - UI/Actions: Lucide (consistent, well-designed)
 */

// Brands
import IconAlertCircle from '~icons/lucide/alert-circle'
import IconAlertTriangle from '~icons/lucide/alert-triangle'
import IconBookOpen from '~icons/lucide/book-open'
import IconCheck from '~icons/lucide/check'
// UI Controls
import IconChevronDown from '~icons/lucide/chevron-down'
import IconChevronLeft from '~icons/lucide/chevron-left'
import IconChevronRight from '~icons/lucide/chevron-right'
import IconChevronUp from '~icons/lucide/chevron-up'
import IconChevronsUpDown from '~icons/lucide/chevrons-up-down'
import IconCircle from '~icons/lucide/circle'
import IconClock from '~icons/lucide/clock'
import IconExternalLink from '~icons/lucide/external-link'
import IconHistory from '~icons/lucide/history'
import IconInbox from '~icons/lucide/inbox'
import IconInfo from '~icons/lucide/info'
// Navigation
import IconList from '~icons/lucide/list'
// Status
import IconLock from '~icons/lucide/lock'
import IconLockOpen from '~icons/lucide/lock-open'
import IconLogOut from '~icons/lucide/log-out'
import IconMenu from '~icons/lucide/menu'
import IconMessageSquare from '~icons/lucide/message-square'
import IconMoon from '~icons/lucide/moon'
import IconPalette from '~icons/lucide/palette'
import IconPause from '~icons/lucide/pause'
// Actions
import IconPlay from '~icons/lucide/play'
import IconPlayCircle from '~icons/lucide/play-circle'
import IconRotateCcw from '~icons/lucide/rotate-ccw'
import IconSearch from '~icons/lucide/search'
import IconSettings from '~icons/lucide/settings'
import IconSkipBack from '~icons/lucide/skip-back'
import IconSkipForward from '~icons/lucide/skip-forward'
// Theme
import IconSun from '~icons/lucide/sun'
import IconTrash from '~icons/lucide/trash-2'
// Media
import IconVolume from '~icons/lucide/volume-2'
import IconVolumeMute from '~icons/lucide/volume-x'
import IconX from '~icons/lucide/x'
import IconKeyboardCommand from '~icons/mdi/apple-keyboard-command'
import IconKick from '~icons/simple-icons/kick'
import IconTwitch from '~icons/simple-icons/twitch'

export const icons = {
  // Brands
  brands: {
    twitch: IconTwitch,
    kick: IconKick
  },

  // Actions
  actions: {
    play: IconPlay,
    playCircle: IconPlayCircle,
    pause: IconPause,
    skipForward: IconSkipForward,
    skipBack: IconSkipBack,
    trash: IconTrash,
    rotateCcw: IconRotateCcw,
    externalLink: IconExternalLink,
    logOut: IconLogOut
  },

  // Media
  media: {
    volume: IconVolume,
    volumeMute: IconVolumeMute
  },

  // Navigation
  navigation: {
    list: IconList,
    history: IconHistory,
    settings: IconSettings,
    info: IconInfo,
    bookOpen: IconBookOpen,
    messageSquare: IconMessageSquare,
    palette: IconPalette,
    inbox: IconInbox
  },

  // Status
  status: {
    lock: IconLock,
    lockOpen: IconLockOpen,
    clock: IconClock,
    alertCircle: IconAlertCircle,
    alertTriangle: IconAlertTriangle,
    check: IconCheck
  },

  // UI Controls
  ui: {
    chevronDown: IconChevronDown,
    chevronUp: IconChevronUp,
    chevronLeft: IconChevronLeft,
    chevronRight: IconChevronRight,
    chevronsUpDown: IconChevronsUpDown,
    x: IconX,
    search: IconSearch,
    circle: IconCircle,
    menu: IconMenu,
    keyboardCommand: IconKeyboardCommand
  },

  // Theme
  theme: {
    sun: IconSun,
    moon: IconMoon
  }
} as const

// Flat exports for convenience
export const {
  brands: { twitch: BrandTwitch, kick: BrandKick },
  actions: {
    play: ActionPlay,
    playCircle: ActionPlayCircle,
    pause: ActionPause,
    skipForward: ActionSkipForward,
    skipBack: ActionSkipBack,
    trash: ActionTrash,
    rotateCcw: ActionRotateCcw,
    externalLink: ActionExternalLink,
    logOut: ActionLogOut
  },
  media: { volume: MediaVolume, volumeMute: MediaVolumeMute },
  navigation: {
    list: NavList,
    history: NavHistory,
    settings: NavSettings,
    info: NavInfo,
    bookOpen: NavBookOpen,
    messageSquare: NavMessageSquare,
    palette: NavPalette,
    inbox: NavInbox
  },
  status: {
    lock: StatusLock,
    lockOpen: StatusLockOpen,
    clock: StatusClock,
    alertCircle: StatusAlertCircle,
    alertTriangle: StatusAlertTriangle,
    check: StatusCheck
  },
  ui: {
    chevronDown: UiChevronDown,
    chevronUp: UiChevronUp,
    chevronLeft: UiChevronLeft,
    chevronRight: UiChevronRight,
    chevronsUpDown: UiChevronsUpDown,
    x: UiX,
    search: UiSearch,
    circle: UiCircle,
    menu: UiMenu,
    keyboardCommand: UiKeyboardCommand
  },
  theme: { sun: ThemeSun, moon: ThemeMoon }
} = icons

// Router icon mapping (matches route meta icon keys)
export const routeIcons = {
  list: NavList,
  history: NavHistory,
  'book-open': NavBookOpen,
  settings: NavSettings,
  info: NavInfo,
  'message-square': NavMessageSquare,
  palette: NavPalette,
  inbox: NavInbox
} as const

export type RouteIconKey = keyof typeof routeIcons
