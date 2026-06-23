/**
 * Regression tests for the TWAP half of the stale-data-after-hours fix
 * (docs/bugs/stale-data-after-hours.md). TWAP is part of the ticker display, so
 * it must key the same instrument identically across feeds — same canonical
 * normalization as MarketProfileService.
 *
 * Without canonicalization, cTrader (normalized names) and TradingView (raw names)
 * created two separate TWAP states per instrument (e.g. "USDJPY" vs "usdjpy"), so
 * the ticker showed stale/inconsistent TWAP depending on which feed's bars arrived.
 */
import { describe, it, expect } from 'vitest';

const { TwapService } = require('../TwapService');
const { normalizeSymbol } = require('../utils/normalizeSymbol');

const bar = (price, ts) => ({ timestamp: ts, open: price, high: price + 1, low: price - 1, close: price });

describe('Shared normalizeSymbol util', () => {
  it('upper-cases and strips slashes/suffixes, idempotently', () => {
    expect(normalizeSymbol('usdjpy')).toBe('USDJPY');
    expect(normalizeSymbol('USD/JPY.P')).toBe('USDJPY');
    expect(normalizeSymbol('US500.MAY25')).toBe('US500');
    expect(normalizeSymbol('JPN225')).toBe('JPN225');
    expect(normalizeSymbol(normalizeSymbol('EUR/USD.P'))).toBe('EURUSD'); // idempotent
    expect(normalizeSymbol(undefined)).toBeUndefined();
  });
});

describe('TwapService symbol normalization (regression: stale-data-after-hours)', () => {
  it('keys one TWAP state regardless of feed name form', () => {
    const ts = new TwapService();
    // TradingView live bar under raw lowercase name.
    ts.onM1Bar('usdjpy', bar(195.0, 1000), 'tradingview');
    // cTrader live bar (different timestamp) under normalized uppercase name.
    ts.onM1Bar('USD/JPY.P', bar(196.0, 2000), 'ctrader');

    // Same instrument -> ONE canonical state, not two.
    expect(ts.twapState.size).toBe(1);
    expect([...ts.twapState.keys()]).toEqual(['USDJPY']);
  });

  it('accumulates bars from both feeds into one TWAP (no split state)', () => {
    const ts = new TwapService();
    ts.onM1Bar('jpn225', bar(39000, 1000), 'tradingview');
    ts.onM1Bar('JPN225', bar(39200, 2000), 'ctrader');

    const state = ts.twapState.get('JPN225');
    expect(state).toBeDefined();
    expect(state.count).toBe(2); // both feeds' bars counted once together
    expect(state.twap).toBe((39000 + 39200) / 2);
  });

  it('initializeFromHistory is canonical (does not create a second state for the same instrument)', () => {
    const ts = new TwapService();
    const history = [bar(100, 1), bar(102, 2), bar(101, 3)];
    ts.initializeFromHistory('xagusd', history, 'tradingview');
    // A later init under a different name form must be a no-op (already initialized).
    ts.initializeFromHistory('XAG/USD', [bar(999, 4)], 'ctrader');

    expect(ts.twapState.size).toBe(1);
    expect(ts.getTwap('xagusd')).toBe(ts.getTwap('XAGUSD'));
    expect(ts.getTwap('XAG/USD')).toBeCloseTo((100 + 102 + 101) / 3);
  });

  it('resetDaily works regardless of incoming name form', () => {
    const ts = new TwapService();
    ts.onM1Bar('jpn225', bar(39000, 1000), 'tradingview');
    expect(ts.twapState.size).toBe(1);
    ts.resetDaily('JPN/225'); // different form, must still clear the canonical state
    expect(ts.twapState.size).toBe(0);
  });

  it('isSymbolInitializing normalizes the symbol (used by WebSocketServer)', () => {
    const ts = new TwapService();
    ts.isInitializing.set('USDJPY', true);
    expect(ts.isSymbolInitializing('usdjpy')).toBe(true);
    expect(ts.isSymbolInitializing('USD/JPY.P')).toBe(true);
    expect(ts.isSymbolInitializing('EURUSD')).toBe(false);
  });
});
