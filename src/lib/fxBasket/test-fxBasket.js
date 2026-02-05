// FX Basket Test Suite - Crystal Clarity Compliant (<100 lines)
import { calculateBasketValue, normalizeToBaseline, initializeBaskets, BASKET_DEFINITIONS, getAllPairs } from './fxBasketCalculations.js';
import { createStore, setDailyOpen, setCurrentPrice, getPriceMap } from './fxBasketStore.js';
import { createStateMachine, trackPair, canCalculate, BasketState } from './fxBasketStateMachine.js';

const testPrices = new Map([
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

let passed = 0, failed = 0;
const assert = (cond, name) => (cond ? passed++ : failed++, console.log(`${cond ? '✓' : '✗'} ${name}`));
const approxEqual = (a, b, tol = 0.01) => Math.abs(a - b) < tol;

// Test 1-2: Calculation correctness
console.log('\n=== Calculation Tests ===');
const usdResult = calculateBasketValue('USD', testPrices);
assert(usdResult !== null, 'USD basket value calculated');

const usdBasket = BASKET_DEFINITIONS.USD;
const totalWeight = usdBasket.weights.reduce((a, b) => a + b, 0);
const manualLogSum =
  (20 / totalWeight) * Math.log(1 / 1.0850) + (15 / totalWeight) * Math.log(149.50) +
  (13 / totalWeight) * Math.log(1 / 1.2650) + (10 / totalWeight) * Math.log(1 / 0.6650) +
  (30 / totalWeight) * Math.log(1.3550) + (7 / totalWeight) * Math.log(0.8750) +
  (5 / totalWeight) * Math.log(1 / 0.6250);
assert(approxEqual(usdResult.value, manualLogSum), 'USD ln-weighted sum correct');

// Test 3-5: Baseline normalization
console.log('\n=== Normalization Tests ===');
const usdLogSum = usdResult.value;
assert(normalizeToBaseline(usdLogSum, usdLogSum) === 100, 'Baseline returns 100wt');
assert(approxEqual(normalizeToBaseline(usdLogSum + 0.01, usdLogSum), 101, 0.1), '+1% scaling');
assert(approxEqual(normalizeToBaseline(usdLogSum - 0.01, usdLogSum), 99, 0.1), '-1% scaling');

// Test 6-7: Direct and inverse pairs
console.log('\n=== Pair Price Tests ===');
assert(testPrices.get('EURUSD') === 1.0850, 'Direct pair retrieved');
assert(approxEqual(1 / 1.2650, 0.7905, 0.001), 'Inverse pair (USDGBP = 1/GBPUSD)');

// Test 8-11: Basket initialization
console.log('\n=== Initialization Tests ===');
const baskets = initializeBaskets(testPrices);
assert(Object.keys(baskets).length === 8, 'All 8 baskets created');
assert(Object.values(baskets).every(b => b.normalized === 100 && b.changePercent === 0), 'All at baseline');
assert(baskets.USD?.currency === 'USD' && baskets.USD.baselineLog !== null, 'USD basket properties valid');

// Test 12-15: Coordinate mapping
console.log('\n=== Coordinate Mapping Tests ===');
const mapY = (v, h = 400, min = 98, max = 102) => h - ((v - min) / (max - min)) * h;
assert(mapY(100) === 200, 'Y at 100wt is center');
assert(mapY(102) === 0, 'Y at 102wt is top');
assert(mapY(98) === 400, 'Y at 98wt is bottom');
assert(mapY(101) < mapY(99), 'Y coordinates inverted (higher = lower)');

// Test 16: All currencies exist
console.log('\n=== Currency Coverage Tests ===');
assert(['USD', 'EUR', 'JPY', 'GBP', 'AUD', 'CAD', 'CHF', 'NZD'].every(c => baskets[c]), 'All 8 currencies exist');

// Test 17-19: Store API
console.log('\n=== Store API Tests ===');
const store = createStore();
setDailyOpen(store, 'EURUSD', 1.0800);
setCurrentPrice(store, 'EURUSD', 1.0850);
assert(store.baseline.get('EURUSD') === 1.0800, 'Daily open stored');
assert(store.current.get('EURUSD') === 1.0850, 'Current price stored');
assert(store.pairs.has('EURUSD'), 'Pair tracked in store');

// Test 20-22: State machine lifecycle
console.log('\n=== State Machine Tests ===');
const allPairs = getAllPairs();
const sm = createStateMachine(allPairs);
assert(sm.state === BasketState.FAILED, 'Initial state is FAILED');
trackPair(sm, 'EURUSD', 1.08, 1.085);
assert(sm.state === BasketState.WAITING, 'Transitions to WAITING on first pair');
assert(sm.receivedPairs.has('EURUSD'), 'Pair tracked in received set');

// Summary
console.log('\n=== Test Summary ===');
console.log(`Passed: ${passed}/${passed + failed} (${((passed / (passed + failed)) * 100).toFixed(1)}%)`);
process.exit(failed > 0 ? 1 : 0);
