import { io, Socket } from 'socket.io-client'

export interface WebSocketEvents {
  'service-status': (data: { serviceId: string; status: string; metrics: any }) => void
  'log-entry': (data: { level: string; service: string; message: string; timestamp: string }) => void
  'system-alert': (data: { type: string; message: string; severity: string }) => void
  'health-check': (data: { serviceId: string; healthy: boolean; responseTime: number }) => void
}

class WebSocketManager {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  connect(url: string = 'http://localhost:4000'): Socket {
    if (this.socket?.connected) {
      return this.socket
    }

    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay
    })

    this.setupEventHandlers()
    return this.socket
  }

  private setupEventHandlers() {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('WebSocket connected')
      this.reconnectAttempts = 0
    })

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
    })

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      this.reconnectAttempts++

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached')
      }
    })

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`WebSocket reconnected after ${attemptNumber} attempts`)
      this.reconnectAttempts = 0
    })
  }

  subscribe<K extends keyof WebSocketEvents>(
    event: K,
    callback: WebSocketEvents[K]
  ) {
    if (!this.socket) {
      throw new Error('WebSocket not connected. Call connect() first.')
    }

    this.socket.on(event, callback as any)

    return () => {
      this.socket?.off(event, callback as any)
    }
  }

  emit(event: string, data: any) {
    if (!this.socket?.connected) {
      console.warn('Cannot emit event: WebSocket not connected')
      return
    }

    this.socket.emit(event, data)
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false
  }

  getSocket(): Socket | null {
    return this.socket
  }
}

export const wsManager = new WebSocketManager()

// React hook for WebSocket
export function useWebSocket(url?: string) {
  const connect = () => wsManager.connect(url)
  const disconnect = () => wsManager.disconnect()
  const subscribe = wsManager.subscribe.bind(wsManager)
  const emit = wsManager.emit.bind(wsManager)
  const isConnected = () => wsManager.isConnected()

  return {
    connect,
    disconnect,
    subscribe,
    emit,
    isConnected
  }
}