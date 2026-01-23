// SubscriptionManager - WebSocket subscription management and message dispatch
// Map/Set provides O(1) subscription lookup. Source-aware keys enable multi-source FX.
export class SubscriptionManager {
  constructor() {
    this.subscriptions = new Map();
    this.subscriptionAdr = new Map();
    this.pendingSubscriptions = [];
  }

  makeKey(symbol, source) {
    return `${symbol}:${source}`;
  }

  subscribe(key, callback, adr) {
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
      this.subscriptionAdr.set(key, adr);
    }
    const callbacks = this.subscriptions.get(key);
    if (callbacks.has(callback)) return () => {};
    callbacks.add(callback);
    return () => this.unsubscribe(key, callback);
  }

  unsubscribe(key, callback) {
    const callbacks = this.subscriptions.get(key);
    if (!callbacks) return;
    callbacks.delete(callback);
    if (callbacks.size === 0) {
      this.subscriptions.delete(key);
      this.subscriptionAdr.delete(key);
    }
  }

  sendSubscription(ws, subscription) {
    const { symbol, adr, source } = subscription;
    if (ws?.readyState === WebSocket.OPEN) {
      const payload = { type: 'get_symbol_data_package', symbol, adrLookbackDays: adr, source };
      try {
        ws.send(JSON.stringify(payload));
      } catch (error) {
        console.error(`[SubscriptionManager] Failed to send for ${symbol}:`, error);
      }
    } else {
      console.log(`[SubscriptionManager] Queueing subscription for ${symbol}`);
      this.pendingSubscriptions.push(subscription);
    }
  }

  flushPending(ws) {
    if (this.pendingSubscriptions.length === 0) return;
    console.log(`[SubscriptionManager] Sending ${this.pendingSubscriptions.length} pending`);
    for (const sub of this.pendingSubscriptions) {
      this.sendSubscription(ws, sub);
    }
    this.pendingSubscriptions = [];
  }

  dispatch(message) {
    const isSystem = message.type === 'status' || message.type === 'ready' ||
      message.type === 'reinit_started' || (message.type === 'error' && message.symbol === 'system');
    if (isSystem) {
      this.subscriptions.forEach((callbacks) => {
        callbacks.forEach((cb) => {
          try { cb(message); } catch (e) { console.error('System msg error:', e); }
        });
      });
      return;
    }
    const key = message.source ? this.makeKey(message.symbol, message.source) : message.symbol;
    const callbacks = this.subscriptions.get(key);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try { cb(message); } catch (e) { console.error(`Callback error for ${key}:`, e); }
      });
    }
  }

  async resubscribeAll(ws) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const keys = Array.from(this.subscriptions.keys());
    for (let i = 0; i < keys.length; i++) {
      if (!ws || ws.readyState !== WebSocket.OPEN) break;
      const [symbol, source] = keys[i].split(':');
      const adr = this.subscriptionAdr.get(keys[i]) || 14;
      this.sendSubscription(ws, { symbol, adr, source });
      if (i < keys.length - 1) await new Promise(r => setTimeout(r, 400));
    }
  }

  resubscribeSymbol(ws, symbol, source) {
    const key = this.makeKey(symbol, source);
    if (!ws || ws.readyState !== WebSocket.OPEN || !this.subscriptions.has(key)) return;
    const adr = this.subscriptionAdr.get(key) || 14;
    this.sendSubscription(ws, { symbol, adr, source });
  }

  getSubscriptionCount() {
    return this.subscriptions.size;
  }
}
