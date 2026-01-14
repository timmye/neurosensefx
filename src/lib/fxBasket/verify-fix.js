// Verify FX Basket fix - Check for extreme values
import { calculateBasketValue, normalizeToBaseline, BASKET_DEFINITIONS } from './fxBasketCalculations.js';

// Real-world FX prices (approximate daily open)
const dailyOpenPrices = new Map([
  ['EURUSD', 1.0850], ['GBPUSD', 1.2650], ['USDJPY', 149.50],
  ['AUDUSD', 0.6650], ['USDCAD', 1.3550], ['USDCHF', 0.8750],
  ['NZDUSD', 0.6250], ['EURJPY', 162.15], ['EURGBP', 0.8577],
  ['EURAUD', 1.6315], ['EURCHF', 0.9493], ['EURCAD', 1.4702],
  ['EURNZD', 1.7355], ['GBPJPY', 189.10], ['GBPAUD', 1.9015],
  ['GBPCAD', 1.7145], ['GBPCHF', 1.1070], ['GBPNZD', 2.0235],
  ['AUDJPY', 99.35], ['CADJPY', 110.30], ['CHFJPY', 170.80],
  ['NZDJPY', 93.45], ['AUDCAD', 0.9105], ['AUDCHF', 0.5825],
  ['AUDNZD', 1.0640], ['CADCHF', 0.6455], ['NZDCAD', 0.8550],
  ['NZDCHF', 0.6065]
]);

// Simulate price movement (1-2% changes)
const currentPrices = new Map(dailyOpenPrices);
currentPrices.set('EURUSD', 1.0950); // EUR +0.9%
currentPrices.set('USDJPY', 148.50); // JPY strengthening (USD/JPY down)
currentPrices.set('AUDUSD', 0.6750); // AUD +1.5%

console.log('=== FX Basket Calculation Verification ===\n');

const currencies = ['USD', 'EUR', 'JPY', 'GBP', 'AUD', 'CAD', 'CHF', 'NZD'];
const results = {};

for (const currency of currencies) {
  const baseline = calculateBasketValue(currency, dailyOpenPrices);
  const current = calculateBasketValue(currency, currentPrices);

  if (baseline && current) {
    const normalized = normalizeToBaseline(current.value, baseline.value);
    const change = normalized - 100;
    results[currency] = { normalized, change };
    console.log(`${currency}: ${normalized.toFixed(2)}wt (${change > 0 ? '+' : ''}${change.toFixed(2)}%)`);
  }
}

// Verify values are reasonable
console.log('\n=== Sanity Checks ===');
const maxChange = Math.max(...Object.values(results).map(r => Math.abs(r.change)));
console.log('Max change:', maxChange.toFixed(2) + '%');

if (maxChange > 10) {
  console.log('❌ FAIL: Changes too large (should be <5% for 1-2% FX moves)');
  process.exit(1);
} else if (maxChange > 5) {
  console.log('⚠️  WARNING: Changes elevated (expected <5%)');
} else {
  console.log('✓ PASS: Changes within expected range');
}

// Check for extreme values
const hasExtreme = Object.values(results).some(r => Math.abs(r.change) > 50);
console.log('Has extreme values (>50%):', hasExtreme ? '❌ YES (BUG!)' : '✓ NO');

if (hasExtreme) {
  console.log('\n❌ VERIFICATION FAILED - Extreme values detected!');
  process.exit(1);
} else {
  console.log('\n✓ VERIFICATION PASSED - All values reasonable');
}
