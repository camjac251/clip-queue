/**
 * WebSocket Event Constants
 * Centralized event names for Socket.io communication
 */

export const WEBSOCKET_EVENTS = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',

  // Sync events
  SYNC_STATE: 'sync:state',
  SYNC_REQUEST: 'sync:request',

  // Clip events
  CLIP_ADDED: 'clip:added',
  CLIP_REMOVED: 'clip:removed',

  // Queue events
  QUEUE_CURRENT: 'queue:current',
  QUEUE_CLEARED: 'queue:cleared',
  QUEUE_OPENED: 'queue:opened',
  QUEUE_CLOSED: 'queue:closed',

  // History events
  HISTORY_CLEARED: 'history:cleared',

  // Settings events
  SETTINGS_UPDATED: 'settings:updated'
} as const

export type WebSocketEvent = typeof WEBSOCKET_EVENTS[keyof typeof WEBSOCKET_EVENTS]
