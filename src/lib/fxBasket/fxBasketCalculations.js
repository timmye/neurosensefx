// FX Basket Calculations - Crystal Clarity Compliant
// Ln-weighted currency basket calculations with baseline normalization

export const BASKET_DEFINITIONS = {
  'USD': { pairs: ['EURUSD', 'USDJPY', 'GBPUSD', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD'], weights: [20, 15, 13, 10, 30, 7, 5] },
  'EUR': { pairs: ['EURUSD', 'EURJPY', 'EURGBP', 'EURAUD', 'EURCHF', 'EURCAD', 'EURNZD'], weights: [25, 15, 20, 10, 15, 10, 5] },
  'JPY': { pairs: ['EURJPY', 'USDJPY', 'GBPJPY', 'AUDJPY', 'CADJPY', 'CHFJPY', 'NZDJPY'], weights: [25, 30, 15, 10, 10, 5, 5] },
  'GBP': { pairs: ['EURGBP', 'GBPUSD', 'GBPJPY', 'GBPAUD', 'GBPCAD', 'GBPCHF', 'GBPNZD'], weights: [35, 30, 10, 8, 8, 5, 4] },
  'AUD': { pairs: ['EURAUD', 'AUDUSD', 'AUDJPY', 'GBPAUD', 'AUDCAD', 'AUDCHF', 'AUDNZD'], weights: [20, 25, 20, 10, 10, 5, 10] },
  'CAD': { pairs: ['EURCAD', 'USDCAD', 'CADJPY', 'GBPCAD', 'AUDCAD', 'CADCHF', 'NZDCAD'], weights: [15, 40, 10, 10, 10, 8, 7] },
  'CHF': { pairs: ['EURCHF', 'USDCHF', 'CHFJPY', 'GBPCHF', 'CADCHF', 'AUDCHF', 'NZDCHF'], weights: [30, 35, 16, 8, 5, 4, 2] },
  'NZD': { pairs: ['EURNZD', 'NZDUSD', 'NZDJPY', 'GBPNZD', 'NZDCAD', 'NZDCHF', 'AUDNZD'], weights: [15, 25, 15, 10, 10, 5, 20] },
};

// cTrader missing inverses: USDGBP, AUDGBP, CADGBP, CHFGBP, NZDGBP
// Note: CHF basket now includes AUDCHF (7 pairs, consistent with other baskets)
function getPairPrice(pair, priceMap) {
  const price = priceMap.get(pair);
  if (price) return price;

  // Try inverse pairs for cTrader compatibility
  const inverses = {
    'EURGBP': 'GBPEUR', 'USDGBP': 'GBPUSD', 'AUDGBP': 'GBPAUD', 'CADGBP': 'GBPCAD',
    'CHFGBP': 'GBPCHF', 'NZDGBP': 'GBPNZD'
  };
  const inverse = inverses[pair];
  return inverse && priceMap.get(inverse) ? 1 / priceMap.get(inverse) : null;
}

// Calculate ln-weighted basket value: Σ(weight[i] × ln(adjustedPrice[i]))
// Returns: { value: number, coverage: number } - coverage = ratio of available pairs to total
export function calculateBasketValue(currency, priceMap) {
  const basket = BASKET_DEFINITIONS[currency];
  if (!basket) return null;

  let logSum = 0;
  let availableWeight = 0;
  const totalWeight = basket.weights.reduce((a, b) => a + b, 0);

  for (let i = 0; i < basket.pairs.length; i++) {
    const pair = basket.pairs[i];
    const price = getPairPrice(pair, priceMap);
    if (!price) continue; // Skip missing pairs instead of failing

    const adjustedPrice = pair.startsWith(currency) ? price : (1 / price);
    const normalizedWeight = basket.weights[i] / totalWeight;
    const logValue = Math.log(adjustedPrice);
    const contribution = normalizedWeight * logValue;
    logSum += contribution;
    availableWeight += basket.weights[i];
  }

  const coverage = availableWeight / totalWeight;

  // Require 100% coverage - complete basket or nothing
  if (coverage < 1.0) return null;

  // CRITICAL FIX: Do NOT scale by coverage (TradingView doesn't scale)
  // The logSum is already weighted correctly; scaling causes extreme values
  return { value: logSum, coverage };
}

// Normalize to 100wt baseline: (exp(current) / exp(baseline)) × 100
export function normalizeToBaseline(currentLog, baselineLog) {
  if (baselineLog === null || currentLog === null) return null;
  return (Math.exp(currentLog) / Math.exp(baselineLog)) * 100;
}

// Initialize all baskets with baseline log values
export function initializeBaskets(priceMap) {
  const baskets = {};
  for (const currency of Object.keys(BASKET_DEFINITIONS)) {
    const baselineLog = calculateBasketValue(currency, priceMap);
    baskets[currency] = {
      currency,
      baselineLog,
      currentLog: baselineLog,
      normalized: 100,
      changePercent: 0
    };
  }
  return baskets;
}

// Get all unique pairs from all basket definitions
export function getAllPairs() {
  const pairSet = new Set();
  for (const basket of Object.values(BASKET_DEFINITIONS)) {
    basket.pairs.forEach(pair => pairSet.add(pair));
  }
  return Array.from(pairSet);
}

// Check if state has all daily opens for baseline initialization
// Requires 100% of pairs for accurate basket calculation
export function hasMinimumDailyOpens(state) {
  return state.dailyOpenPrices.size >= getAllPairs().length;
}

// Validate calculation result for correctness
// Returns: { valid: boolean, reason: string|null }
export function validateCalculationResult(result) {
  if (!result) {
    return { valid: false, reason: 'Result is null or undefined' };
  }
  if (typeof result.value !== 'number' || !Number.isFinite(result.value)) {
    return { valid: false, reason: 'Value must be a finite number' };
  }
  if (typeof result.coverage !== 'number') {
    return { valid: false, reason: 'Coverage must be a number' };
  }
  if (result.coverage <= 0) {
    return { valid: false, reason: 'Coverage must be greater than 0' };
  }
  if (result.coverage > 1) {
    return { valid: false, reason: 'Coverage cannot exceed 1' };
  }
  return { valid: true, reason: null };
}
