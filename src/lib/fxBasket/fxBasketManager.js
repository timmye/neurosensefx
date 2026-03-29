/**
 * FX Basket Manager
 * High-level basket operations (replaces 149-line fxBasketData.js)
 * All functions <15 lines (Crystal Clarity)
 */

import { calculateBasketValue, normalizeToBaseline, validateCalculationResult } from './fxBasketCalculations.js';
import { getPriceMap } from './fxBasketStore.js';
import { canCalculate } from './fxBasketStateMachine.js';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'JPY', 'NZD'];

export function updateBaskets(store, stateMachine) {
  if (!canCalculate(stateMachine)) {
    return null;
  }

  const baselineMap = getPriceMap(store, 'baseline');
  const currentMap = getPriceMap(store, 'current');
  const baskets = {};

  for (const currency of CURRENCIES) {
    const baselineResult = calculateBasketValue(currency, baselineMap);
    const currentResult = calculateBasketValue(currency, currentMap);

    const baselineValidation = validateCalculationResult(baselineResult);
    const currentValidation = validateCalculationResult(currentResult);

    if (!baselineValidation.valid || !currentValidation.valid) {
      baskets[currency] = null;
      continue;
    }

    const normalized = normalizeToBaseline(
      currentResult.value,
      baselineResult.value
    );

    baskets[currency] = {
      currency,
      baselineLog: baselineResult.value,
      currentLog: currentResult.value,
      normalized: normalized ?? 100,
      changePercent: (normalized ?? 100) - 100,
      initialized: true
    };
  }

  return baskets;
}

