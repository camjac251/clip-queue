/**
 * Twitch EventSub WebSocket Client
 * Modern replacement for IRC/tmi.js using official EventSub WebSocket API
 * Handles chat messages, reconnects, and subscription cleanup
 */

import WebSocket from 'ws'
import { z } from 'zod'

export interface EventSubMessage {
  username: string
  text: string
  channel: string
  isModerator: boolean
  isBroadcaster: boolean
  messageId: string
}

export type EventSubMessageHandler = (message: EventSubMessage) => void | Promise<void>
export type EventSubDisconnectHandler = () => void

/**
 * Zod Schema for EventSub WebSocket Messages
 * Validates incoming Twitch EventSub data for security
 */
const EventSubEventSchema = z.object({
  metadata: z.object({
    message_id: z.string(),
    message_type: z.string(),
    message_timestamp: z.string(),
    subscription_type: z.string().optional()
  }),
  payload: z.object({
    session: z
      .object({
        id: z.string(),
        status: z.string(),
        connected_at: z.string(),
        keepalive_timeout_seconds: z.number(),
        reconnect_url: z.string().nullable().optional()
      })
      .optional(),
    subscription: z
      .object({
        id: z.string(),
        status: z.string(),
        type: z.string(),
        version: z.string(),
        cost: z.number(),
        condition: z.record(z.string(), z.string()),
        transport: z.object({
          method: z.string(),
          session_id: z.string()
        }),
        created_at: z.string()
      })
      .optional(),
    event: z
      .object({
        broadcaster_user_id: z.string().optional(),
        broadcaster_user_login: z.string().optional(),
        broadcaster_user_name: z.string().optional(),
        chatter_user_id: z.string().optional(),
        chatter_user_login: z.string().optional(),
        chatter_user_name: z.string().optional(),
        message_id: z.string().optional(),
        message: z
          .object({
            text: z.string(),
            fragments: z.array(
              z.object({
                type: z.string(),
                text: z.string(),
                cheermote: z.unknown().nullable().optional(),
                emote: z.unknown().nullable().optional(),
                mention: z.unknown().nullable().optional()
              })
            )
          })
          .nullable()
          .optional(),
        color: z.string().nullable().optional(),
        badges: z
          .array(
            z.object({
              set_id: z.string(),
              id: z.string(),
              info: z.string()
            })
          )
          .nullable()
          .optional(),
        cheer: z
          .object({
            bits: z.number()
          })
          .nullable()
          .optional(),
        reply: z
          .object({
            parent_message_id: z.string(),
            parent_message_body: z.string(),
            parent_user_id: z.string(),
            parent_user_name: z.string(),
            parent_user_login: z.string(),
            thread_message_id: z.string(),
            thread_user_id: z.string(),
            thread_user_name: z.string(),
            thread_user_login: z.string()
          })
          .nullable()
          .optional()
      })
      .optional()
  })
})

interface EventSubEvent {
  metadata: {
    message_id: string
    message_type: string
    message_timestamp: string
    subscription_type?: string
  }
  payload: {
    session?: {
      id: string
      status: string
      connected_at: string
      keepalive_timeout_seconds: number
      reconnect_url?: string
    }
    subscription?: {
      id: string
      status: string
      type: string
      version: string
      cost: number
      condition: Record<string, string>
      transport: {
        method: string
        session_id: string
      }
      created_at: string
    }
    event?: {
      broadcaster_user_id?: string
      broadcaster_user_login?: string
      broadcaster_user_name?: string
      chatter_user_id?: string
      chatter_user_login?: string
      chatter_user_name?: string
      message_id?: string
      message?: {
        text: string
        fragments: Array<{
          type: string
          text: string
          cheermote?: unknown
          emote?: unknown
          mention?: unknown
        }>
      }
      color?: string
      badges?: Array<{
        set_id: string
        id: string
        info: string
      }>
      cheer?: {
        bits: number
      }
      reply?: {
        parent_message_id: string
        parent_message_body: string
        parent_user_id: string
        parent_user_name: string
        parent_user_login: string
        thread_message_id: string
        thread_user_id: string
        thread_user_name: string
        thread_user_login: string
      }
    }
  }
}

export class TwitchEventSubClient {
  private ws: WebSocket | null = null
  private sessionId: string | null = null
  private channelId: string | null = null
  private userId: string | null = null
  private accessToken: string
  private clientId: string
  private messageHandlers: Set<EventSubMessageHandler> = new Set()
  private disconnectHandlers: Set<EventSubDisconnectHandler> = new Set()
  private keepaliveTimer: NodeJS.Timeout | null = null
  private keepaliveTimeoutMs: number = 10000
  private reconnectUrl: string | null = null
  private sessionReadyResolve: ((value: void) => void) | null = null
  private isConnecting: boolean = false

  constructor(clientId: string, accessToken: string) {
    this.clientId = clientId
    this.accessToken = accessToken
  }

  /**
   * Connect to Twitch EventSub WebSocket
   * Establishes session and waits for welcome message containing session ID
   */
  async connect(): Promise<void> {
    if (this.isConnecting) return
    if (this.ws?.readyState === WebSocket.OPEN) return

    this.isConnecting = true
    const url = this.reconnectUrl || 'wss://eventsub.wss.twitch.tv/ws'
    console.log(`[EventSub] Connecting to ${url}`)

    const sessionReadyPromise = new Promise<void>((resolve) => {
      this.sessionReadyResolve = resolve
    })

    this.ws = new WebSocket(url)

    this.ws.on('open', () => {
      console.log('[EventSub] WebSocket opened')
    })

    this.ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(data.toString())
    })

    this.ws.on('close', (code: number, reason: Buffer) => {
      console.log(`[EventSub] WebSocket closed: ${code} ${reason.toString()}`)
      this.isConnecting = false
      this.cleanup()
    })

    this.ws.on('error', (error: Error) => {
      console.error('[EventSub] WebSocket error:', error)
      this.isConnecting = false
    })

    await sessionReadyPromise
    this.isConnecting = false
  }

  /**
   * Subscribe to channel chat messages
   * Cleans up orphaned subscriptions then creates new subscription for channel.chat.message
   */
  async subscribeToChannel(channelLogin: string): Promise<void> {
    if (!this.sessionId) throw new Error('No session ID - must connect first')

    const channelData = await this.getTwitchUser(channelLogin)
    if (!channelData) throw new Error(`Channel not found: ${channelLogin}`)

    this.channelId = channelData.id
    this.userId = channelData.id

    await this.cleanupOldSubscriptions()
    await this.createSubscription('channel.chat.message', {
      broadcaster_user_id: this.channelId,
      user_id: this.userId
    })

    console.log(`[EventSub] Subscribed to chat: ${channelLogin} (${this.channelId})`)
  }

  private async cleanupOldSubscriptions(): Promise<void> {
    try {
      const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
        headers: {
          'Client-ID': this.clientId,
          Authorization: `Bearer ${this.accessToken}`
        }
      })

      if (!response.ok) return

      const data = (await response.json()) as {
        data: Array<{ id: string; status: string; type: string }>
      }

      const staleStatuses = [
        'websocket_disconnected',
        'authorization_revoked',
        'notification_failures_exceeded',
        'user_removed'
      ]
      const staleSubscriptions = data.data.filter((sub) => staleStatuses.includes(sub.status))

      for (const sub of staleSubscriptions) {
        await this.deleteSubscription(sub.id)
      }

      if (staleSubscriptions.length > 0) {
        console.log(`[EventSub] Cleaned up ${staleSubscriptions.length} orphaned subscriptions`)
      }
    } catch (error) {
      console.warn('[EventSub] Subscription cleanup failed:', error)
    }
  }

  private async deleteSubscription(subscriptionId: string): Promise<void> {
    const response = await fetch(
      `https://api.twitch.tv/helix/eventsub/subscriptions?id=${subscriptionId}`,
      {
        method: 'DELETE',
        headers: {
          'Client-ID': this.clientId,
          Authorization: `Bearer ${this.accessToken}`
        }
      }
    )

    if (!response.ok) {
      console.warn(`[EventSub] Failed to delete subscription ${subscriptionId}: ${response.status}`)
    }
  }

  /** Register handler for incoming chat messages */
  onMessage(handler: EventSubMessageHandler): void {
    this.messageHandlers.add(handler)
  }

  /** Unregister message handler */
  offMessage(handler: EventSubMessageHandler): void {
    this.messageHandlers.delete(handler)
  }

  /** Register handler for disconnect events */
  onDisconnect(handler: EventSubDisconnectHandler): void {
    this.disconnectHandlers.add(handler)
  }

  /** Unregister disconnect handler */
  offDisconnect(handler: EventSubDisconnectHandler): void {
    this.disconnectHandlers.delete(handler)
  }

  /** Disconnect from EventSub and cleanup resources */
  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }
    this.cleanup()
  }

  /** Check if WebSocket is currently connected */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  private handleMessage(data: string): void {
    try {
      // Parse and validate incoming WebSocket message
      const rawData = JSON.parse(data)
      const validationResult = EventSubEventSchema.safeParse(rawData)

      if (!validationResult.success) {
        console.error('[EventSub] Invalid message format:', validationResult.error)
        return
      }

      const event = validationResult.data as EventSubEvent
      const messageType = event.metadata.message_type

      switch (messageType) {
        case 'session_welcome':
          this.handleWelcome(event)
          break
        case 'session_keepalive':
          this.handleKeepalive()
          break
        case 'notification':
          this.handleNotification(event)
          break
        case 'session_reconnect':
          this.handleReconnect(event)
          break
        case 'revocation':
          console.warn('[EventSub] Subscription revoked:', event.payload)
          break
        default:
          console.log(`[EventSub] Unknown message type: ${messageType}`)
      }
    } catch (error) {
      console.error('[EventSub] Failed to parse message:', error)
    }
  }

  private handleWelcome(event: EventSubEvent): void {
    const session = event.payload.session
    if (!session) return

    this.sessionId = session.id
    this.reconnectUrl = session.reconnect_url || null
    this.keepaliveTimeoutMs = session.keepalive_timeout_seconds * 1000
    this.resetKeepaliveTimer()

    console.log(`[EventSub] Session established: ${this.sessionId}`)

    if (this.sessionReadyResolve) {
      this.sessionReadyResolve()
      this.sessionReadyResolve = null
    }
  }

  private handleKeepalive(): void {
    this.resetKeepaliveTimer()
  }

  private handleNotification(event: EventSubEvent): void {
    this.resetKeepaliveTimer()

    const subscriptionType = event.metadata.subscription_type
    const eventData = event.payload.event

    if (subscriptionType === 'channel.chat.message' && eventData) {
      this.handleChatMessage(eventData)
    }
  }

  private handleChatMessage(eventData: EventSubEvent['payload']['event']): void {
    if (!eventData?.message?.text) return

    const isModerator = eventData.badges?.some((b) => b.set_id === 'moderator') || false
    const isBroadcaster = eventData.badges?.some((b) => b.set_id === 'broadcaster') || false

    const message: EventSubMessage = {
      username: eventData.chatter_user_login || 'unknown',
      text: eventData.message.text,
      channel: eventData.broadcaster_user_login || '',
      isModerator,
      isBroadcaster,
      messageId: eventData.message_id || ''
    }

    for (const handler of this.messageHandlers) {
      try {
        handler(message)
      } catch (error) {
        console.error('[EventSub] Message handler error:', error)
      }
    }
  }

  /**
   * Handle server-requested reconnect
   * Connects to new URL first - subscriptions transfer automatically, old connection closes
   */
  private handleReconnect(event: EventSubEvent): void {
    const reconnectUrl = event.payload.session?.reconnect_url
    if (!reconnectUrl) return

    console.log(`[EventSub] Server-initiated reconnect`)
    this.reconnectUrl = reconnectUrl
    this.connect().catch((error) => console.error('[EventSub] Reconnect failed:', error))
  }

  private resetKeepaliveTimer(): void {
    if (this.keepaliveTimer) clearTimeout(this.keepaliveTimer)

    this.keepaliveTimer = setTimeout(() => {
      console.warn('[EventSub] Keepalive timeout - no messages received')
      this.disconnect()
    }, this.keepaliveTimeoutMs + 1000)
  }

  private async createSubscription(
    type: string,
    condition: Record<string, string>
  ): Promise<void> {
    const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
      method: 'POST',
      headers: {
        'Client-ID': this.clientId,
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type,
        version: '1',
        condition,
        transport: {
          method: 'websocket',
          session_id: this.sessionId
        }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to create subscription: ${response.status} ${error}`)
    }

    const data = await response.json()
    console.log(`[EventSub] Created subscription:`, data)
  }

  private async getTwitchUser(login: string): Promise<{ id: string; login: string } | null> {
    const response = await fetch(`https://api.twitch.tv/helix/users?login=${login}`, {
      headers: {
        'Client-ID': this.clientId,
        Authorization: `Bearer ${this.accessToken}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[EventSub] Failed to get user ${login}: ${response.status} ${response.statusText}`)
      console.error(`[EventSub] Response: ${errorText}`)
      return null
    }

    const data = (await response.json()) as { data: Array<{ id: string; login: string }> }
    return data.data[0] || null
  }

  private cleanup(): void {
    if (this.keepaliveTimer) {
      clearTimeout(this.keepaliveTimer)
      this.keepaliveTimer = null
    }
    this.sessionId = null
    this.sessionReadyResolve = null

    for (const handler of this.disconnectHandlers) {
      try {
        handler()
      } catch (error) {
        console.error('[EventSub] Disconnect handler error:', error)
      }
    }
  }
}
