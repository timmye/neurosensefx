/**
 * Regression tests for the frontend half of the stale-data-after-hours fix
 * (docs/bugs/stale-data-after-hours.md).
 *
 * After the backend canonicalizes profile symbols (upper-case + strip), a
 * profileUpdate is emitted under the canonical form (e.g. "JPN225"). The
 * frontend may have subscribed under a feed's raw form (e.g. "jpn225"), so
 * dispatch must normalize both sides. Profile updates are also delivered
 * source-agnostically because the profile is one shared object per instrument.
 */
import { describe, it, expect } from 'vitest';
import { SubscriptionManager } from '../subscriptionManager.js';

describe('SubscriptionManager profileUpdate dispatch (regression: stale-data-after-hours)', () => {
  it('delivers a profileUpdate to a subscriber regardless of symbol case/suffix', () => {
    const sm = new SubscriptionManager();
    const received = [];
    // Subscribed under TradingView's raw lowercase form.
    sm.subscribe(sm.makeKey('jpn225', 'tradingview'), (msg) => received.push(msg.symbol));

    // Backend emits under the canonical normalized form.
    sm.dispatch({ type: 'profileUpdate', symbol: 'JPN225', source: 'tradingview', profile: { levels: [] }, seq: 1 });

    expect(received).toEqual(['JPN225']);
  });

  it('delivers profileUpdates source-agnostically (profile is shared across feeds)', () => {
    const sm = new SubscriptionManager();
    const got = [];
    sm.subscribe(sm.makeKey('EURUSD', 'tradingview'), () => got.push('tv'));

    // After the fix the canonical profile is populated by both feeds; an update
    // originating from cTrader must still reach the TradingView subscriber.
    sm.dispatch({ type: 'profileUpdate', symbol: 'EURUSD', source: 'ctrader', profile: { levels: [] }, seq: 1 });

    expect(got).toEqual(['tv']);
  });

  it('does not deliver non-profile messages by normalized symbol (tick path untouched)', () => {
    const sm = new SubscriptionManager();
    const got = [];
    sm.subscribe(sm.makeKey('jpn225', 'tradingview'), () => got.push('tick'));

    // A tick under a different-case symbol must NOT match — tick routing is
    // exact (unchanged), only profile routing is normalized.
    sm.dispatch({ type: 'tick', symbol: 'JPN225', source: 'tradingview', price: 39000 });

    expect(got).toEqual([]);
  });
});

describe('SubscriptionManager twapUpdate dispatch (regression: stale-data-after-hours)', () => {
  it('delivers a twapUpdate to a subscriber regardless of symbol case/suffix', () => {
    const sm = new SubscriptionManager();
    const received = [];
    // Subscribed under TradingView's raw lowercase form.
    sm.subscribe(sm.makeKey('jpn225', 'tradingview'), (msg) => received.push(msg.symbol));

    // Backend emits under the canonical normalized form; twapUpdate has no source field.
    sm.dispatch({ type: 'twapUpdate', symbol: 'JPN225', data: { twapValue: 39000 } });

    expect(received).toEqual(['JPN225']);
  });

  it('delivers twapUpdates source-agnostically (TWAP is shared across feeds)', () => {
    const sm = new SubscriptionManager();
    const got = [];
    sm.subscribe(sm.makeKey('EURUSD', 'tradingview'), () => got.push('tv'));

    // One canonical TWAP per instrument, broadcast to all sources by the backend.
    sm.dispatch({ type: 'twapUpdate', symbol: 'EURUSD', data: { twapValue: 1.085 } });

    expect(got).toEqual(['tv']);
  });

  it('does not deliver non-twap messages by normalized symbol (tick path untouched)', () => {
    const sm = new SubscriptionManager();
    const got = [];
    sm.subscribe(sm.makeKey('jpn225', 'tradingview'), () => got.push('tick'));

    sm.dispatch({ type: 'tick', symbol: 'JPN225', source: 'tradingview', price: 39000 });

    expect(got).toEqual([]);
  });
});
