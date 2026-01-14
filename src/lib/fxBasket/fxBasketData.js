// FX Basket Data Management - Crystal Clarity Compliant
// Price aggregation and state management for currency baskets

import { BASKET_DEFINITIONS, calculateBasketValue, normalizeToBaseline, initializeBaskets, getAllPairs, hasMinimumDailyOpens } from './fxBasketCalculations.js';

// Re-export for convenience
export { getAllPairs, hasMinimumDailyOpens };

// Initialize basket state with anchor time
export function initializeState(anchorTime) {
  const prices = new Map();
  const dailyOpenPrices = new Map(); // Separate Map preserves fixed baseline vs live current distinction
  const baskets = {};

  for (const currency of Object.keys(BASKET_DEFINITIONS)) {
    baskets[currency] = {
      currency,
      baselineLog: null,
      currentLog: null,
      normalized: 100,
      changePercent: 0,
      initialized: false
    };
  }

  return { prices, dailyOpenPrices, baskets, anchorTime, lastUpdate: null };
}

// Helper: update basket from calculation result
function updateBasketFromCalculation(basket, result) {
  if (!basket.initialized) {
    basket.baselineLog = result.value;
    basket.currentLog = result.value;
    basket.normalized = 100;
    basket.initialized = true;
    basket.coverage = result.coverage;
  } else {
    basket.currentLog = result.value;
    basket.normalized = normalizeToBaseline(result.value, basket.baselineLog);
    basket.changePercent = basket.normalized - 100;
    basket.coverage = result.coverage;
  }
}

// Update price in dailyOpenPrices (if isDailyOpen) or prices (current)
// Default isDailyOpen=false maintains backward compatibility for simple tick updates
export function updatePrice(pair, price, state, isDailyOpen = false) {
  const targetMap = isDailyOpen ? state.dailyOpenPrices : state.prices;
  targetMap.set(pair, price);
  state.lastUpdate = new Date();

  const affectedCurrencies = Object.entries(BASKET_DEFINITIONS)
    .filter(([_, basket]) => basket.pairs.includes(pair))
    .map(([currency, _]) => currency);

  for (const currency of affectedCurrencies) {
    const basket = state.baskets[currency];
    const result = calculateBasketValue(currency, state.prices);
    if (result !== null) updateBasketFromCalculation(basket, result);
  }
}

// Recalculate all baskets from current price state
export function updateAllBaskets(state) {
  for (const currency of Object.keys(BASKET_DEFINITIONS)) {
    const basket = state.baskets[currency];
    const result = calculateBasketValue(currency, state.prices);
    if (result !== null) updateBasketFromCalculation(basket, result);
  }
  state.lastUpdate = new Date();
}

// Initialize basket baselines from daily open prices
// Batch approach: all baskets initialize from same daily open snapshot
export function initializeBaselinesFromDailyOpens(state) {
  for (const currency of Object.keys(BASKET_DEFINITIONS)) {
    const basket = state.baskets[currency];
    if (basket.initialized) continue;

    const result = calculateBasketValue(currency, state.dailyOpenPrices);
    if (result && result.coverage >= 0.5) {
      updateBasketFromCalculation(basket, result);
    }
  }
  state.lastUpdate = new Date();
}
