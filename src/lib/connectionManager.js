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
  }

  static getInstance(url) {
    if (!sharedInstance) {
      sharedInstance = new ConnectionManager(url);
    }
    return sharedInstance;
  }

  connect() {
    const h = this.connectionHandler;
    h.onOpen = () => {
      this.reconnectionHandler.resetAttempts();
      this.subscriptionManager.flushPending(h.getWebSocket());
      this.resubscribeAll();
      this.notifyStatusChange();
    };
    h.onClose = () => {
      if (this.reconnectionHandler.shouldReconnect()) {
        this.scheduleReconnect(this.reconnectionHandler.getDelay(this.reconnectionHandler.incrementAttempts()));
      }
      this.notifyStatusChange();
    };
    h.onError = (e) => { console.error('WebSocket error:', e); this.notifyStatusChange(); };
    h.onMessage = (d) => this.subscriptionManager.dispatch(d);
    h.connect();
  }

  scheduleReconnect(delay) {
    setTimeout(() => this.connect(), delay);
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
