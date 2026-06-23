// SubscriptionManager - WebSocket subscription management and message dispatch
// Map/Set provides O(1) subscription lookup. Source-aware keys enable multi-source FX.

/**
 * Canonical symbol normalization — mirrors the backend
 * (services/tick-backend/MarketProfileService.js `normalizeSymbol`) so a
 * profileUpdate emitted under the canonical (upper-cased, suffix-stripped)
 * symbol matches a subscription stored under any feed's name form. Applied only
 * to profile routing; the tick path is left untouched.
 * @param {string} raw
 * @returns {string}
 */
function normalizeSymbol(raw) {
  if (!raw || typeof raw !== 'string') return raw;
  return raw.toUpperCase().replace(/\//g, '').replace(/\.[A-Za-z]+\d*$/g, '');
}

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
      this.pendingSubscriptions.push(subscription);
    }
  }

  async flushPending(ws) {
    if (this.pendingSubscriptions.length === 0) return;
    const pending = this.pendingSubscriptions;
    this.pendingSubscriptions = [];
    for (let i = 0; i < pending.length; i++) {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        // Re-queue remaining subscriptions
        this.pendingSubscriptions.unshift(...pending.slice(i));
        break;
      }
      this.sendSubscription(ws, pending[i]);
      // Batch in groups of 10 with a short pause between batches
      if ((i + 1) % 10 === 0 && i < pending.length - 1) {
        await new Promise(r => setTimeout(r, 200));
      }
    }
  }

  dispatch(message) {
    const isSystem = message.type === 'status' || message.type === 'ready' ||
      message.type === 'reinit_started' || message.type === 'dailyReset' ||
      message.type === 'candleHistory' || message.type === 'candleUpdate' ||
      (message.type === 'error' && message.symbol === 'system');

    if (isSystem) {
      this.subscriptions.forEach((callbacks) => {
        callbacks.forEach((cb) => {
          try { cb(message); } catch (e) { console.error('System msg error:', e); }
        });
      });
      return;
    }

    // TWAP updates: deliver to every subscriber for the symbol, source-agnostic
    // (TWAP is shared — one value per instrument, broadcast to all sources by the
    // backend). Symbols are normalized so the canonical form emitted by the backend
    // matches a subscription stored under any feed's name form. Tick routing untouched.
    if (message.type === 'twapUpdate') {
      const normSym = normalizeSymbol(message.symbol);
      const delivered = new Set();
      for (const [key, callbacks] of this.subscriptions) {
        const sep = key.indexOf(':');
        const kSym = sep === -1 ? key : key.slice(0, sep);
        if (normalizeSymbol(kSym) === normSym) {
          callbacks.forEach((cb) => {
            if (!delivered.has(cb)) {
              delivered.add(cb);
              try { cb(message); } catch (e) { console.error(`twapUpdate callback error for ${key}:`, e); }
            }
          });
        }
      }
      return;
    }

    // Profile updates: deliver to every subscriber for the symbol, source-agnostic
    // (profile data is shared — one canonical profile per instrument, populated by
    // both feeds). Symbols are normalized so the canonical form emitted by the
    // backend matches a subscription stored under any feed's name form (case or
    // suffix). Tick routing is untouched.
    if (message.type === 'profileUpdate') {
      const normSym = normalizeSymbol(message.symbol);
      const delivered = new Set();
      for (const [key, callbacks] of this.subscriptions) {
        const sep = key.indexOf(':');
        const kSym = sep === -1 ? key : key.slice(0, sep);
        if (normalizeSymbol(kSym) === normSym) {
          callbacks.forEach((cb) => {
            if (!delivered.has(cb)) {
              delivered.add(cb);
              try { cb(message); } catch (e) { console.error(`profileUpdate callback error for ${key}:`, e); }
            }
          });
        }
      }
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
    const keys = Array.from(this.subscriptions.keys()).filter(k => k !== '__SYSTEM__');
    for (let i = 0; i < keys.length; i++) {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        // Re-queue remaining subscriptions so they aren't lost on reconnect
        for (let j = i; j < keys.length; j++) {
          const [symbol, source] = keys[j].split(':');
          const adr = this.subscriptionAdr.get(keys[j]) || 14;
          this.pendingSubscriptions.push({ symbol, adr, source });
        }
        break;
      }
      const [symbol, source] = keys[i].split(':');
      const adr = this.subscriptionAdr.get(keys[i]) || 14;
      this.sendSubscription(ws, { symbol, adr, source });
      // Batch in groups of 10 with a short pause between batches
      if ((i + 1) % 10 === 0 && i < keys.length - 1) {
        await new Promise(r => setTimeout(r, 200));
      }
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

  hasPending() {
    return this.pendingSubscriptions.length > 0;
  }
}
