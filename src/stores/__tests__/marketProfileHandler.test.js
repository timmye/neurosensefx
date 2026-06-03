import { describe, it, expect } from 'vitest';
import { mergeProfileUpdate } from '../marketProfileHandler.js';

const baseCurrent = {
  marketProfile: [],
  high: null,
  low: null,
  _profileSource: null,
  lastUpdate: 0
};

describe('mergeProfileUpdate', () => {
  describe('source precedence', () => {
    it('accepts cTrader update when no prior profile source', () => {
      const current = { ...baseCurrent };
      const data = { feedSource: 'ctrader', profile: { levels: [{ price: 1 }] } };
      const result = mergeProfileUpdate(current, data);

      expect(result).not.toBeNull();
      expect(result._profileSource).toBe('ctrader');
      expect(result.marketProfile).toEqual([{ price: 1 }]);
    });

    it('accepts cTrader update when prior source is cTrader (overwrites)', () => {
      const current = { ...baseCurrent, _profileSource: 'ctrader' };
      const data = { feedSource: 'ctrader', profile: { levels: [{ price: 2 }] } };
      const result = mergeProfileUpdate(current, data);

      expect(result).not.toBeNull();
      expect(result._profileSource).toBe('ctrader');
      expect(result.marketProfile).toEqual([{ price: 2 }]);
    });

    it('returns null when cTrader update and prior source is tradingview', () => {
      const current = { ...baseCurrent, _profileSource: 'tradingview' };
      const data = { feedSource: 'ctrader', profile: { levels: [{ price: 1 }] } };
      const result = mergeProfileUpdate(current, data);

      expect(result).toBeNull();
    });

    it('accepts tradingview update when prior source is cTrader (upgrades source)', () => {
      const current = { ...baseCurrent, _profileSource: 'ctrader' };
      const data = { feedSource: 'tradingview', profile: { levels: [{ price: 3 }] } };
      const result = mergeProfileUpdate(current, data);

      expect(result).not.toBeNull();
      expect(result._profileSource).toBe('tradingview');
      expect(result.marketProfile).toEqual([{ price: 3 }]);
    });

    it('accepts tradingview update when prior source is tradingview', () => {
      const current = { ...baseCurrent, _profileSource: 'tradingview' };
      const data = { feedSource: 'tradingview', profile: { levels: [{ price: 4 }] } };
      const result = mergeProfileUpdate(current, data);

      expect(result).not.toBeNull();
      expect(result._profileSource).toBe('tradingview');
      expect(result.marketProfile).toEqual([{ price: 4 }]);
    });
  });

  describe('full profile replacement', () => {
    it('replaces marketProfile entirely with data.profile.levels', () => {
      const current = { ...baseCurrent, marketProfile: [{ price: 1 }, { price: 2 }] };
      const data = { feedSource: 'ctrader', profile: { levels: [{ price: 10 }, { price: 20 }] } };
      const result = mergeProfileUpdate(current, data);

      expect(result.marketProfile).toEqual([{ price: 10 }, { price: 20 }]);
    });

    it('empty levels array clears profile without changing high/low', () => {
      const current = { ...baseCurrent, high: 100, low: 50 };
      const data = { feedSource: 'ctrader', profile: { levels: [] } };
      const result = mergeProfileUpdate(current, data);

      expect(result.marketProfile).toEqual([]);
      expect(result.high).toBe(100);
      expect(result.low).toBe(50);
    });

    it('profile with single level sets both high and low to same price', () => {
      const current = { ...baseCurrent };
      const data = { feedSource: 'ctrader', profile: { levels: [{ price: 42 }] } };
      const result = mergeProfileUpdate(current, data);

      expect(result.high).toBe(42);
      expect(result.low).toBe(42);
    });
  });

  describe('delta merging', () => {
    it('delta with only added levels merges into empty profile', () => {
      const current = { ...baseCurrent };
      const data = { feedSource: 'ctrader', delta: { added: [{ price: 5 }, { price: 15 }] } };
      const result = mergeProfileUpdate(current, data);

      expect(result).not.toBeNull();
      expect(result.marketProfile).toEqual([{ price: 5 }, { price: 15 }]);
    });

    it('delta with only added levels merges into existing profile', () => {
      const current = { ...baseCurrent, marketProfile: [{ price: 10 }] };
      const data = { feedSource: 'ctrader', delta: { added: [{ price: 5 }] } };
      const result = mergeProfileUpdate(current, data);

      expect(result.marketProfile).toEqual([{ price: 5 }, { price: 10 }]);
    });

    it('delta with only updated levels updates matching prices', () => {
      const current = { ...baseCurrent, marketProfile: [{ price: 10, volume: 100 }] };
      const data = { feedSource: 'ctrader', delta: { updated: [{ price: 10, volume: 200 }] } };
      const result = mergeProfileUpdate(current, data);

      expect(result.marketProfile).toEqual([{ price: 10, volume: 200 }]);
    });

    it('delta with both added and updated levels', () => {
      const current = { ...baseCurrent, marketProfile: [{ price: 10, volume: 50 }] };
      const data = {
        feedSource: 'ctrader',
        delta: {
          added: [{ price: 5 }],
          updated: [{ price: 10, volume: 150 }]
        }
      };
      const result = mergeProfileUpdate(current, data);

      expect(result.marketProfile).toEqual([
        { price: 5 },
        { price: 10, volume: 150 }
      ]);
    });

    it('updated level replaces existing level at same price', () => {
      const current = { ...baseCurrent, marketProfile: [{ price: 7, label: 'old' }] };
      const data = { feedSource: 'ctrader', delta: { updated: [{ price: 7, label: 'new' }] } };
      const result = mergeProfileUpdate(current, data);

      expect(result.marketProfile).toEqual([{ price: 7, label: 'new' }]);
    });

    it('delta merges are sorted by price ascending', () => {
      const current = { ...baseCurrent };
      const data = {
        feedSource: 'ctrader',
        delta: { added: [{ price: 30 }, { price: 10 }, { price: 20 }] }
      };
      const result = mergeProfileUpdate(current, data);

      expect(result.marketProfile).toEqual([
        { price: 10 }, { price: 20 }, { price: 30 }
      ]);
    });

    it('empty delta (no added/updated) returns existing profile as-is', () => {
      const current = { ...baseCurrent, marketProfile: [{ price: 10 }] };
      const data = { feedSource: 'ctrader', delta: {} };
      const result = mergeProfileUpdate(current, data);

      expect(result).not.toBeNull();
      expect(result.marketProfile).toEqual([{ price: 10 }]);
    });
  });

  describe('profile-derived high/low', () => {
    it('profile high exceeds current high, high is updated', () => {
      const current = { ...baseCurrent, high: 100 };
      const data = { feedSource: 'ctrader', profile: { levels: [{ price: 100 }, { price: 200 }] } };
      const result = mergeProfileUpdate(current, data);

      expect(result.high).toBe(200);
    });

    it('profile low below current low, low is updated', () => {
      const current = { ...baseCurrent, low: 50 };
      const data = { feedSource: 'ctrader', profile: { levels: [{ price: 25 }, { price: 50 }] } };
      const result = mergeProfileUpdate(current, data);

      expect(result.low).toBe(25);
    });

    it('profile range within current high/low leaves high/low unchanged', () => {
      const current = { ...baseCurrent, high: 200, low: 10 };
      const data = { feedSource: 'ctrader', profile: { levels: [{ price: 50 }, { price: 150 }] } };
      const result = mergeProfileUpdate(current, data);

      expect(result.high).toBe(200);
      expect(result.low).toBe(10);
    });

    it('current high is null, profile high becomes seed', () => {
      const current = { ...baseCurrent, high: null };
      const data = { feedSource: 'ctrader', profile: { levels: [{ price: 75 }] } };
      const result = mergeProfileUpdate(current, data);

      expect(result.high).toBe(75);
    });

    it('sets _profileSource to data.feedSource', () => {
      const current = { ...baseCurrent };
      const data = { feedSource: 'tradingview', profile: { levels: [{ price: 1 }] } };
      const result = mergeProfileUpdate(current, data);

      expect(result._profileSource).toBe('tradingview');
    });
  });
});
