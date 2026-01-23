/**
 * ConnectionHandler - WebSocket connection lifecycle management
 * Crystal Clarity: <60 lines, <15 line functions
 * Framework-First: Native WebSocket API only
 *
 * WHY: Separates connection concerns from subscription and reconnection logic.
 * Callback pattern allows ConnectionManager to orchestrate lifecycle events.
 */
export class ConnectionHandler {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.connecting = false;
    this.status = 'disconnected';
    this.onOpen = null;
    this.onClose = null;
    this.onError = null;
    this.onMessage = null;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.connecting) return;

    this.connecting = true;
    this.status = 'connecting';
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.connecting = false;
      this.status = 'connected';
      if (this.onOpen) this.onOpen();
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.connecting = false;
      this.status = 'disconnected';
      if (this.onClose) this.onClose();
    };

    this.ws.onerror = (error) => {
      this.status = 'error';
      if (this.onError) this.onError(error);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (this.onMessage) this.onMessage(data);
      } catch (error) {
        console.error('Message parse error:', error);
      }
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }

  getWebSocket() {
    return this.ws;
  }

  getStatus() {
    return this.status;
  }
}
