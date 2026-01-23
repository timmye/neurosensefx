// Display state management composable for FloatingDisplay
// Handles connection status checking and refresh logic

export function useDisplayState(connectionManager) {
  let connectionStatus = 'disconnected';
  let freshnessCheckInterval = null;

  function addStatusCallback(callback) {
    return connectionManager.addStatusCallback(callback);
  }

  function getStatus() {
    return connectionManager.status;
  }

  function startFreshnessCheck(onStale) {
    freshnessCheckInterval = setInterval(() => {
      if (connectionStatus === 'disconnected') {
        onStale();
      }
    }, 5000);
  }

  function stopFreshnessCheck() {
    if (freshnessCheckInterval) {
      clearInterval(freshnessCheckInterval);
      freshnessCheckInterval = null;
    }
  }

  function updateStatus() {
    connectionStatus = connectionManager.status;
  }

  function refreshIfNeeded() {
    if (connectionManager && connectionStatus !== 'connected') {
      connectionManager.connect();
    }
  }

  return {
    get connectionStatus() { return connectionStatus; },
    addStatusCallback,
    getStatus,
    startFreshnessCheck,
    stopFreshnessCheck,
    updateStatus,
    refreshIfNeeded
  };
}
