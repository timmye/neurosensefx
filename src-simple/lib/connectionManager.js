export class ConnectionManager {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.subscriptions = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnects = 5;
    this.reconnectDelay = 1000;
    this.status = 'disconnected';
    this.onStatusChange = null;
    this.useRecommendedProtocol = true; // Use get_symbol_data_package by default
    this.lastRequestedSymbol = null; // Track last request for error routing
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.url);
    this.status = 'connecting';

    this.ws.onopen = () => {
      console.log('Connected to WebSocket');
      this.status = 'connected';
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.resubscribeAll();
      if (this.onStatusChange) this.onStatusChange();
    };

    this.ws.onclose = (event) => {
      this.status = 'disconnected';
      if (this.onStatusChange) this.onStatusChange();
      if (this.reconnectAttempts < this.maxReconnects) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.status = 'error';
      if (this.onStatusChange) this.onStatusChange();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        let callback = null;
        if (data.symbol) {
          // Normal message with symbol
          callback = this.subscriptions.get(data.symbol);
        } else if (data.type === 'error' && this.lastRequestedSymbol) {
          // Error message without symbol - route to last requester
          callback = this.subscriptions.get(this.lastRequestedSymbol);
        }
        if (callback) callback(data);
      } catch (error) {
        console.error('Message parse error:', error);
      }
    };
  }

  scheduleReconnect() {
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
  }

  subscribe(symbol, callback) {
    this.subscriptions.set(symbol, callback);
    // Note: No automatic message sent - let the component decide which protocol to use
  }

  // Legacy method for backward compatibility
  subscribeLegacy(symbol, callback) {
    this.subscriptions.set(symbol, callback);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        symbols: [symbol]  // ✅ FIXED: Use array format as required by backend
      }));
    }
  }

  // New method for recommended protocol
  subscribeRecommended(symbol, callback, adrLookbackDays = 14) {
    this.subscriptions.set(symbol, callback);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'get_symbol_data_package',
        symbol: symbol,
        adrLookbackDays: adrLookbackDays
      }));
    }
  }

  unsubscribe(symbol) {
    this.subscriptions.delete(symbol);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        symbols: [symbol]  // ✅ FIXED: Use array format as required by backend
      }));
    }
  }

  subscribeAndRequest(symbol, callback, adrLookbackDays = 14) {
    this.subscriptions.set(symbol, callback);

    // If already connected, send request immediately
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'get_symbol_data_package',
        symbol: symbol,
        adrLookbackDays: adrLookbackDays
      }));
    }
    // Otherwise, request will be sent in ws.onopen via resubscribeAll

    return () => this.subscriptions.delete(symbol);
  }

  resubscribeAll() {
    for (const [symbol] of this.subscriptions) {
      // Send data requests for all subscriptions when reconnected
      this.ws.send(JSON.stringify({
        type: 'get_symbol_data_package',
        symbol: symbol,
        adrLookbackDays: 14
      }));
    }
  }

  disconnect() {
    this.maxReconnects = 0;
    if (this.ws) this.ws.close();
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Track symbol for error routing
      if (data.symbol) {
        this.lastRequestedSymbol = data.symbol;
      }
      this.ws.send(JSON.stringify(data));
    }
  }
}