// Singleton instance for all displays
let sharedInstance = null;

import { createMessageCoordinator } from './websocket/messageCoordinator.js';

export class ConnectionManager {
  constructor(url) {
    this.url = url; this.ws = null; this.subscriptions = new Map();
    this.subscriptionAdr = new Map(); // Track ADR for each symbol
    this.reconnectAttempts = 0; this.maxReconnects = 5; this.reconnectDelay = 1000;
    this.status = 'disconnected';
    // Support multiple callbacks instead of single callback
    this.statusCallbacks = new Set();
  }

  static getInstance(url) {
    if (!sharedInstance) {
      sharedInstance = new ConnectionManager(url);
    }
    return sharedInstance;
  }

  // Helper: create source-aware composite key
  makeKey(symbol, source) {
    return `${symbol}:${source}`;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.ws = new WebSocket(this.url); this.status = 'connecting';
    this.notifyStatusChange();
    this.ws.onopen = () => this.handleOpen();
    this.ws.onclose = () => this.handleClose();
    this.ws.onerror = (e) => { console.error('WebSocket error:', e); this.status = 'error'; this.notifyStatusChange(); };
    this.ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);

        // Handle system-level messages (status, ready, global errors)
        if (d.type === 'status' || d.type === 'ready' || (d.type === 'error' && d.symbol === 'system')) {
          // Broadcast system messages to all subscriptions
          this.subscriptions.forEach((callbacks, key) => {
            if (callbacks && callbacks.size > 0) {
              callbacks.forEach(callback => {
                try {
                  callback(d);
                } catch (error) {
                  console.error(`Callback error for ${key}:`, error);
                }
              });
            }
          });
          return;
        }

        // Use composite key for data messages with source
        const key = d.source ? this.makeKey(d.symbol, d.source) : d.symbol;
        const callbacks = this.subscriptions.get(key);
        if (callbacks && callbacks.size > 0) {
          callbacks.forEach(callback => {
            try {
              callback(d);
            } catch (error) {
              console.error(`Callback error for ${key}:`, error);
            }
          });
        }
      } catch (er) {
        console.error('Message parse error:', er);
      }
    };
  }

  async handleOpen() {
    console.log('WebSocket connected'); this.status = 'connected'; this.reconnectAttempts = 0; this.reconnectDelay = 1000;
    await this.resubscribeAll(); this.notifyStatusChange();
  }

  handleClose() {
    this.status = 'disconnected'; this.notifyStatusChange();
    // Clear stale subscriptions to prevent memory leak on reconnect
    this.subscriptions.clear();
    this.subscriptionAdr.clear();
    if (this.reconnectAttempts < this.maxReconnects) this.scheduleReconnect();
  }

  scheduleReconnect() {
    setTimeout(() => { this.reconnectAttempts++; this.connect(); }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
  }

  subscribeAndRequest(symbol, callback, adr = 14, source = 'ctrader') {
    const key = this.makeKey(symbol, source);
    // Get existing callbacks or create new Set
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
      // Store ADR for this symbol (only on first subscription)
      this.subscriptionAdr.set(key, adr);
    }

    // Add the new callback
    const callbacks = this.subscriptions.get(key);
    callbacks.add(callback);

    // Only send if WebSocket is fully open and message is valid
    if (this.ws?.readyState === WebSocket.OPEN) {
      const payload = { type: 'get_symbol_data_package', symbol, adrLookbackDays: adr, source };
      try {
        const message = JSON.stringify(payload);
        this.ws.send(message);
      } catch (error) {
        console.error(`[CM ERROR] Failed to stringify/send message for ${symbol}:`, error);
      }
    }

    return () => {
      const callbacks = this.subscriptions.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(key);
          this.subscriptionAdr.delete(key);
        }
      }
    };
  }

  subscribeCoordinated(symbol, onAllReceived, onTimeout, adr = 14, source = 'ctrader', timeoutMs = 5000) {
    const coordinator = this.createCoordinator(onAllReceived, onTimeout, timeoutMs);
    const key = this.makeKey(symbol, source);
    this.ensureSubscription(key, adr);

    const callback = this.createCoordinatorCallback(coordinator, symbol);
    this.subscriptions.get(key).add(callback);
    this.sendCoordinatedRequest(symbol, adr, source);

    return () => this.cleanupCoordinated(key, callback, coordinator, symbol);
  }

  createCoordinator(onAllReceived, onTimeout, timeoutMs) {
    const { createMessageCoordinator } = require('./websocket/messageCoordinator.js');
    return createMessageCoordinator({
      requiredTypes: ['symbolDataPackage', 'tick'],
      timeoutMs,
      onAllReceived: (sym, data) => onAllReceived(data.symbolDataPackage, data.tick),
      onTimeout: (sym, partial, received) => onTimeout(partial, received)
    });
  }

  createCoordinatorCallback(coordinator, symbol) {
    return (message) => {
      if (message.type === 'symbolDataPackage' || message.type === 'tick') {
        coordinator.onMessage(symbol, message.type, message);
      }
    };
  }

  ensureSubscription(key, adr) {
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
      this.subscriptionAdr.set(key, adr);
    }
  }

  sendCoordinatedRequest(symbol, adr, source) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const payload = { type: 'get_symbol_data_package', symbol, adrLookbackDays: adr, source };
      try {
        this.ws.send(JSON.stringify(payload));
      } catch (error) {
        console.error(`[CM ERROR] Failed to send coordinated subscription for ${symbol}:`, error);
      }
    }
  }

  cleanupCoordinated(key, callback, coordinator, symbol) {
    const callbacks = this.subscriptions.get(key);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.subscriptions.delete(key);
        this.subscriptionAdr.delete(key);
      }
    }
    coordinator.cleanup(symbol);
  }

  async resubscribeAll() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('[CM RESUB] WebSocket not open, skipping resubscribeAll');
      return;
    }

    const REQUEST_DELAY_MS = 400;
    let index = 0;

    for (const [key] of this.subscriptions) {
      const [symbol, source] = key.split(':');
      const adr = this.subscriptionAdr.get(key) || 14;
      const payload = { type: 'get_symbol_data_package', symbol, adrLookbackDays: adr, source };
      try {
        const message = JSON.stringify(payload);
        console.log(`[CM RESUB] Resubscribing to ${symbol} from ${source}`);
        this.ws.send(message);
      } catch (error) {
        console.error(`[CM ERROR] Failed to resubscribe to ${symbol}:`, error);
      }

      // Add delay between messages (except for the last one)
      if (index < this.subscriptions.size - 1) {
        await this.sleep(REQUEST_DELAY_MS);
      }
      index++;
    }
  }

  resubscribeSymbol(symbol, source) {
    const key = this.makeKey(symbol, source);
    if (this.ws?.readyState === WebSocket.OPEN && this.subscriptions.has(key)) {
      const adr = this.subscriptionAdr.get(key) || 14;
      const payload = { type: 'get_symbol_data_package', symbol, adrLookbackDays: adr, source };
      try {
        const message = JSON.stringify(payload);
        console.log(`[CM RESUB] Refreshing subscription for ${symbol} from ${source}`);
        this.ws.send(message);
      } catch (error) {
        console.error(`[CM ERROR] Failed to refresh ${symbol}:`, error);
      }
    } else {
      console.log(`[CM DEFER] Cannot refresh ${symbol} - WebSocket state: ${this.ws?.readyState}`);
    }
  }

  disconnect() { this.maxReconnects = 0; if (this.ws) this.ws.close(); }

  // Helper: Promise-based delay for rate limiting
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Add a status change callback
  addStatusCallback(callback) {
    this.statusCallbacks.add(callback);
    return () => this.statusCallbacks.delete(callback);
  }

  // Notify all registered callbacks
  notifyStatusChange() {
    this.statusCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('[CONNECTION_MANAGER] Status callback error:', error);
      }
    });
  }
}