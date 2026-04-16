/**
 * WebSocket request helpers — sends candle subscribe/unsubscribe and
 * history requests through the connection manager.
 */

import { ConnectionManager } from '../connectionManager.js';
import { getWebSocketUrl } from '../displayDataProcessor.js';

let connectionManager = null;

/**
 * Lazily create and return the connection manager singleton.
 */
export function ensureConnectionManager() {
  if (!connectionManager) {
    connectionManager = ConnectionManager.getInstance(getWebSocketUrl());
  }
  return connectionManager;
}

/**
 * Send a historical candles request.
 */
export function sendGetHistoricalCandles(symbol, resolution, from, to, source = 'ctrader') {
  const cm = ensureConnectionManager();
  return cm.sendRaw({ type: 'getHistoricalCandles', symbol, resolution, from, to, source });
}

/**
 * Subscribe to real-time candle updates.
 */
export function sendSubscribeCandles(symbol, resolution, source = 'ctrader') {
  const cm = ensureConnectionManager();
  return cm.sendRaw({ type: 'subscribeCandles', symbol, resolution, source });
}

/**
 * Unsubscribe from real-time candle updates.
 */
export function sendUnsubscribeCandles(symbol, resolution, source = 'ctrader') {
  const cm = ensureConnectionManager();
  cm.sendRaw({ type: 'unsubscribeCandles', symbol, resolution, source });
}
