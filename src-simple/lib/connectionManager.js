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
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.url);
    this.status = 'connecting';
    if (this.onStatusChange) this.onStatusChange();

    this.ws.onopen = () => this.handleOpen();
    this.ws.onclose = () => this.handleClose();
    this.ws.onerror = (error) => this.handleError(error);
    this.ws.onmessage = (event) => this.handleMessage(event);
  }

  handleOpen() {
    console.log('WebSocket connected');
    this.status = 'connected';
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.resubscribeAll();
    if (this.onStatusChange) this.onStatusChange();
  }

  handleClose() {
    this.status = 'disconnected';
    if (this.onStatusChange) this.onStatusChange();
    if (this.reconnectAttempts < this.maxReconnects) {
      this.scheduleReconnect();
    }
  }

  handleError(error) {
    console.error('WebSocket error:', error);
    this.status = 'error';
    if (this.onStatusChange) this.onStatusChange();
  }

  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      const callback = this.subscriptions.get(data.symbol);
      if (callback) callback(data);
    } catch (error) {
      console.error('Message parse error:', error);
    }
  }

  scheduleReconnect() {
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
  }

  subscribeAndRequest(symbol, callback, adrLookbackDays = 14) {
    this.subscriptions.set(symbol, callback);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'get_symbol_data_package',
        symbol: symbol,
        adrLookbackDays: adrLookbackDays
      }));
    }

    return () => this.subscriptions.delete(symbol);
  }

  resubscribeAll() {
    for (const [symbol] of this.subscriptions) {
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
}