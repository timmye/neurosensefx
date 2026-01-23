// WebSocket subscription lifecycle composable for FloatingDisplay
// Manages connection status and subscriptions

export function useWebSocketSub(connectionManager) {
  let unsubscribe = null;
  let dataCallback = null;

  function subscribe(symbol, source, callback, adr = 14) {
    dataCallback = callback;
    unsubscribe = connectionManager.subscribeAndRequest(symbol, callback, adr, source);
    return unsubscribe;
  }

  function unsubscribeCurrent() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  function refreshSubscription(symbol, source, adr = 14) {
    unsubscribeCurrent();
    unsubscribe = connectionManager.subscribeAndRequest(symbol, dataCallback, adr, source);
    return unsubscribe;
  }

  function getCallback() {
    return dataCallback;
  }

  return { subscribe, unsubscribeCurrent, refreshSubscription, getCallback };
}
