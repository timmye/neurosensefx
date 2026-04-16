/**
 * Ruler data computation for QuickRuler.
 *
 * Pure functions for fetching market data and recalculating ruler
 * measurement data (bars, time, price, percent, range).
 *
 * @module rulerData
 */

import { getMarketDataStore } from '../../stores/marketDataStore.js';
import { formatRulerData } from './quickRulerUtils.js';

/**
 * Fetch the current market data snapshot for a symbol.
 * Subscribes and immediately unsubscribes to get the latest value.
 * @param {string} symbol
 * @returns {object|null} market data or null if no symbol/store
 */
export function getMarketData(symbol) {
  if (!symbol) return null;
  const store = getMarketDataStore(symbol);
  let data;
  const unsub = store.subscribe(v => { data = v; });
  unsub();
  return data;
}

/**
 * Recalculate ruler measurement data from chart state.
 * @param {object} chart — KLineChart instance
 * @param {boolean} active — whether the ruler is currently active
 * @param {string} currentSymbol — the active symbol
 * @param {{ x: number, y: number }} origin — ruler origin pixel coords
 * @param {{ x: number, y: number }} cursor — ruler cursor pixel coords
 * @returns {object|null} formatted ruler data, or null
 */
export function recalcRulerData(chart, active, currentSymbol, origin, cursor) {
  if (!chart || !active) return null;
  const marketData = getMarketData(currentSymbol);
  if (!marketData) return null;
  return formatRulerData(chart, marketData, origin, cursor);
}
