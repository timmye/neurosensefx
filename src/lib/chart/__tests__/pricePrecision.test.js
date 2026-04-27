/**
 * Price Precision Verification Tests
 *
 * Verifies the reactive applyPricePrecision fix:
 *   1. Fresh chart init uses store defaults → precision 5 (transient, expected)
 *   2. After symbolDataPackage arrives → precision auto-corrects via subscription
 *   3. Per-asset-type precision matrix for both cTrader and TradingView sources
 *
 * Run: npm run test:unit -- src/lib/chart/__tests__/pricePrecision.test.js
 */

import { describe, it, expect } from 'vitest';
import { writable, get } from 'svelte/store';

// ── Replicate the exact logic from ChartDisplay.svelte ──

function createInitialData(symbol) {
  return {
    symbol,
    digits: null,
    pipPosition: 4,
    pipSize: 0.0001,
    pipetteSize: 0.00001,
  };
}

function normalizeSymbolDataPackage(data, currentState) {
  return {
    ...currentState,
    pipPosition: data.pipPosition ?? currentState.pipPosition,
    pipSize: data.pipSize ?? currentState.pipSize,
    pipetteSize: data.pipetteSize ?? currentState.pipetteSize,
    digits: data.digits ?? currentState.digits,
  };
}

/** Exact formula from ChartDisplay.svelte */
function computePrecision(data) {
  return data.digits ?? (data.pipPosition ?? 4) + 1;
}

/**
 * Replicates the FIXED applyPricePrecision — self-unsubscribes once digits arrives.
 * Note: Svelte store.subscribe() fires synchronously on subscribe with current value,
 * so the initial manual call + subscribe fire = 2 calls at init time when digits is null.
 * Once digits arrives, the subscription self-unsubscribes.
 */
function applyPricePrecisionReactive(store, mockChart) {
  let precisionUnsub = null;
  const data = get(store);
  mockChart.setPriceVolumePrecision(computePrecision(data), 0);
  if (data.digits == null) {
    precisionUnsub = store.subscribe($data => {
      if ($data.digits != null) {
        precisionUnsub?.(); precisionUnsub = null;
      }
      mockChart.setPriceVolumePrecision(computePrecision($data), 0);
    });
  }
  return () => { precisionUnsub?.(); precisionUnsub = null; };
}

function createMockChart() {
  const calls = [];
  return {
    setPriceVolumePrecision: (price, vol) => calls.push(price),
    getCalls: () => calls,
  };
}

/** Helper: get the last precision value set on the mock chart */
function lastPrecision(chart) {
  const calls = chart.getCalls();
  return calls[calls.length - 1];
}

// ── Test: Reactive subscription corrects precision after data arrives ──

describe('reactive applyPricePrecision', () => {
  it('initial precision is 5 (defaults), then corrects to 3 when USDJPY data arrives', () => {
    const store = writable(createInitialData('USDJPY'));
    const chart = createMockChart();

    applyPricePrecisionReactive(store, chart);

    // Initial: digits=null, pipPosition=4 → 5 (called twice: manual + subscribe fire)
    expect(lastPrecision(chart)).toBe(5);

    // symbolDataPackage arrives
    store.set(normalizeSymbolDataPackage(
      { type: 'symbolDataPackage', digits: 3, pipPosition: 2, pipSize: 0.01, pipetteSize: 0.001 },
      get(store)
    ));

    // Subscription fires: digits=3 → 3
    expect(lastPrecision(chart)).toBe(3);
  });

  it('initial precision is 5, then corrects to 2 when XAUUSD data arrives', () => {
    const store = writable(createInitialData('XAUUSD'));
    const chart = createMockChart();

    applyPricePrecisionReactive(store, chart);
    expect(lastPrecision(chart)).toBe(5);

    store.set(normalizeSymbolDataPackage(
      { type: 'symbolDataPackage', digits: 2, pipPosition: 1, pipSize: 0.1, pipetteSize: 0.01 },
      get(store)
    ));

    expect(lastPrecision(chart)).toBe(2);
  });

  it('EURUSD stays at 5 (correct from init)', () => {
    const store = writable(createInitialData('EURUSD'));
    const chart = createMockChart();

    applyPricePrecisionReactive(store, chart);
    expect(lastPrecision(chart)).toBe(5);

    store.set(normalizeSymbolDataPackage(
      { type: 'symbolDataPackage', digits: 5, pipPosition: 4, pipSize: 0.0001, pipetteSize: 0.00001 },
      get(store)
    ));

    expect(lastPrecision(chart)).toBe(5);
  });

  it('precision corrects for XAGUSD (digits=4)', () => {
    const store = writable(createInitialData('XAGUSD'));
    const chart = createMockChart();

    applyPricePrecisionReactive(store, chart);
    expect(lastPrecision(chart)).toBe(5);

    store.set(normalizeSymbolDataPackage(
      { type: 'symbolDataPackage', digits: 4, pipPosition: 3, pipSize: 0.001, pipetteSize: 0.0001 },
      get(store)
    ));

    expect(lastPrecision(chart)).toBe(4);
  });
});

// ── Test: Per-asset-type precision matrix (cTrader source) ──

describe('per-asset precision matrix — cTrader source (reactive)', () => {
  const cTraderSymbols = [
    { symbol: 'EURUSD', digits: 5, pipPosition: 4, expected: 5 },
    { symbol: 'GBPUSD', digits: 5, pipPosition: 4, expected: 5 },
    { symbol: 'USDJPY', digits: 3, pipPosition: 2, expected: 3 },
    { symbol: 'GBPJPY', digits: 3, pipPosition: 2, expected: 3 },
    { symbol: 'XAUUSD', digits: 2, pipPosition: 1, expected: 2 },
    { symbol: 'XAGUSD', digits: 4, pipPosition: 3, expected: 4 },
  ];

  cTraderSymbols.forEach(({ symbol, digits, pipPosition, expected }) => {
    it(`${symbol}: data arrives → precision corrects to ${expected}`, () => {
      const store = writable(createInitialData(symbol));
      const chart = createMockChart();

      applyPricePrecisionReactive(store, chart);

      // Init is always 5
      expect(lastPrecision(chart)).toBe(5);

      // Data arrives
      store.set(normalizeSymbolDataPackage(
        { type: 'symbolDataPackage', digits, pipPosition, pipSize: Math.pow(10, -pipPosition), pipetteSize: Math.pow(10, -(pipPosition + 1)) },
        get(store)
      ));

      // Final precision is correct
      expect(lastPrecision(chart)).toBe(expected);
    });
  });
});

// ── Test: TradingView estimatePipData (FIXED thresholds) ──

describe('estimatePipData — fixed thresholds', () => {
  // Replicate the fixed function from TradingViewCandleHandler.js
  function estimatePipData(price) {
    if (price > 10000) return { pipPosition: 1, pipSize: 0.1, pipetteSize: 0.01 };
    if (price > 1000) return { pipPosition: 1, pipSize: 0.1, pipetteSize: 0.01 };
    if (price > 10) return { pipPosition: 2, pipSize: 0.01, pipetteSize: 0.001 };
    return { pipPosition: 4, pipSize: 0.0001, pipetteSize: 0.00001 };
  }

  it('US30 (price ~39850) → pipPosition=1 (was 0, now fixed)', () => {
    const est = estimatePipData(39850);
    expect(est.pipPosition).toBe(1);
  });

  it('BTCUSD (price ~67500) → pipPosition=1 (was 0, now fixed)', () => {
    const est = estimatePipData(67500);
    expect(est.pipPosition).toBe(1);
  });

  it('XAUUSD (price ~2340) → pipPosition=1', () => {
    const est = estimatePipData(2340);
    expect(est.pipPosition).toBe(1);
  });

  it('XAGUSD (price ~29) → pipPosition=2 (best effort — real is 3)', () => {
    const est = estimatePipData(29.15);
    expect(est.pipPosition).toBe(2);
  });

  it('USDJPY (price ~149) → pipPosition=2', () => {
    const est = estimatePipData(149.5);
    expect(est.pipPosition).toBe(2);
  });

  it('EURUSD (price ~1.08) → pipPosition=4', () => {
    const est = estimatePipData(1.085);
    expect(est.pipPosition).toBe(4);
  });
});

// ── Test: Subscription cleanup ──

describe('subscription cleanup', () => {
  it('self-unsubscribes after digits arrives — no more calls on subsequent ticks', () => {
    const store = writable(createInitialData('USDJPY'));
    const chart = createMockChart();

    const unsub = applyPricePrecisionReactive(store, chart);
    // subscribe fires synchronously → 2 calls (manual + subscribe initial)
    expect(chart.getCalls().length).toBe(2);

    // symbolDataPackage arrives with digits — subscription self-unsubscribes
    store.set(normalizeSymbolDataPackage(
      { type: 'symbolDataPackage', digits: 3, pipPosition: 2, pipSize: 0.01, pipetteSize: 0.001 },
      get(store)
    ));
    expect(chart.getCalls().length).toBe(3);
    expect(lastPrecision(chart)).toBe(3);

    // Simulate tick updates — subscription already self-unsubscribed
    store.set({ ...get(store), current: 160.0 });
    store.set({ ...get(store), current: 160.1 });
    expect(chart.getCalls().length).toBe(3); // unchanged — no leak
  });

  it('explicit teardown (onDestroy) also unsubscribes', () => {
    const store = writable(createInitialData('USDJPY'));
    const chart = createMockChart();

    const unsub = applyPricePrecisionReactive(store, chart);
    expect(chart.getCalls().length).toBe(2);

    // Explicit teardown before data arrives
    unsub();

    // Data arrives — no call because unsubscribed
    store.set(normalizeSymbolDataPackage(
      { type: 'symbolDataPackage', digits: 3, pipPosition: 2, pipSize: 0.01, pipetteSize: 0.001 },
      get(store)
    ));
    expect(chart.getCalls().length).toBe(2); // unchanged
  });

  it('no subscription created when digits already available', () => {
    const store = writable(createInitialData('EURUSD'));
    // Pre-populate with real data (simulates previously-loaded symbol)
    store.set(normalizeSymbolDataPackage(
      { type: 'symbolDataPackage', digits: 5, pipPosition: 4, pipSize: 0.0001, pipetteSize: 0.00001 },
      get(store)
    ));

    const chart = createMockChart();
    const unsub = applyPricePrecisionReactive(store, chart);

    // Only 1 call (manual) — no subscription because digits != null
    expect(chart.getCalls().length).toBe(1);
    expect(lastPrecision(chart)).toBe(5);

    // Further updates don't trigger precision calls
    store.set({ ...get(store), current: 1.09 });
    expect(chart.getCalls().length).toBe(1);
  });
});
