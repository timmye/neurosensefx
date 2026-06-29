import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

// NOTE on mock paths: this test lives in src/stores/__tests__/, ONE level deeper
// than marketDataStore.js (src/stores/). So paths to src/lib/* are
// ../../lib/* (two levels up), while paths to src/stores/* siblings are ../ .

// Captured subscriber callback, so tests can drive the public
// subscribeToSymbol -> dispatch path without a live socket.
let capturedCallback = null;
const unsubscribeSpy = vi.fn();

vi.mock('../../lib/connectionManager.js', () => ({
  ConnectionManager: {
    getInstance: () => ({
      subscribeAndRequest: (symbol, callback) => {
        capturedCallback = callback;
        return unsubscribeSpy;
      },
      addSystemSubscription: () => () => {},
      addStatusCallback: () => () => {},
      status: 'connected',
      displayStatus: 'Connected'
    })
  }
}));

vi.mock('../../lib/displayDataProcessor.js', () => ({
  getWebSocketUrl: () => 'ws://test'
}));

vi.mock('../../lib/dataContracts.js', () => ({
  validateWebSocketMessage: () => ({ valid: true, errors: [] }),
  logValidationResult: () => {}
}));

// Mocked normalizer: throws on a sentinel so we can drive the error path;
// otherwise delegates to the real implementation. Avoids vi.spyOn ESM pitfalls.
vi.mock('../marketDataNormalizer.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    normalizeSymbolDataPackage: (data, current) => {
      if (data?.__forceThrow) throw new Error('forced normalize failure');
      return actual.normalizeSymbolDataPackage(data, current);
    },
    normalizeTick: (data, current) => {
      if (data?.__forceThrow) throw new Error('forced normalize failure');
      return actual.normalizeTick(data, current);
    }
  };
});

import { getMarketDataStore, subscribeToSymbol } from '../marketDataStore.js';

// --- Helpers ------------------------------------------------------------

// Subscribe to the store non-mutatingly and count notifications.
function tracker(symbol) {
  let calls = 0;
  const last = {};
  const unsub = getMarketDataStore(symbol).subscribe(v => {
    calls++;
    Object.assign(last, v);
  });
  return { unsub, calls: () => calls, last: () => last };
}

beforeEach(() => {
  capturedCallback = null;
  unsubscribeSpy.mockClear();
});

// Emit a frame through the public dispatch path.
function emit(data) {
  if (!capturedCallback) throw new Error('no captured callback — subscribe first');
  capturedCallback(data);
}

// Fresh symbol per test avoids module-state leakage (the DEV window helper
// clearAllStores is unavailable in node env).
let __seq = 0;
function freshSymbol(name = 'SYM') {
  return `${name}_${++__seq}`;
}

// --- Tests ---------------------------------------------------------------

describe('marketDataStore — refresh contract', () => {
  it('#1 notifies on price change', () => {
    const symbol = freshSymbol('EURUSD');
    const t = tracker(symbol);
    subscribeToSymbol(symbol, 'ctrader');

    emit({ type: 'tick', price: 1.1 });

    expect(t.calls()).toBeGreaterThan(0);
    expect(get(getMarketDataStore(symbol)).current).toBe(1.1);
    t.unsub();
  });

  it('#2 skips notification on same price (equality gate)', () => {
    const symbol = freshSymbol('EURUSD');
    const t = tracker(symbol);
    subscribeToSymbol(symbol, 'ctrader');

    // Establish the price twice so previousPrice stabilises (the normalizer
    // legitimately flips previousPrice null->price on the first tick; we want
    // to assert the gate on a tick that carries genuinely no new information).
    emit({ type: 'tick', price: 1.1 });
    emit({ type: 'tick', price: 1.1 });
    const callsAfterSettle = t.calls();
    const beforeLatency = get(getMarketDataStore(symbol)).latency;
    const beforeLastUpdate = get(getMarketDataStore(symbol)).lastUpdate;

    // Third identical tick: no price-relevant field changes -> gate suppresses.
    emit({ type: 'tick', price: 1.1 });

    expect(t.calls()).toBe(callsAfterSettle); // no new notification
    // Metadata intentionally frozen along with the skip.
    expect(get(getMarketDataStore(symbol)).latency).toBe(beforeLatency);
    expect(get(getMarketDataStore(symbol)).lastUpdate).toBe(beforeLastUpdate);
    t.unsub();
  });

  it('#3 notifies on non-current price-relevant change (symbolDataPackage)', () => {
    const symbol = freshSymbol('GBPUSD');
    const t = tracker(symbol);
    subscribeToSymbol(symbol, 'ctrader');

    // Establish a current price first.
    emit({ type: 'symbolDataPackage', current: 1.3 });
    const callsBefore = t.calls();

    // Same current, but changed price-relevant fields (open, adrHigh).
    emit({ type: 'symbolDataPackage', current: 1.3, open: 1.29, adrHigh: 1.31 });

    expect(t.calls()).toBeGreaterThan(callsBefore); // gate lets it through
    const state = get(getMarketDataStore(symbol));
    expect(state.open).toBe(1.29);
    expect(state.adrHigh).toBe(1.31);
    t.unsub();
  });

  it('#4 error surfaces status, preserves price, then recovers on a good same-price tick', () => {
    const symbol = freshSymbol('USDJPY');
    const t = tracker(symbol);
    subscribeToSymbol(symbol, 'ctrader');

    // Establish a good price.
    emit({ type: 'tick', price: 150.0 });
    expect(get(getMarketDataStore(symbol)).current).toBe(150.0);

    // Force the normalizer to throw — current price must be preserved.
    emit({ type: 'tick', price: 150.1, __forceThrow: true });

    const afterError = get(getMarketDataStore(symbol));
    expect(afterError.status).toBe('error');
    expect(afterError.error).toBeTruthy();
    expect(afterError.current).toBe(150.0); // preserved, not nulled

    // A good tick with the SAME price as the last good value must still
    // recover status to 'connected' (the error-status recovery rule).
    emit({ type: 'tick', price: 150.0 });

    const recovered = get(getMarketDataStore(symbol));
    expect(recovered.status).toBe('connected');
    expect(recovered.error).toBeNull();
    t.unsub();
  });

  it('#5 refcount lifecycle — unsubscribe only after last subscriber', () => {
    const symbol = freshSymbol('AUDUSD');
    const t = tracker(symbol);

    // Two subscribers (the tracker only listens to the store; refcount is
    // driven by subscribeToSymbol calls).
    const unsub1 = subscribeToSymbol(symbol, 'ctrader');
    const unsub2 = subscribeToSymbol(symbol, 'ctrader');

    // First unsubscribe: connection-level unsub NOT called yet, store still active.
    unsub2();
    expect(unsubscribeSpy).not.toHaveBeenCalled();
    expect(get(getMarketDataStore(symbol)).status).not.toBe('stale');

    // Second unsubscribe: connection-level unsub called exactly once, store stale.
    unsub1();
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(get(getMarketDataStore(symbol)).status).toBe('stale');
    t.unsub();
  });
});
