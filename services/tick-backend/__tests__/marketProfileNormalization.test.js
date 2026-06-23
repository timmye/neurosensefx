/**
 * Regression tests for the stale-data-after-hours bug (docs/bugs/stale-data-after-hours.md).
 *
 * Root cause: commit e0bf607 normalized cTrader symbol names but not TradingView's,
 * so the same instrument was profiled under two keys (e.g. "USDJPY" vs "usdjpy").
 * The missing key auto-initialized with no price -> flat 0.0001 forex bucket ->
 * instant MAX_LEVELS freeze -> stale mini market profile until restart.
 *
 * Fix: MarketProfileService canonicalizes the symbol (upper-case + strip slashes/
 * suffixes) at every entry point, and the auto-init path now passes bar.close as
 * currentPrice so a price-based bucket is always used.
 */
import { describe, it, expect } from 'vitest';

const { MarketProfileService } = require('../MarketProfileService');

const bar = (price, ts = Date.now()) => ({
  timestamp: ts,
  open: price,
  high: price + 30,
  low: price - 20,
  close: price,
});

describe('Market Profile symbol normalization (regression: stale-data-after-hours)', () => {
  it('keys one canonical profile regardless of feed name form', () => {
    const mps = new MarketProfileService();
    mps.subscribeToSymbol('usdjpy', 'tradingview', 195.5);
    mps.subscribeToSymbol('USD/JPY.P', 'ctrader', 195.5);
    mps.subscribeToSymbol('USDJPY', 'ctrader', 195.5);

    expect(mps.profiles.size).toBe(1);
    expect([...mps.profiles.keys()]).toEqual(['USDJPY']);
  });

  it('a cTrader bar (normalized name) does NOT freeze a TradingView-initialized profile', () => {
    const mps = new MarketProfileService();
    // TradingView initializes the profile under a raw lowercase name, with a price.
    mps.subscribeToSymbol('jpn225', 'tradingview', 39000);

    const errors = [];
    mps.on('profileError', (d) => errors.push(d));

    // cTrader live M1 bar arrives under the normalized uppercase name.
    mps.onM1Bar('JPN225', bar(39020), 'ctrader');

    // Same canonical profile (no second, frozen profile created).
    expect(mps.profiles.size).toBe(1);
    // No MAX_LEVELS freeze.
    expect(errors).toEqual([]);
    // Bucket must be price-based (~3.9 for ~39000), not the flat 0.0001 default.
    const profile = mps.profiles.get('JPN225');
    expect(profile.bucketSize).toBeGreaterThan(0.1);
  });

  it('auto-init (no prior profile) derives a price-based bucket from bar.close, not 0.0001', () => {
    const mps = new MarketProfileService();
    const errors = [];
    mps.on('profileError', (d) => errors.push(d));

    // First ever bar for this symbol -> auto-init path. Must not freeze.
    mps.onM1Bar('JPN225', bar(39020), 'ctrader');

    const profile = mps.profiles.get('JPN225');
    expect(profile).toBeDefined();
    expect(profile.bucketSize).toBeGreaterThan(0.1); // 0.0001 is the broken flat default
    expect(errors).toEqual([]);
  });

  it('isSymbolInitializing normalizes the symbol (used by WebSocketServer)', () => {
    const mps = new MarketProfileService();
    mps.isInitializing.set('USDJPY', true);
    expect(mps.isSymbolInitializing('usdjpy')).toBe(true);
    expect(mps.isSymbolInitializing('USD/JPY.P')).toBe(true);
    expect(mps.isSymbolInitializing('EURUSD')).toBe(false);
  });

  it('cleanupSymbol works regardless of incoming name form', () => {
    const mps = new MarketProfileService();
    mps.subscribeToSymbol('xagusd', 'tradingview', 30.5);
    expect(mps.profiles.size).toBe(1);
    mps.cleanupSymbol('XAG/USD'); // different form, must still remove the canonical profile
    expect(mps.profiles.size).toBe(0);
  });
});
