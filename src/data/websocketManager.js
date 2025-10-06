/**
 * Enhanced WebSocket Manager
 * Provides robust WebSocket connection management with reconnection, pooling, and monitoring
 */

import { writable, derived } from 'svelte/store';
import { TickSchema } from './schema.js';

// Connection state management
export const connectionState = writable('disconnected'); // disconnected, connecting, connected, error, reconnecting
export const connectionMetrics = writable({
  connectTime: null,
  lastPingTime: null,
  lastPongTime: null,
  reconnectAttempts: 0,
  totalReconnects: 0,
  connectionUptime: 0
});

// Derived stores for convenience
export const isConnected = derived(
  connectionState,
  $state => $state === 'connected'
);

export const isConnecting = derived(
  connectionState,
  $state => $state === 'connecting' || $state === 'reconnecting'
);

export const hasError = derived(
  connectionState,
  $state => $state === 'error'
);

class WebSocketManager {
  constructor(options = {}) {
    this.url = options.url || this.getDefaultUrl();
    this.reconnectEnabled = options.reconnect !== false;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.reconnectDelay = options.reconnectDelay || 1000;
    this.reconnectBackoffMultiplier = options.reconnectBackoffMultiplier || 2;
    this.maxReconnectDelay = options.maxReconnectDelay || 30000;
    this.pingInterval = options.pingInterval || 30000;
    this.connectionTimeout = options.connectionTimeout || 10000;
    
    this.ws = null;
    this.reconnectTimer = null;
    this.pingTimer = null;
    this.connectionTimer = null;
    this.messageQueue = [];
    this.eventHandlers = new Map();
    this.currentReconnectDelay = this.reconnectDelay;
    this.reconnectAttempts = 0;
    
    this.metrics = {
      connectTime: null,
      lastPingTime: null,
      lastPongTime: null,
      reconnectAttempts: 0,
      totalReconnects: 0,
      connectionUptime: 0
    };
  }

  getDefaultUrl() {
    if (import.meta.env.VITE_BACKEND_URL) {
      return import.meta.env.VITE_BACKEND_URL;
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const path = '/ws';
    return `${protocol}//${host}${path}`;
  }

  /**
   * Connect to WebSocket with enhanced error handling
   */
  async connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.log('[WebSocketManager] Already connected or connecting');
      return;
    }

    this.cleanup();
    connectionState.set('connecting');
    
    try {
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
      this.setupConnectionTimeout();
      
      return new Promise((resolve, reject) => {
        this.once('open', () => resolve());
        this.once('error', (error) => reject(error));
      });
    } catch (error) {
      console.error('[WebSocketManager] Failed to create WebSocket:', error);
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Disconnect with cleanup
   */
  disconnect() {
    this.reconnectEnabled = false;
    this.cleanup();
    
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
    
    connectionState.set('disconnected');
    console.log('[WebSocketManager] Disconnected');
  }

  /**
   * Send message with queueing for disconnected state
   */
  send(data) {
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    
    if (this.isConnected()) {
      try {
        this.ws.send(message);
        return true;
      } catch (error) {
        console.error('[WebSocketManager] Failed to send message:', error);
        this.handleError(error);
        return false;
      }
    } else {
      // Queue message for when connection is restored
      this.messageQueue.push(message);
      console.log('[WebSocketManager] Message queued (disconnected):', message);
      return false;
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Setup WebSocket event handlers
   */
  setupEventHandlers() {
    this.ws.onopen = (event) => {
      console.log('[WebSocketManager] Connected');
      this.handleConnect();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('[WebSocketManager] Failed to parse message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log('[WebSocketManager] Closed:', event.code, event.reason);
      this.handleDisconnect(event);
    };

    this.ws.onerror = (error) => {
      console.error('[WebSocketManager] WebSocket error:', error);
      this.handleError(error);
    };
  }

  /**
   * Handle successful connection
   */
  handleConnect() {
    this.reconnectAttempts = 0;
    this.currentReconnectDelay = this.reconnectDelay;
    this.metrics.connectTime = Date.now();
    this.metrics.totalReconnects++;
    
    connectionState.set('connected');
    this.updateMetrics();
    
    // Send queued messages
    this.flushMessageQueue();
    
    // Start ping interval
    this.startPingInterval();
    
    // Emit connect event
    this.emit('open');
  }

  /**
   * Handle incoming messages
   */
  handleMessage(data) {
    // Handle ping/pong
    if (data.type === 'pong') {
      this.metrics.lastPongTime = Date.now();
      this.updateMetrics();
      return;
    }

    // Emit message event
    this.emit('message', data);
  }

  /**
   * Handle connection close
   */
  handleDisconnect(event) {
    this.cleanup();
    
    if (!this.reconnectEnabled) {
      connectionState.set('disconnected');
      this.emit('close', event);
      return;
    }

    // Attempt reconnection if not a manual disconnect
    if (event.code !== 1000) {
      connectionState.set('reconnecting');
      this.scheduleReconnect();
    } else {
      connectionState.set('disconnected');
    }
    
    this.emit('close', event);
  }

  /**
   * Handle connection errors
   */
  handleError(error) {
    connectionState.set('error');
    this.emit('error', error);
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WebSocketManager] Max reconnect attempts reached');
      connectionState.set('error');
      return;
    }

    this.reconnectAttempts++;
    this.metrics.reconnectAttempts = this.reconnectAttempts;
    
    const delay = Math.min(
      this.currentReconnectDelay,
      this.maxReconnectDelay
    );
    
    console.log(`[WebSocketManager] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.currentReconnectDelay *= this.reconnectBackoffMultiplier;
      this.connect().catch(error => {
        console.error('[WebSocketManager] Reconnect failed:', error);
      });
    }, delay);
    
    this.updateMetrics();
  }

  /**
   * Setup connection timeout
   */
  setupConnectionTimeout() {
    this.connectionTimer = setTimeout(() => {
      if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
        console.log('[WebSocketManager] Connection timeout');
        this.ws.close(1006, 'Connection timeout');
      }
    }, this.connectionTimeout);
  }

  /**
   * Start ping interval for connection health monitoring
   */
  startPingInterval() {
    this.pingTimer = setInterval(() => {
      if (this.isConnected()) {
        this.metrics.lastPingTime = Date.now();
        this.send({ type: 'ping' });
        this.updateMetrics();
      }
    }, this.pingInterval);
  }

  /**
   * Flush queued messages
   */
  flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }

  /**
   * Update connection metrics
   */
  updateMetrics() {
    if (this.metrics.connectTime) {
      this.metrics.connectionUptime = Date.now() - this.metrics.connectTime;
    }
    
    connectionMetrics.set({ ...this.metrics });
  }

  /**
   * Cleanup timers and connections
   */
  cleanup() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  /**
   * Event emitter methods
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  once(event, handler) {
    const onceHandler = (...args) => {
      handler(...args);
      this.off(event, onceHandler);
    };
    this.on(event, onceHandler);
  }

  off(event, handler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event, ...args) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`[WebSocketManager] Error in ${event} handler:`, error);
        }
      });
    }
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      state: this.ws?.readyState,
      connected: this.isConnected(),
      url: this.url,
      metrics: { ...this.metrics },
      queuedMessages: this.messageQueue.length
    };
  }
}

// Create singleton instance
export const wsManager = new WebSocketManager();

// Export for testing
export { WebSocketManager };
