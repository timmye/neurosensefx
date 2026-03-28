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
    this.onStale = null; // NEW: Callback for when connection is detected as stale
    // Heartbeat/timeout mechanism to detect stale connections
    this.lastMessageTime = null;
    this.heartbeatCheckInterval = null;
    this.heartbeatTimeoutMs = 10000; // 10 seconds - allows for backend 5s heartbeat + jitter
  }

  connect() {
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
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('[DEBUGGER:ConnectionHandler:onopen:45] WebSocket connected, readyState=' + this.ws.readyState);
      this.connecting = false;
      this.status = 'connected';
      this.lastMessageTime = Date.now(); // Initialize lastMessageTime on open
      console.log('[DEBUGGER:ConnectionHandler:onopen:49] lastMessageTime initialized to ' + this.lastMessageTime);
      console.log('[DEBUGGER:ConnectionHandler:onopen:50] About to call startHeartbeatCheck()');
      this.startHeartbeatCheck(); // Start heartbeat monitoring
      console.log('[DEBUGGER:ConnectionHandler:onopen:52] startHeartbeatCheck() completed, calling onOpen callback');
      if (this.onOpen) this.onOpen();
    };

    this.ws.onclose = () => {
      console.log('[DEBUGGER:ConnectionHandler:onclose:54] WebSocket disconnected, readyState=' + this.ws.readyState);
      this.connecting = false;
      this.status = 'disconnected';
      this.ws = null; // Clean up reference to allow reconnection
      console.log('[DEBUGGER:ConnectionHandler:onclose:58] ws set to null, calling stopHeartbeatCheck');
      this.stopHeartbeatCheck(); // Stop heartbeat monitoring
      console.log('[DEBUGGER:ConnectionHandler:onclose:60] About to call onClose callback');
      if (this.onClose) this.onClose();
      console.log('[DEBUGGER:ConnectionHandler:onclose:62] onClose callback completed');
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.connecting = false; // Reset connecting flag on error to allow reconnection
      this.status = 'error';
      if (this.onError) this.onError(error);
    };

    this.ws.onmessage = (event) => {
      const previousTime = this.lastMessageTime;
      this.lastMessageTime = Date.now(); // Update last message time on any message
      try {
        const data = JSON.parse(event.data);
        console.log('[DEBUGGER:ConnectionHandler:onmessage:70] Received message type=' + data.type + ', previousTime=' + previousTime + ', newTime=' + this.lastMessageTime + ', gap=' + (previousTime ? (this.lastMessageTime - previousTime) + 'ms' : 'first message'));
        if (this.onMessage) this.onMessage(data);
      } catch (error) {
        console.error('[DEBUGGER:ConnectionHandler:onmessage:75] Message parse error:', error);
      }
    };
  }

  disconnect() {
    this.stopHeartbeatCheck(); // Stop heartbeat monitoring
    if (this.ws) {
      this.ws.close();
    }
  }

  startHeartbeatCheck() {
    console.log('[DEBUGGER:ConnectionHandler:startHeartbeatCheck:88] Starting heartbeat check, status=' + this.status + ', ws.readyState=' + (this.ws?.readyState));
    this.stopHeartbeatCheck(); // Clear any existing interval
    this.heartbeatCheckInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastMessage = this.lastMessageTime ? now - this.lastMessageTime : Infinity;

      console.log('[DEBUGGER:ConnectionHandler:heartbeatCheck:92] status=' + this.status + ', timeSinceLastMessage=' + Math.round(timeSinceLastMessage / 1000) + 's, threshold=' + (this.heartbeatTimeoutMs / 1000) + 's, ws.readyState=' + (this.ws?.readyState));

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
    console.log('[ConnectionHandler] handleStaleConnection() - Cleaning up and triggering reconnection');
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
        console.log('[ConnectionHandler] ws.close() error (expected):', e.message);
      }
      this.ws = null;
    }

    // Directly trigger the stale callback (which will schedule reconnect)
    if (this.onStale) {
      console.log('[ConnectionHandler] Calling onStale callback');
      this.onStale();
    } else if (this.onClose) {
      // Fallback to onClose if onStale not set
      console.log('[ConnectionHandler] Calling onClose callback (fallback)');
      this.onClose();
    }
  }

  stopHeartbeatCheck() {
    console.log('[DEBUGGER:ConnectionHandler:stopHeartbeatCheck:105] Stopping heartbeat check');
    if (this.heartbeatCheckInterval) {
      clearInterval(this.heartbeatCheckInterval);
      this.heartbeatCheckInterval = null;
      console.log('[DEBUGGER:ConnectionHandler:stopHeartbeatCheck:108] Heartbeat check cleared');
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
