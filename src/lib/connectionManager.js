// Singleton instance for all displays
let sharedInstance = null;

export class ConnectionManager {
  constructor(url) {
    this.url = url; this.ws = null; this.subscriptions = new Map();
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
        console.log(`[DEBUGGER:ConnectionManager] Received message type: ${d.type}, symbol: ${d.symbol}`);

        // Handle system-level messages (status, ready, global errors)
        if (d.type === 'status' || d.type === 'ready' || (d.type === 'error' && d.symbol === 'system')) {
          console.log(`[DEBUGGER:ConnectionManager] Processing system message: ${d.type}`);
          // Broadcast system messages to all subscriptions
          this.subscriptions.forEach((callbacks, symbol) => {
            if (callbacks && callbacks.size > 0) {
              console.log(`[DEBUGGER:ConnectionManager] Broadcasting system message to ${symbol} subscribers (${callbacks.size} callbacks)`);
              callbacks.forEach(callback => {
                try {
                  callback(d);
                } catch (error) {
                  console.error(`[DEBUGGER:ConnectionManager] Callback error for ${symbol}:`, error);
                }
              });
            }
          });
          return;
        }

        console.log(`[DEBUGGER:ConnectionManager] Looking up subscription for symbol: ${d.symbol}`);
        console.log(`[DEBUGGER:ConnectionManager] Available subscriptions:`, Array.from(this.subscriptions.keys()));
        const callbacks = this.subscriptions.get(d.symbol);
        if (callbacks && callbacks.size > 0) {
          console.log(`[DEBUGGER:ConnectionManager] Found ${callbacks.size} subscription(s), calling callbacks for ${d.symbol}`);
          callbacks.forEach(callback => {
            try {
              callback(d);
            } catch (error) {
              console.error(`[DEBUGGER:ConnectionManager] Callback error for ${d.symbol}:`, error);
            }
          });
        } else {
          console.log(`[DEBUGGER:ConnectionManager] No subscription found for symbol: ${d.symbol}`);
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

  subscribeAndRequest(symbol, callback, adr = 14) {
    console.log(`[DEBUGGER:ConnectionManager] subscribeAndRequest called for ${symbol}`);

    // Get existing callbacks or create new Set
    if (!this.subscriptions.has(symbol)) {
      this.subscriptions.set(symbol, new Set());
    }

    // Add the new callback
    const callbacks = this.subscriptions.get(symbol);
    callbacks.add(callback);

    console.log(`[DEBUGGER:ConnectionManager] Subscription stored. ${callbacks.size} callback(s) for ${symbol}. Total subscriptions: ${this.subscriptions.size}`);
    console.log(`[DEBUGGER:ConnectionManager] WebSocket state: ${this.ws?.readyState} (OPEN=${WebSocket.OPEN})`);

    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log(`[DEBUGGER:ConnectionManager] Sending request for ${symbol}`);
      this.ws.send(JSON.stringify({ type: 'get_symbol_data_package', symbol, adrLookbackDays: adr }));
    } else {
      console.log(`[DEBUGGER:ConnectionManager] WebSocket not open, request will be sent on connect`);
    }

    return () => {
      console.log(`[DEBUGGER:ConnectionManager] Unsubscribing one callback from ${symbol}`);
      const callbacks = this.subscriptions.get(symbol);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(symbol);
          console.log(`[DEBUGGER:ConnectionManager] No more callbacks for ${symbol}, removed subscription`);
        }
      }
    };
  }

  resubscribeAll() {
    console.log(`[DEBUGGER:ConnectionManager] resubscribeAll called with ${this.subscriptions.size} subscriptions`);
    for (const [s] of this.subscriptions) {
      console.log(`[DEBUGGER:ConnectionManager] Resubscribing to ${s}`);
      this.ws.send(JSON.stringify({ type: 'get_symbol_data_package', symbol: s, adrLookbackDays: 14 }));
    }
  }

  resubscribeSymbol(symbol) {
    if (this.ws?.readyState === WebSocket.OPEN && this.subscriptions.has(symbol)) {
      this.ws.send(JSON.stringify({ type: 'get_symbol_data_package', symbol, adrLookbackDays: 14 }));
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