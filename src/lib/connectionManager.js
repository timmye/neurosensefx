// Singleton instance for all displays
let sharedInstance = null;

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

  handleOpen() {
    console.log('WebSocket connected'); this.status = 'connected'; this.reconnectAttempts = 0; this.reconnectDelay = 1000;
    this.resubscribeAll(); this.notifyStatusChange();
  }

  handleClose() {
    this.status = 'disconnected'; this.notifyStatusChange();
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

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'get_symbol_data_package', symbol, adrLookbackDays: adr, source }));
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

  resubscribeAll() {
    for (const [key] of this.subscriptions) {
      const [symbol, source] = key.split(':');
      const adr = this.subscriptionAdr.get(key) || 14;
      this.ws.send(JSON.stringify({ type: 'get_symbol_data_package', symbol, adrLookbackDays: adr, source }));
    }
  }

  resubscribeSymbol(symbol, source) {
    const key = this.makeKey(symbol, source);
    if (this.ws?.readyState === WebSocket.OPEN && this.subscriptions.has(key)) {
      const adr = this.subscriptionAdr.get(key) || 14;
      this.ws.send(JSON.stringify({ type: 'get_symbol_data_package', symbol, adrLookbackDays: adr, source }));
    }
  }

  disconnect() { this.maxReconnects = 0; if (this.ws) this.ws.close(); }

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