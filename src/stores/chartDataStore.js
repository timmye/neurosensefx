import { writable, get } from 'svelte/store';
import { ConnectionManager } from '../lib/connectionManager.js';
import { getWebSocketUrl } from '../lib/displayDataProcessor.js';

const chartStores = new Map();
const activeSubscriptions = new Map();
let connectionManager = null;
let _isInitialized = false;

function createInitialData(symbol) {
  return {
    symbol,
    source: null,
    resolution: '4h',
    window: '3M',
    bars: [],
    loading: false,
    error: null,
    lastUpdate: null,
    status: 'pending'
  };
}

function getChartStore(symbol) {
  if (!chartStores.has(symbol)) {
    chartStores.set(symbol, writable(createInitialData(symbol)));
  }
  return chartStores.get(symbol);
}

function calculateBarsRange(window) {
  // Convert window to milliseconds
  const ranges = {
    '1d': 24 * 60 * 60 * 1000,
    '2d': 2 * 24 * 60 * 60 * 1000,
    '1W': 7 * 24 * 60 * 60 * 1000,
    '2W': 14 * 24 * 60 * 60 * 1000,
    '1M': 30 * 24 * 60 * 60 * 1000,
    '3M': 90 * 24 * 60 * 60 * 1000,
    '6M': 180 * 24 * 60 * 60 * 1000,
    '1Y': 365 * 24 * 60 * 60 * 1000,
    '2Y': 2 * 365 * 24 * 60 * 60 * 1000,
    '5Y': 5 * 365 * 24 * 60 * 60 * 1000,
    '10Y': 10 * 365 * 24 * 60 * 60 * 1000
  };

  const rangeMs = ranges[window] || ranges['3M'];
  const to = Date.now();
  const from = to - rangeMs;

  return { from, to };
}

function subscribeToSymbol(symbol, source, options = {}) {
  const { resolution = '4h', window = '3M' } = options;
  const store = getChartStore(symbol);

  // Check if already subscribed
  const subscriptionKey = `${symbol}-${resolution}`;
  if (activeSubscriptions.has(subscriptionKey)) {
    return unsubscribeSymbol(subscriptionKey);
  }

  // Update store with subscription parameters
  store.update(state => ({
    ...state,
    resolution,
    window,
    loading: true,
    status: 'loading'
  }));

  // Calculate range for historical data
  const { from, to } = calculateBarsRange(window);

  // Send request for historical data
  if (connectionManager && connectionManager.status === 'connected') {
    connectionManager.sendRaw({
      type: 'getHistoricalCandles',
      symbol,
      resolution,
      from,
      to
    });
  }

  // Subscribe to real-time updates for this symbol/resolution
  const updateCallback = (data) => {
    if (data.type === 'candleUpdate' && data.symbol === symbol && data.timeframe === resolution) {
      store.update(state => {
        const bars = [...state.bars];
        const existingBarIndex = bars.findIndex(b => b.timestamp === data.bar.timestamp);

        if (existingBarIndex >= 0) {
          // Update existing bar
          bars[existingBarIndex] = data.bar;
        } else {
          // Add new bar
          bars.push(data.bar);
          // Sort by timestamp
          bars.sort((a, b) => a.timestamp - b.timestamp);
        }

        return {
          ...state,
          bars,
          loading: false,
          lastUpdate: Date.now(),
          status: 'ready'
        };
      });
    }
  };

  // Add subscription
  activeSubscriptions.set(subscriptionKey, updateCallback);

  if (connectionManager) {
    connectionManager.addSubscription(updateCallback);
  }

  // Return unsubscribe function
  return () => unsubscribeSymbol(subscriptionKey);
}

function unsubscribeSymbol(subscriptionKey) {
  const callback = activeSubscriptions.get(subscriptionKey);
  if (callback && connectionManager) {
    connectionManager.removeSubscription(callback);
  }
  activeSubscriptions.delete(subscriptionKey);
}

function getConnectionStatus() {
  return connectionManager ? { status: connectionManager.status } : { status: 'disconnected' };
}

function initialize() {
  if (_isInitialized) return;

  connectionManager = ConnectionManager.getInstance(getWebSocketUrl());

  // Listen for candle updates
  const systemCallback = (data) => {
    if (data.type === 'candleUpdate') {
      // Forward to appropriate chart store
      const store = getChartStore(data.symbol);
      store.update(state => {
        if (state.resolution === data.timeframe) {
          const bars = [...state.bars];
          const existingBarIndex = bars.findIndex(b => b.timestamp === data.bar.timestamp);

          if (existingBarIndex >= 0) {
            bars[existingBarIndex] = data.bar;
          } else {
            bars.push(data.bar);
            bars.sort((a, b) => a.timestamp - b.timestamp);
          }

          return {
            ...state,
            bars,
            lastUpdate: Date.now()
          };
        }
        return state;
      });
    }
  };

  connectionManager.addSystemSubscription(systemCallback);

  // Listen for historical data responses
  const historyCallback = (data) => {
    if (data.type === 'candleHistory') {
      const store = getChartStore(data.symbol);
      store.update(state => {
        if (state.resolution === data.resolution) {
          return {
            ...state,
            bars: data.bars || [],
            loading: false,
            lastUpdate: Date.now(),
            status: 'ready'
          };
        }
        return state;
      });
    }
  };

  connectionManager.addSubscription(historyCallback);

  _isInitialized = true;
}

// Clear all subscriptions
function clearAllStores() {
  for (const [key, callback] of activeSubscriptions) {
    if (connectionManager) {
      connectionManager.removeSubscription(callback);
    }
  }
  activeSubscriptions.clear();
  chartStores.clear();
}

// Export functions
export {
  getChartStore,
  subscribeToSymbol,
  unsubscribeSymbol,
  getConnectionStatus,
  initialize,
  clearAllStores
};