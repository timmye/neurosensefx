// Singleton ConnectionManager facade - delegates to specialized modules
let sharedInstance = null;

import { ConnectionHandler } from './connection/connectionHandler.js';
import { SubscriptionManager } from './connection/subscriptionManager.js';
import { ReconnectionHandler } from './connection/reconnectionHandler.js';
export class ConnectionManager {
  constructor(url) {
    this.url = url;
    this.connectionHandler = new ConnectionHandler(url);
    this.subscriptionManager = new SubscriptionManager();
    this.reconnectionHandler = new ReconnectionHandler();
    this.pendingMessages = [];
    this._pendingFlushed = false;
    this.statusCallbacks = new Set();
    this.reconnectTimeout = null;
    this.reconnectScheduled = false;
    // Timeout for backend 'ready' message after WebSocket connects
    this._readyTimeout = null;
    this._readyTimeoutMs = 15000;
    if (typeof document !== 'undefined') {
        this.isTabVisible = !document.hidden;
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
    }
  }

  static getInstance(url) {
    if (!sharedInstance) {
      sharedInstance = new ConnectionManager(url);
    }
    return sharedInstance;
  }

  async connect(fromReconnect = false) {
    // Only clear the reconnect timeout if this is NOT called from the scheduled reconnect itself
    // This prevents visibility changes from canceling exponential backoff
    if (!fromReconnect && this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectScheduled = false;
    this._pendingFlushed = false;
    const h = this.connectionHandler;
    h.onOpen = () => {
      this.reconnectionHandler.resetAttempts();
      // Track if SubscriptionManager has pending subscriptions to flush after ready.
      // Both subscriptionManager.flushPending() and flushPendingMessages() are
      // deferred to the 'ready' handler — the backend drops subscription / candle
      // requests received before its upstream data sources are connected.
      this._skipResubscribe = this.subscriptionManager.hasPending();
      this.notifyStatusChange();
      // Start timeout waiting for backend 'ready' message
      this._startReadyTimeout();
    };
    h.onClose = () => {
      this._clearReadyTimeout();
      this.tryScheduleReconnect();
      this.notifyStatusChange();
    };
    h.onError = (e) => {
      console.error('[ConnectionManager] WebSocket error:', e);
      this._clearReadyTimeout();
      this.tryScheduleReconnect();
      this.notifyStatusChange();
    };
    h.onStale = () => {
      this._clearReadyTimeout();
      this.tryScheduleReconnect();
      this.notifyStatusChange();
    };
    h.onMessage = (d) => {
      if (d.type === 'status') {
        this.notifyStatusChange();
      }
      // Resubscribe when backend is ready (after cTrader/TradingView reconnection)
      // Skip if flushPending already sent subscriptions on this connection.
      // sendRaw-queued messages always flush here (after ready) — they cannot
      // be safely delivered before the backend's upstream sources are live.
      if (d.type === 'ready') {
        this._clearReadyTimeout();
        // Flush both queues NOW — backend is ready to receive. Pre-ready flushes
        // are dropped silently because upstream data sources aren't connected yet.
        this.subscriptionManager.flushPending(h.getWebSocket());
        this.flushPendingMessages();
        if (this._skipResubscribe) {
          this._skipResubscribe = false;
        } else {
          this.resubscribeAll();
        }
      }
      this.subscriptionManager.dispatch(d);
    };
    h.connect();
  }

  _startReadyTimeout() {
    this._clearReadyTimeout();
    this._readyTimeout = setTimeout(() => {
      this._readyTimeout = null;
      console.warn('[ConnectionManager] Backend ready timeout - no ready message after ' + (this._readyTimeoutMs / 1000) + 's, triggering reconnect');
      this.tryScheduleReconnect();
    }, this._readyTimeoutMs);
  }

  _clearReadyTimeout() {
    if (this._readyTimeout) {
      clearTimeout(this._readyTimeout);
      this._readyTimeout = null;
    }
  }

  tryScheduleReconnect() {
    if (this.reconnectionHandler.shouldReconnect() && !this.reconnectScheduled) {
      this.reconnectScheduled = true;
      const attempts = this.reconnectionHandler.incrementAttempts();
      const delay = this.reconnectionHandler.getDelay(attempts);
      this.scheduleReconnect(delay);
    }
  }

  scheduleReconnect(delay) {
    this.reconnectScheduled = true;
    if (!this.isTabVisible) {
        // Use longer delay when tab is hidden instead of pausing completely
        const hiddenDelay = Math.min(delay * 2, 30000); // Cap at 30s
        this.reconnectTimeout = setTimeout(() => {
          this.reconnectScheduled = false;
          this.connect(true);
        }, hiddenDelay);
        return;
    }
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectScheduled = false;
      this.connect(true);
    }, delay);
  }

  handleVisibilityChange() {
    const wasHidden = !this.isTabVisible;
    this.isTabVisible = !document.hidden;

    // When tab becomes visible, only reconnect if we're NOT already in the middle of a reconnection cycle
    // This prevents interrupting exponential backoff
    if (this.isTabVisible && wasHidden && this.connectionHandler.isDisconnected() && !this.reconnectTimeout) {
        this.connect(false);
    }
  }

  async resubscribeAll() {
    const ws = this.connectionHandler.getWebSocket();
    await this.subscriptionManager.resubscribeAll(ws);
  }

  subscribeAndRequest(symbol, callback, adr = 14, source = 'ctrader') {
    const ws = this.connectionHandler.getWebSocket();
    const key = this.subscriptionManager.makeKey(symbol, source);
    const unsubscribe = this.subscriptionManager.subscribe(key, callback, adr);

    this.subscriptionManager.sendSubscription(ws, { symbol, adr, source });

    return unsubscribe;
  }

  disconnect() {
    this._clearReadyTimeout();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectionHandler.permanentDisconnect();
    this.connectionHandler.disconnect();
  }

  sendRaw(message) {
    const ws = this.connectionHandler.getWebSocket();
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      if (import.meta.env.DEV) {
        console.warn('[ConnectionManager] sendRaw() queued (WebSocket not open):', message.type);
      }
      // Dedup getHistoricalCandles — only keep latest per symbol+resolution
      if (message.type === 'getHistoricalCandles') {
        const idx = this.pendingMessages.findIndex(
          m => m.type === message.type && m.symbol === message.symbol && m.resolution === message.resolution
        );
        if (idx !== -1) this.pendingMessages.splice(idx, 1);
      }
      // Cap queue to prevent unbounded growth during extended disconnection
      if (this.pendingMessages.length >= 50) {
        this.pendingMessages.shift();
      }
      this.pendingMessages.push(message);
      return false;
    }
    ws.send(JSON.stringify(message));
    return true;
  }

  flushPendingMessages() {
    if (this.pendingMessages.length === 0) return;
    const pending = this.pendingMessages;
    this.pendingMessages = [];
    const ws = this.connectionHandler.getWebSocket();
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      // Re-queue: connection closed between swap and check
      this.pendingMessages = pending;
      return;
    }
    const remaining = [...pending];
    for (const msg of pending) {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        // Re-queue remaining messages (match SubscriptionManager pattern)
        this.pendingMessages.unshift(...remaining);
        return;
      }
      try {
        ws.send(JSON.stringify(msg));
        remaining.shift();
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[ConnectionManager] Failed to flush pending message, re-queuing remaining:', e);
        }
        this.pendingMessages.unshift(...remaining);
        return;
      }
    }
    this._pendingFlushed = true;
  }

  addSystemSubscription(callback) {
    const key = '__SYSTEM__';
    if (!this.subscriptionManager.subscriptions.has(key)) {
      this.subscriptionManager.subscriptions.set(key, new Set());
    }
    this.subscriptionManager.subscriptions.get(key).add(callback);
    return () => {
      this.subscriptionManager.subscriptions.get(key)?.delete(callback);
    };
  }

  addStatusCallback(callback) {
    this.statusCallbacks.add(callback);
    return () => this.statusCallbacks.delete(callback);
  }

  notifyStatusChange() {
    this.statusCallbacks.forEach(cb => {
      try { cb(); } catch (e) { console.error('[CONNECTION_MANAGER] Status callback error:', e); }
    });
  }

  get status() {
    return this.connectionHandler.getStatus();
  }

  get displayStatus() {
    const s = this.status, a = this.reconnectionHandler.getAttempts(), n = this.subscriptionManager.getSubscriptionCount();
    const max = this.reconnectionHandler.maxAttempts;
    if (s === 'disconnected' && a >= max) return n > 0 ? 'Connection failed' : 'Idle';
    if (s === 'error') return 'Connection error';
    if (s === 'connecting') return a === 0 ? 'Connecting...' : `Reconnecting... (${a}/${max})`;
    if (s === 'disconnected' && a > 0) {
      const delay = Math.round(this.reconnectionHandler.getDelay(a - 1) / 1000);
      return `Reconnecting in ${delay}s (${a}/${max})`;
    }
    if (s === 'connected') return n === 0 ? 'Connected (idle)' : `Connected (${n} ${n === 1 ? 'subscription' : 'subscriptions'})`;
    if (s === 'disconnected') return n > 0 ? 'Disconnected' : 'Idle';
    return 'Unknown';
  }

  get hasFlushedPendingMessages() { return this._pendingFlushed; }
}
