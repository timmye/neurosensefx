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
    this.statusCallbacks = new Set();
    this.reconnectTimeout = null;
    this.reconnectScheduled = false;
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

  connect(fromReconnect = false) {
    // Only clear the reconnect timeout if this is NOT called from the scheduled reconnect itself
    // This prevents visibility changes from canceling exponential backoff
    if (!fromReconnect && this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectScheduled = false;
    const h = this.connectionHandler;
    h.onOpen = () => {
      this.reconnectionHandler.resetAttempts();
      // Track if flushPending will handle initial subscriptions
      this._skipResubscribe = this.subscriptionManager.hasPending();
      this.subscriptionManager.flushPending(h.getWebSocket());
      this.notifyStatusChange();
    };
    h.onClose = () => {
      this.tryScheduleReconnect();
      this.notifyStatusChange();
    };
    h.onError = (e) => {
      console.error('[ConnectionManager] WebSocket error:', e);
      this.tryScheduleReconnect();
      this.notifyStatusChange();
    };
    h.onStale = () => {
      this.tryScheduleReconnect();
      this.notifyStatusChange();
    };
    h.onMessage = (d) => {
      if (d.type === 'status') {
        this.notifyStatusChange();
      }
      // Resubscribe when backend is ready (after cTrader/TradingView reconnection)
      // Skip if flushPending already sent subscriptions on this connection
      if (d.type === 'ready') {
        if (this._skipResubscribe) {
          this._skipResubscribe = false;
          console.log('[ConnectionManager] Skipping resubscribeAll - flushPending already sent subscriptions');
        } else {
          console.log('[ConnectionManager] Backend ready, resubscribing to all symbols');
          this.resubscribeAll();
        }
      }
      this.subscriptionManager.dispatch(d);
    };
    h.connect();
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
        const hiddenDelay = Math.min(delay * 3, 60000); // Cap at 60s
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
        console.warn('[ConnectionManager] sendRaw() called with non-OPEN WebSocket');
      }
      return false;
    }
    ws.send(JSON.stringify(message));
    return true;
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
}
