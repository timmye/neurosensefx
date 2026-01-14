// Singleton instance for all displays
let sharedInstance = null;

console.log('[DEBUGGER:connectionManager:1] ConnectionManager module loaded - DEBUG MODE ACTIVE');

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
    // [DEBUGGER:connectionManager.js:27] Log connection attempt
    console.log(`[DEBUGGER:connectionManager:connect:27] connect_attempt=true, url=${this.url}, current_ws_state=${this.ws?.readyState}, timestamp=${Date.now()}`);
    this.ws = new WebSocket(this.url); this.status = 'connecting';
    this.notifyStatusChange();
    this.ws.onopen = () => this.handleOpen();
    this.ws.onclose = () => this.handleClose();
    this.ws.onerror = (e) => { console.error('WebSocket error:', e); this.status = 'error'; this.notifyStatusChange(); };
    this.ws.onmessage = (e) => {
      try {
        // [DEBUGGER:connectionManager.js:37] Log incoming message
        console.log(`[DEBUGGER:connectionManager:onmessage:37] received_message=true, raw_data=${e.data}, data_length=${e.data?.length}, timestamp=${Date.now()}`);
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
    // [DEBUGGER:connectionManager.js:74] Log connection opened
    console.log(`[DEBUGGER:connectionManager:handleOpen:74] ws_opened=true, url=${this.url}, status=${this.status}, subscriptions_count=${this.subscriptions.size}, timestamp=${Date.now()}`);
    console.log('WebSocket connected'); this.status = 'connected'; this.reconnectAttempts = 0; this.reconnectDelay = 1000;
    this.resubscribeAll(); this.notifyStatusChange();
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
    console.log('[DEBUGGER:connectionManager:subscribeAndRequest:ENTRY] === subscribeAndRequest CALLED ===', 'symbol=', symbol, 'source=', source);
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
        // [DEBUGGER:connectionManager.js:108] Log outgoing message
        console.log(`[DEBUGGER:connectionManager:subscribeAndRequest:108] sending_message=true, symbol=${symbol}, source=${source}, payload=${JSON.stringify(payload)}, ws_state=${this.ws?.readyState}, timestamp=${Date.now()}`);
        this.ws.send(message);
      } catch (error) {
        console.error(`[CM ERROR] Failed to stringify/send message for ${symbol}:`, error);
      }
    } else {
      // [DEBUGGER:connectionManager.js:113] Log deferred message
      console.log(`[DEBUGGER:connectionManager:subscribeAndRequest:113] deferring_message=true, symbol=${symbol}, ws_state=${this.ws?.readyState}, timestamp=${Date.now()}`);
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
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('[CM RESUB] WebSocket not open, skipping resubscribeAll');
      return;
    }
    // [DEBUGGER:connectionManager.js:131] Log resubscribe all
    console.log(`[DEBUGGER:connectionManager:resubscribeAll:131] resubscribe_all=true, subscriptions_count=${this.subscriptions.size}, timestamp=${Date.now()}`);
    for (const [key] of this.subscriptions) {
      const [symbol, source] = key.split(':');
      const adr = this.subscriptionAdr.get(key) || 14;
      const payload = { type: 'get_symbol_data_package', symbol, adrLookbackDays: adr, source };
      try {
        const message = JSON.stringify(payload);
        console.log(`[CM RESUB] Resubscribing to ${symbol} from ${source}`);
        // [DEBUGGER:connectionManager.js:140] Log individual resubscribe
        console.log(`[DEBUGGER:connectionManager:resubscribeAll:140] resubscribing=true, symbol=${symbol}, source=${source}, payload=${JSON.stringify(payload)}`);
        this.ws.send(message);
      } catch (error) {
        console.error(`[CM ERROR] Failed to resubscribe to ${symbol}:`, error);
      }
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