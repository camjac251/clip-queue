/**
 * WebSocket Store (Socket.io Client)
 *
 * Manages Socket.io connection to the backend server.
 * Handles automatic reconnection and event distribution.
 */

import { defineStore } from 'pinia'
import { io, Socket } from 'socket.io-client'
import { ref } from 'vue'

import { WEBSOCKET_EVENTS } from '@cq/constants/events'

import { emitAuthEvent } from '@/utils/events'
import { useLogger } from './logger'

/**
 * WebSocket connection status
 */
export enum WebSocketStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}

/**
 * WebSocket event handler
 */
export type WebSocketEventHandler = (event: Record<string, unknown>) => void | Promise<void>

/**
 * WebSocket store
 *
 * Manages Socket.io connection to the backend server.
 */
export const useWebSocket = defineStore('websocket', () => {
  const logger = useLogger()

  const status = ref<WebSocketStatus>(WebSocketStatus.DISCONNECTED)
  let socket: Socket | null = null

  // Event handlers
  const eventHandlers = new Map<string, Set<WebSocketEventHandler>>()

  // Socket.io internal listeners (for cleanup)
  let onConnectHandler: (() => void) | null = null
  let onDisconnectHandler: ((reason: string) => void) | null = null
  let onConnectErrorHandler: ((error: Error) => void) | null = null
  let onAnyHandler: ((eventName: string, ...args: unknown[]) => void) | null = null

  // Track if we've had a previous connection (for re-sync on reconnect)
  let hadPreviousConnection = false

  /**
   * Connect to backend server
   * Authentication handled automatically via httpOnly cookies
   */
  function connect(serverUrl?: string): void {
    if (socket && socket.connected) {
      logger.debug('[WebSocket]: Already connected.')
      return
    }

    status.value = WebSocketStatus.CONNECTING
    const url = serverUrl || import.meta.env.VITE_API_URL || 'http://localhost:3000'

    logger.info(`[WebSocket]: Connecting to ${url}`)

    socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      withCredentials: true // Send cookies with connection request
    })

    onConnectHandler = () => {
      status.value = WebSocketStatus.CONNECTED
      logger.info('[WebSocket]: Connected')

      // Request state re-sync on reconnection
      if (hadPreviousConnection && socket) {
        logger.info('[WebSocket]: Requesting state re-sync after reconnection')
        socket.emit(WEBSOCKET_EVENTS.SYNC_REQUEST)
      }
      hadPreviousConnection = true
    }
    socket.on(WEBSOCKET_EVENTS.CONNECT, onConnectHandler)

    onDisconnectHandler = (reason: string) => {
      status.value = WebSocketStatus.DISCONNECTED
      logger.warn(`[WebSocket]: Disconnected - ${reason}`)
    }
    socket.on(WEBSOCKET_EVENTS.DISCONNECT, onDisconnectHandler)

    onConnectErrorHandler = (error: Error) => {
      status.value = WebSocketStatus.ERROR
      logger.error(`[WebSocket]: Connection error: ${error.message}`)

      // If auth-related error, emit auth event for user notification
      const errorMessage = error.message.toLowerCase()
      if (
        errorMessage.includes('authentication') ||
        errorMessage.includes('invalid') ||
        errorMessage.includes('token') ||
        errorMessage.includes('unauthorized')
      ) {
        emitAuthEvent({
          type: 'unauthorized',
          message: 'WebSocket authentication failed. Please log in again.'
        })
      }
    }
    socket.on(WEBSOCKET_EVENTS.CONNECT_ERROR, onConnectErrorHandler)

    // Listen for all server events and dispatch to handlers
    onAnyHandler = (eventName: string, ...args: unknown[]) => {
      const handlers = eventHandlers.get(eventName)
      if (!handlers) return

      const eventData = args[0] as Record<string, unknown>

      for (const handler of handlers) {
        try {
          handler(eventData)
        } catch (error: unknown) {
          logger.error(`[WebSocket]: Event handler error for ${eventName}: ${error}`)
        }
      }
    }
    socket.onAny(onAnyHandler)
  }

  /**
   * Disconnect from server
   */
  function disconnect(): void {
    if (socket) {
      // Remove all event listeners before disconnecting
      if (onConnectHandler) {
        socket.off(WEBSOCKET_EVENTS.CONNECT, onConnectHandler)
        onConnectHandler = null
      }
      if (onDisconnectHandler) {
        socket.off(WEBSOCKET_EVENTS.DISCONNECT, onDisconnectHandler)
        onDisconnectHandler = null
      }
      if (onConnectErrorHandler) {
        socket.off(WEBSOCKET_EVENTS.CONNECT_ERROR, onConnectErrorHandler)
        onConnectErrorHandler = null
      }
      if (onAnyHandler) {
        socket.offAny(onAnyHandler)
        onAnyHandler = null
      }

      socket.disconnect()
      socket = null
    }

    hadPreviousConnection = false
    status.value = WebSocketStatus.DISCONNECTED
    logger.info('[WebSocket]: Disconnected')
  }

  /**
   * Subscribe to server events
   */
  function on(eventType: string, handler: WebSocketEventHandler): void {
    if (!eventHandlers.has(eventType)) {
      eventHandlers.set(eventType, new Set())
    }
    eventHandlers.get(eventType)!.add(handler)
  }

  /**
   * Unsubscribe from server events
   */
  function off(eventType: string, handler: WebSocketEventHandler): void {
    const handlers = eventHandlers.get(eventType)
    if (handlers) {
      handlers.delete(handler)
    }
  }

  /**
   * Send message to server
   */
  function send(eventType: string, data: unknown): void {
    if (!socket || !socket.connected) {
      logger.warn('[WebSocket]: Cannot send, not connected')
      return
    }

    socket.emit(eventType, data)
  }

  return {
    status,
    connect,
    disconnect,
    on,
    off,
    send
  }
})
