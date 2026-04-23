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
      if (import.meta.env.DEV) {
        console.log('[ConnectionHandler] WebSocket connected, readyState=' + this.ws.readyState);
      }
      this.connecting = false;
      this.status = 'connected';
      this.lastMessageTime = Date.now();
      if (import.meta.env.DEV) {
        console.log('[ConnectionHandler] lastMessageTime initialized to ' + this.lastMessageTime);
        console.log('[ConnectionHandler] About to call startHeartbeatCheck()');
      }
      this.startHeartbeatCheck();
      if (import.meta.env.DEV) {
        console.log('[ConnectionHandler] startHeartbeatCheck() completed, calling onOpen callback');
      }
      if (this.onOpen) this.onOpen();
    };

    this.ws.onclose = () => {
      if (import.meta.env.DEV) {
        console.log('[ConnectionHandler] WebSocket disconnected, readyState=' + this.ws.readyState);
      }
      this.connecting = false;
      this.status = 'disconnected';
      this.ws = null; // Clean up reference to allow reconnection
      if (import.meta.env.DEV) {
        console.log('[ConnectionHandler] ws set to null, calling stopHeartbeatCheck');
      }
      this.stopHeartbeatCheck();
      if (import.meta.env.DEV) {
        console.log('[ConnectionHandler] About to call onClose callback');
      }
      if (this.onClose) this.onClose();
      if (import.meta.env.DEV) {
        console.log('[ConnectionHandler] onClose callback completed');
      }
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
        if (import.meta.env.DEV) {
          console.log('[ConnectionHandler] Received message type=' + data.type + ', previousTime=' + previousTime + ', newTime=' + this.lastMessageTime + ', gap=' + (previousTime ? (this.lastMessageTime - previousTime) + 'ms' : 'first message'));
        }
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
    if (import.meta.env.DEV) {
      console.log('[ConnectionHandler] Starting heartbeat check, status=' + this.status + ', ws.readyState=' + (this.ws?.readyState));
    }
    this.stopHeartbeatCheck(); // Clear any existing interval
    this.heartbeatCheckInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastMessage = this.lastMessageTime ? now - this.lastMessageTime : Infinity;

      if (import.meta.env.DEV) {
        console.log('[ConnectionHandler] status=' + this.status + ', timeSinceLastMessage=' + Math.round(timeSinceLastMessage / 1000) + 's, threshold=' + (this.heartbeatTimeoutMs / 1000) + 's, ws.readyState=' + (this.ws?.readyState));
      }

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
    if (import.meta.env.DEV) {
      console.log('[ConnectionHandler] handleStaleConnection() - Cleaning up and triggering reconnection');
    }
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
        if (import.meta.env.DEV) {
          console.log('[ConnectionHandler] ws.close() error (expected):', e.message);
        }
      }
      this.ws = null;
    }

    // Directly trigger the stale callback (which will schedule reconnect)
    if (this.onStale) {
      if (import.meta.env.DEV) {
        console.log('[ConnectionHandler] Calling onStale callback');
      }
      this.onStale();
    } else if (this.onClose) {
      // Fallback to onClose if onStale not set
      if (import.meta.env.DEV) {
        console.log('[ConnectionHandler] Calling onClose callback (fallback)');
      }
      this.onClose();
    }
  }

  stopHeartbeatCheck() {
    if (import.meta.env.DEV) {
      console.log('[ConnectionHandler] Stopping heartbeat check');
    }
    if (this.heartbeatCheckInterval) {
      clearInterval(this.heartbeatCheckInterval);
      this.heartbeatCheckInterval = null;
      if (import.meta.env.DEV) {
        console.log('[ConnectionHandler] Heartbeat check cleared');
      }
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
