let _dailyResetSetup = false;

export function createResetFields(current) {
  return {
    marketProfile: null,
    high: null,
    low: null,
    open: null,
    adrHigh: null,
    adrLow: null,
    prevDayOHLC: null,
    previousPrice: current.current,
    direction: 'neutral',
    receivedAt: null,
    sentAt: null,
    clientReceivedAt: null,
    latency: { backend: null, network: null, e2e: null },
    lastUpdate: Date.now()
  };
}

export function setupDailyResetHandler(connectionManager, resetCallback) {
  if (_dailyResetSetup) return;
  _dailyResetSetup = true;
  connectionManager.addSystemSubscription((msg) => {
    if (msg.type === 'dailyReset' && msg.symbols) {
      console.log('[dailyResetHandler] Daily reset — clearing session data for:', msg.symbols);
      for (const symbol of msg.symbols) {
        resetCallback(symbol);
      }
    }
  });
}
