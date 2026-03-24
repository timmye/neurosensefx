// Singleton ConnectionManager facade - delegates to specialized modules
let sharedInstance = null;

import { ConnectionHandler } from './connection/connectionHandler.js';
import { SubscriptionManager } from './connection/subscriptionManager.js';
import { ReconnectionHandler } from './connection/reconnectionHandler.js';
import { createMessageCoordinator } from './websocket/messageCoordinator.js';

export class ConnectionManager {
  constructor(url) {
    this.url = url;
    this.connectionHandler = new ConnectionHandler(url);
    this.subscriptionManager = new SubscriptionManager();
    this.reconnectionHandler = new ReconnectionHandler();
    this.statusCallbacks = new Set();
    this.reconnectTimeout = null;
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
    console.log('[DEBUGGER:ConnectionManager:connect:30] Called, fromReconnect=' + fromReconnect + ', isTabVisible=' + this.isTabVisible);
    // Only clear the reconnect timeout if this is NOT called from the scheduled reconnect itself
    // This prevents visibility changes from canceling exponential backoff
    if (!fromReconnect && this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
      console.log('[DEBUGGER:ConnectionManager:connect:35] Cleared existing reconnectTimeout');
    }
    const h = this.connectionHandler;
    h.onOpen = () => {
      console.log('[DEBUGGER:ConnectionManager:onOpen:38] Connection opened, resetting attempts');
      this.reconnectionHandler.resetAttempts();
      this.subscriptionManager.flushPending(h.getWebSocket());
      this.resubscribeAll();
      this.notifyStatusChange();
    };
    h.onClose = () => {
      console.log('[DEBUGGER:ConnectionManager:onClose:44] Connection closed');
      const shouldReconnect = this.reconnectionHandler.shouldReconnect();
      console.log('[DEBUGGER:ConnectionManager:onClose:46] shouldReconnect=' + shouldReconnect);
      if (shouldReconnect) {
        const attempts = this.reconnectionHandler.incrementAttempts();
        const delay = this.reconnectionHandler.getDelay(attempts);
        console.log('[DEBUGGER:ConnectionManager:onClose:50] Scheduling reconnect, attempts=' + attempts + ', delay=' + delay + 'ms');
        this.scheduleReconnect(delay);
      } else {
        console.log('[DEBUGGER:ConnectionManager:onClose:53] Not reconnecting - shouldReconnect returned false');
      }
      this.notifyStatusChange();
    };
    h.onError = (e) => {
      console.error('[DEBUGGER:ConnectionManager:onError:58] WebSocket error:', e);
      // Trigger reconnection on error - errors often precede disconnect
      if (this.reconnectionHandler.shouldReconnect()) {
        const attempts = this.reconnectionHandler.incrementAttempts();
        const delay = this.reconnectionHandler.getDelay(attempts);
        console.log('[DEBUGGER:ConnectionManager:onError:63] Scheduling reconnect after error, attempts=' + attempts + ', delay=' + delay + 'ms');
        this.scheduleReconnect(delay);
      }
      this.notifyStatusChange();
    };
    h.onStale = () => {
      console.log('[DEBUGGER:ConnectionManager:onStale:58] Stale connection detected, triggering reconnection');
      // Trigger reconnection when heartbeat detects stale connection
      if (this.reconnectionHandler.shouldReconnect()) {
        const attempts = this.reconnectionHandler.incrementAttempts();
        const delay = this.reconnectionHandler.getDelay(attempts);
        console.log('[DEBUGGER:ConnectionManager:onStale:63] Scheduling reconnect after stale detection, attempts=' + attempts + ', delay=' + delay + 'ms');
        this.scheduleReconnect(delay);
      } else {
        console.log('[DEBUGGER:ConnectionManager:onStale:66] Not reconnecting - shouldReconnect returned false');
      }
      this.notifyStatusChange();
    };
    h.onMessage = (d) => {
      if (d.type === 'status') {
        this.notifyStatusChange();
      }
      this.subscriptionManager.dispatch(d);
    };
    console.log('[DEBUGGER:ConnectionManager:connect:72] Calling connectionHandler.connect()');
    h.connect();
  }

  scheduleReconnect(delay) {
    console.log('[DEBUGGER:ConnectionManager:scheduleReconnect:67] Called with delay=' + delay + 'ms, isTabVisible=' + this.isTabVisible);
    if (!this.isTabVisible) {
        // Use longer delay when tab is hidden instead of pausing completely
        const hiddenDelay = Math.min(delay * 3, 60000); // Cap at 60s
        console.log('[DEBUGGER:ConnectionManager:scheduleReconnect:70] Tab hidden, using extended delay: ' + hiddenDelay + 'ms');
        this.reconnectTimeout = setTimeout(() => {
          console.log('[DEBUGGER:ConnectionManager:scheduleReconnect:72] Hidden tab reconnect timeout fired, calling connect(true)');
          this.connect(true);
        }, hiddenDelay);
        return;
    }
    console.log('[DEBUGGER:ConnectionManager:scheduleReconnect:75] Scheduling reconnect in ' + delay + 'ms');
    this.reconnectTimeout = setTimeout(() => {
      console.log('[DEBUGGER:ConnectionManager:scheduleReconnect:77] Reconnect timeout fired, calling connect(true)');
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

  subscribeCoordinated(symbol, onAllReceived, onTimeout, adr = 14, source = 'ctrader', timeoutMs = 5000) {
    const coordinator = createMessageCoordinator({
      requiredTypes: ['symbolDataPackage', 'tick'], timeoutMs,
      onAllReceived: (sym, data) => onAllReceived(data.symbolDataPackage, data.tick),
      onTimeout: (sym, partial, received) => onTimeout(partial, received)
    });
    const key = this.subscriptionManager.makeKey(symbol, source);
    const callback = (msg) => {
      if (msg.type === 'symbolDataPackage' || msg.type === 'tick') coordinator.onMessage(symbol, msg.type, msg);
    };
    this.subscriptionManager.subscribe(key, callback, adr);
    this.subscriptionManager.sendSubscription(this.connectionHandler.getWebSocket(), { symbol, adr, source });
    return () => { this.subscriptionManager.unsubscribe(key, callback); coordinator.cleanup(symbol); };
  }

  resubscribeSymbol(symbol, source) {
    const ws = this.connectionHandler.getWebSocket();
    this.subscriptionManager.resubscribeSymbol(ws, symbol, source);
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectionHandler.permanentDisconnect();
    this.connectionHandler.disconnect();
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
