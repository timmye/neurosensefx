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
    this.onStale = null;
    // Heartbeat/timeout mechanism to detect stale connections
    this.lastMessageTime = null;
    this.heartbeatCheckInterval = null;
    this.heartbeatTimeoutMs = 30000; // 30 seconds - allows for backend 15s heartbeat + tunnel jitter
  }

  async connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    // Clean up old WebSocket if it exists and is not OPEN
    // This handles CONNECTING, CLOSING, CLOSED, and ERROR states
    if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws = null;
      this.connecting = false; // Reset connecting flag since we're cleaning up
    }

    if (this.connecting) return;

    this.connecting = true;
    this.status = 'connecting';

    // Pre-warm the connection path with a lightweight HTTP probe.
    // This ensures the backend (or tunnel/proxy) is reachable before
    // attempting the WebSocket upgrade, avoiding silent hangs on cold starts.
    try {
      await fetch(this.url.replace(/^ws/, 'http'), { method: 'HEAD', mode: 'no-cors' });
    } catch {
      // Proceed regardless — probe failure doesn't mean WS will fail
    }

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.connecting = false;
      this.status = 'connected';
      this.lastMessageTime = Date.now();
      this.startHeartbeatCheck();
      if (this.onOpen) this.onOpen();
    };

    this.ws.onclose = () => {
      this.connecting = false;
      this.status = 'disconnected';
      this.ws = null; // Clean up reference to allow reconnection
      this.stopHeartbeatCheck();
      if (this.onClose) this.onClose();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.stopHeartbeatCheck();
      this.ws = null;
      this.connecting = false; // Reset connecting flag on error to allow reconnection
      this.status = 'error';
      if (this.onError) this.onError(error);
    };

    this.ws.onmessage = (event) => {
      const previousTime = this.lastMessageTime;
      this.lastMessageTime = Date.now();
      try {
        const data = JSON.parse(event.data);
        if (this.onMessage) this.onMessage(data);
      } catch (error) {
        console.error('[ConnectionHandler] Message parse error:', error);
      }
    };
  }

  disconnect() {
    this.stopHeartbeatCheck();
    if (this.ws) {
      this.ws.close();
    }
  }

  startHeartbeatCheck() {
    this.stopHeartbeatCheck(); // Clear any existing interval
    this.heartbeatCheckInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastMessage = this.lastMessageTime ? now - this.lastMessageTime : Infinity;

      // If we haven't received a message in heartbeatTimeoutMs, trigger reconnection
      if (this.status === 'connected' && timeSinceLastMessage > this.heartbeatTimeoutMs) {
        console.warn(`[ConnectionHandler] Connection stale - no messages for ${Math.round(timeSinceLastMessage / 1000)}s. Triggering direct reconnection.`);
        // Directly trigger reconnection instead of relying on ws.close() -> onclose
        // which may not fire on zombie connections
        this.handleStaleConnection();
      }
    }, this.heartbeatTimeoutMs / 2); // Check twice as often as the timeout
  }

  handleStaleConnection() {
    this.stopHeartbeatCheck();
    this.connecting = false;
    this.status = 'disconnected';

    // Clean up the old WebSocket
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      try {
        this.ws.close();
      } catch (e) {
        // Expected when closing zombie connections
      }
      this.ws = null;
    }

    // Directly trigger the stale callback (which will schedule reconnect)
    if (this.onStale) {
      this.onStale();
    } else if (this.onClose) {
      // Fallback to onClose if onStale not set
      this.onClose();
    }
  }

  stopHeartbeatCheck() {
    if (this.heartbeatCheckInterval) {
      clearInterval(this.heartbeatCheckInterval);
      this.heartbeatCheckInterval = null;
    }
  }

  getWebSocket() {
    return this.ws;
  }

  getStatus() {
    return this.status;
  }

  isDisconnected() {
    return this.status === 'disconnected';
  }
}
