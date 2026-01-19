// FX Basket ADR Calculations - Crystal Clarity Compliant
// Derive basket ADR from individual pair ADRs using ln-weighted propagation

import { BASKET_DEFINITIONS } from './fxBasketCalculations.js';

/**
 * Calculate basket ADR from component pair ADRs (linear approximation)
 *
 * Formula: Basket_ADR_% = Σ(normalized_weight_i × ADR_i_%)
 * Where ADR_i_% = (ADR_i / Price_i) × 100
 *
 * For small ranges (<2%), this linear approximation provides 85-95% accuracy.
 * The full exponential formula provides >95% accuracy at cost of complexity.
 *
 * @param {string} currency - Basket currency (e.g., 'USD', 'EUR')
 * @param {Map<string, number>} adrMap - Map of pair → ADR value (absolute price)
 * @param {Map<string, number>} priceMap - Map of pair → current price
 * @returns {number|null} Basket ADR as percentage (e.g., 0.93 for 0.93%)
 */
export function calculateBasketAdrFromPairs(currency, adrMap, priceMap) {
  const basket = BASKET_DEFINITIONS[currency];
  if (!basket) return null;

  const totalWeight = basket.weights.reduce((a, b) => a + b, 0);
  let weightedAdrPercent = 0;

  for (let i = 0; i < basket.pairs.length; i++) {
    const pair = basket.pairs[i];

    if (!adrMap.has(pair) || !priceMap.has(pair)) {
      return null; // Require complete data for accuracy
    }

    const weight = basket.weights[i];
    const normalizedWeight = weight / totalWeight;
    const adr = adrMap.get(pair);
    const price = priceMap.get(pair);

    // Convert ADR to percentage of price
    const adrPercent = (adr / price) * 100;
    weightedAdrPercent += normalizedWeight * adrPercent;
  }

  return weightedAdrPercent;
}

/**
 * Calculate ADR for all baskets from pair ADR data
 *
 * @param {Map<string, Object>} symbolDataMap - Map of symbol → {adr, current, open}
 * @returns {Object} Map of currency → ADR percentage
 */
export function calculateAllBasketAdr(symbolDataMap) {
  const adrMap = new Map();
  const priceMap = new Map();

  // Extract ADR and price data from symbol data
  for (const [symbol, data] of symbolDataMap.entries()) {
    if (data.adr && data.current) {
      adrMap.set(symbol, data.adr);
      priceMap.set(symbol, data.current);
    }
  }

  // Calculate ADR for each basket
  const basketAdr = {};
  for (const currency of Object.keys(BASKET_DEFINITIONS)) {
    const adr = calculateBasketAdrFromPairs(currency, adrMap, priceMap);
    if (adr !== null) {
      basketAdr[currency] = adr;
    }
  }

  return basketAdr;
}

/**
 * Calculate basket ADR using full exponential formula (higher accuracy)
 *
 * This accounts for non-linear propagation through ln-weighted basket formula.
 * Use this for maximum accuracy, especially when ranges are larger (>1%).
 *
 * @param {string} currency - Basket currency
 * @param {Map<string, number>} adrMap - Map of pair → ADR value
 * @param {Map<string, number>} openPriceMap - Map of pair → daily open price
 * @returns {number|null} Basket ADR as percentage
 */
export function calculateBasketAdrPrecise(currency, adrMap, openPriceMap) {
  const basket = BASKET_DEFINITIONS[currency];
  if (!basket) return null;

  const totalWeight = basket.weights.reduce((a, b) => a + b, 0);

  // Validate all pairs available
  for (const pair of basket.pairs) {
    if (!adrMap.has(pair) || !openPriceMap.has(pair)) {
      return null;
    }
  }

  // Calculate basket value at ADR high (open + ADR/2)
  let logSumHigh = 0;
  for (let i = 0; i < basket.pairs.length; i++) {
    const pair = basket.pairs[i];
    const weight = basket.weights[i];
    const open = openPriceMap.get(pair);
    const adr = adrMap.get(pair);

    // Adjusted price at ADR high
    const adjustedPrice = pair.startsWith(currency)
      ? (open + adr / 2) / open
      : open / (open + adr / 2);

    logSumHigh += (weight / totalWeight) * Math.log(adjustedPrice);
  }

  // Calculate basket value at ADR low (open - ADR/2)
  let logSumLow = 0;
  for (let i = 0; i < basket.pairs.length; i++) {
    const pair = basket.pairs[i];
    const weight = basket.weights[i];
    const open = openPriceMap.get(pair);
    const adr = adrMap.get(pair);

    // Adjusted price at ADR low
    const adjustedPrice = pair.startsWith(currency)
      ? (open - adr / 2) / open
      : open / (open - adr / 2);

    logSumLow += (weight / totalWeight) * Math.log(adjustedPrice);
  }

  // Basket ADR as percentage
  const basketHigh = Math.exp(logSumHigh);
  const basketLow = Math.exp(logSumLow);
  const basketAdr = ((basketHigh - basketLow) / 2) * 100;

  return basketAdr;
}

/**
 * Update basket state with ADR calculations
 *
 * @param {Object} state - Basket state from fxBasketData.js
 * @param {Map<string, Object>} symbolDataMap - Symbol data with ADR
 * @param {boolean} usePrecise - Use exponential formula (default: false)
 */
export function updateBasketAdr(state, symbolDataMap, usePrecise = false) {
  const basketAdr = usePrecise
    ? calculateAllBasketAdrPrecise(symbolDataMap)
    : calculateAllBasketAdr(symbolDataMap);

  for (const [currency, adrPercent] of Object.entries(basketAdr)) {
    if (state.baskets[currency]) {
      state.baskets[currency].adrPercent = adrPercent;
    }
  }
}

/**
 * Calculate all basket ADR using precise formula
 *
 * @param {Map<string, Object>} symbolDataMap - Symbol data with ADR and open
 * @returns {Object} Map of currency → ADR percentage
 */
function calculateAllBasketAdrPrecise(symbolDataMap) {
  const adrMap = new Map();
  const openPriceMap = new Map();

  for (const [symbol, data] of symbolDataMap.entries()) {
    if (data.adr && data.open) {
      adrMap.set(symbol, data.adr);
      openPriceMap.set(symbol, data.open);
    }
  }

  const basketAdr = {};
  for (const currency of Object.keys(BASKET_DEFINITIONS)) {
    const adr = calculateBasketAdrPrecise(currency, adrMap, openPriceMap);
    if (adr !== null) {
      basketAdr[currency] = adr;
    }
  }

  return basketAdr;
}
