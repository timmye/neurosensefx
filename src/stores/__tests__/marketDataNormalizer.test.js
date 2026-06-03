import { describe, it, expect } from 'vitest';
import { normalizeSymbolDataPackage, normalizeTick } from '../marketDataNormalizer.js';

const baseCurrentState = {
  pipPosition: 4,
  pipSize: 0.0001,
  pipetteSize: 0.00001,
  digits: 5,
  source: 'ctrader',
  marketProfile: [],
  current: 1.10000,
  previousPrice: 1.09990,
  high: 1.10100,
  low: 1.09900,
};

describe('normalizeSymbolDataPackage', () => {
  describe('current price fallback chain', () => {
    it('uses data.current when present', () => {
      const data = { current: 1.20000 };
      const result = normalizeSymbolDataPackage(data, baseCurrentState);
      expect(result.current).toBe(1.20000);
    });

    it('falls through to data.price when current is absent', () => {
      const data = { price: 1.21000 };
      const result = normalizeSymbolDataPackage(data, baseCurrentState);
      expect(result.current).toBe(1.21000);
    });

    it('falls through to data.initialPrice when current and price are absent', () => {
      const data = { initialPrice: 1.21500 };
      const result = normalizeSymbolDataPackage(data, baseCurrentState);
      expect(result.current).toBe(1.21500);
    });

    it('falls through to midPrice when current/price/initialPrice are absent', () => {
      const data = { bid: 1.22000, ask: 1.22002 };
      const result = normalizeSymbolDataPackage(data, baseCurrentState);
      expect(result.current).toBeCloseTo(1.22001);
    });

    it('falls through to data.bid when no earlier value available', () => {
      const data = { bid: 1.23000 };
      const result = normalizeSymbolDataPackage(data, baseCurrentState);
      expect(result.current).toBe(1.23000);
    });

    it('falls through to data.ask when only ask is present', () => {
      const data = { ask: 1.24000 };
      const result = normalizeSymbolDataPackage(data, baseCurrentState);
      expect(result.current).toBe(1.24000);
    });

    it('returns null when no price data is available', () => {
      const data = {};
      const result = normalizeSymbolDataPackage(data, baseCurrentState);
      expect(result.current).toBeNull();
    });
  });

  describe('mid-price calculation', () => {
    it('calculates midPrice when bid and ask differ', () => {
      const data = { bid: 1.10000, ask: 1.10002 };
      const result = normalizeSymbolDataPackage(data, baseCurrentState);
      expect(result.current).toBeCloseTo(1.10001);
    });

    it('returns null midPrice when bid equals ask', () => {
      const data = { bid: 1.10000, ask: 1.10000 };
      const result = normalizeSymbolDataPackage(data, baseCurrentState);
      // Falls through to bid since midPrice is null
      expect(result.current).toBe(1.10000);
    });

    it('returns null midPrice when bid is missing', () => {
      const data = { ask: 1.10002 };
      const result = normalizeSymbolDataPackage(data, baseCurrentState);
      expect(result.current).toBe(1.10002);
    });
  });

  describe('prevDayOHLC assembly', () => {
    it('creates prevDayOHLC when all four fields are present', () => {
      const data = {
        prevDayOpen: 1.09000,
        prevDayHigh: 1.09500,
        prevDayLow: 1.08500,
        prevDayClose: 1.09200
      };
      const result = normalizeSymbolDataPackage(data, baseCurrentState);
      expect(result.prevDayOHLC).toEqual({
        open: 1.09000,
        high: 1.09500,
        low: 1.08500,
        close: 1.09200
      });
    });

    it('returns null prevDayOHLC when any field is missing', () => {
      const data = {
        prevDayOpen: 1.09000,
        prevDayHigh: 1.09500,
        prevDayLow: 1.08500
        // prevDayClose missing
      };
      const result = normalizeSymbolDataPackage(data, baseCurrentState);
      expect(result.prevDayOHLC).toBeNull();
    });

    it('returns null prevDayOHLC when a field is null', () => {
      const data = {
        prevDayOpen: 1.09000,
        prevDayHigh: null,
        prevDayLow: 1.08500,
        prevDayClose: 1.09200
      };
      const result = normalizeSymbolDataPackage(data, baseCurrentState);
      expect(result.prevDayOHLC).toBeNull();
    });
  });

  describe('legacy field fallbacks', () => {
    it('uses todaysHigh when high is absent', () => {
      const data = { todaysHigh: 1.10500 };
      const result = normalizeSymbolDataPackage(data, baseCurrentState);
      expect(result.high).toBe(1.10500);
    });

    it('uses todaysLow when low is absent', () => {
      const data = { todaysLow: 1.09500 };
      const result = normalizeSymbolDataPackage(data, baseCurrentState);
      expect(result.low).toBe(1.09500);
    });

    it('uses todaysOpen when open is absent', () => {
      const data = { todaysOpen: 1.09800 };
      const result = normalizeSymbolDataPackage(data, baseCurrentState);
      expect(result.open).toBe(1.09800);
    });

    it('prefers high over todaysHigh when both present', () => {
      const data = { high: 1.20000, todaysHigh: 1.10500 };
      const result = normalizeSymbolDataPackage(data, baseCurrentState);
      expect(result.high).toBe(1.20000);
    });
  });

  describe('ADR field fallbacks', () => {
    it('prefers adrHigh over projectedAdrHigh', () => {
      const data = { adrHigh: 1.11000, projectedAdrHigh: 1.11500 };
      const result = normalizeSymbolDataPackage(data, baseCurrentState);
      expect(result.adrHigh).toBe(1.11000);
    });

    it('falls through to projectedAdrHigh when adrHigh absent', () => {
      const data = { projectedAdrHigh: 1.11500 };
      const result = normalizeSymbolDataPackage(data, baseCurrentState);
      expect(result.adrHigh).toBe(1.11500);
    });

    it('falls through to projectedAdrLow when adrLow absent', () => {
      const data = { projectedAdrLow: 1.08500 };
      const result = normalizeSymbolDataPackage(data, baseCurrentState);
      expect(result.adrLow).toBe(1.08500);
    });
  });

  describe('currentState fallbacks', () => {
    it('uses currentState.pipPosition when data lacks it', () => {
      const data = {};
      const result = normalizeSymbolDataPackage(data, baseCurrentState);
      expect(result.pipPosition).toBe(4);
    });

    it('overrides currentState.pipPosition when data provides it', () => {
      const data = { pipPosition: 2 };
      const result = normalizeSymbolDataPackage(data, baseCurrentState);
      expect(result.pipPosition).toBe(2);
    });

    it('preserves currentState.marketProfile', () => {
      const currentState = { ...baseCurrentState, marketProfile: [{ price: 1.1 }] };
      const result = normalizeSymbolDataPackage({}, currentState);
      expect(result.marketProfile).toEqual([{ price: 1.1 }]);
    });
  });

  describe('previousPrice calculation', () => {
    it('falls back to currentState.current when no data price available', () => {
      const data = {};
      const result = normalizeSymbolDataPackage(data, baseCurrentState);
      expect(result.previousPrice).toBe(1.10000);
    });

    it('uses data.current for previousPrice when present', () => {
      const data = { current: 1.20000 };
      const result = normalizeSymbolDataPackage(data, baseCurrentState);
      expect(result.previousPrice).toBe(1.20000);
    });
  });

  describe('empty data', () => {
    it('returns mostly nulls with currentState preserved values', () => {
      const result = normalizeSymbolDataPackage({}, baseCurrentState);
      expect(result.current).toBeNull();
      expect(result.high).toBeNull();
      expect(result.low).toBeNull();
      expect(result.open).toBeNull();
      expect(result.direction).toBe('neutral');
      expect(result.pipPosition).toBe(4);
      expect(result.digits).toBe(5);
      expect(result.source).toBe('ctrader');
      expect(result.receivedAt).toBeNull();
      expect(result.sentAt).toBeNull();
    });
  });

  describe('receivedAt / sentAt', () => {
    it('passes through receivedAt and sentAt from data', () => {
      const data = { receivedAt: 1000, sentAt: 900 };
      const result = normalizeSymbolDataPackage(data, baseCurrentState);
      expect(result.receivedAt).toBe(1000);
      expect(result.sentAt).toBe(900);
    });
  });
});

describe('normalizeTick', () => {
  describe('direction inference', () => {
    it('direction is up when newPrice > prevPrice', () => {
      const data = { price: 1.10100 };
      const currentState = { ...baseCurrentState, current: 1.10000, previousPrice: 1.10000 };
      const result = normalizeTick(data, currentState);
      expect(result.direction).toBe('up');
    });

    it('direction is down when newPrice < prevPrice', () => {
      const data = { price: 1.09900 };
      const currentState = { ...baseCurrentState, current: 1.10000, previousPrice: 1.10000 };
      const result = normalizeTick(data, currentState);
      expect(result.direction).toBe('down');
    });

    it('direction is neutral when newPrice equals prevPrice', () => {
      const data = { price: 1.10000 };
      const currentState = { ...baseCurrentState, current: 1.10000, previousPrice: 1.10000 };
      const result = normalizeTick(data, currentState);
      expect(result.direction).toBe('neutral');
    });
  });

  describe('running high', () => {
    it('updates high when newPrice exceeds current high', () => {
      const data = { price: 1.10500 };
      const currentState = { ...baseCurrentState, high: 1.10100 };
      const result = normalizeTick(data, currentState);
      expect(result.high).toBe(1.10500);
    });

    it('preserves high when newPrice is lower', () => {
      const data = { price: 1.09900 };
      const currentState = { ...baseCurrentState, high: 1.10100 };
      const result = normalizeTick(data, currentState);
      expect(result.high).toBe(1.10100);
    });
  });

  describe('running low', () => {
    it('updates low when newPrice is below current low', () => {
      const data = { price: 1.09800 };
      const currentState = { ...baseCurrentState, low: 1.09900 };
      const result = normalizeTick(data, currentState);
      expect(result.low).toBe(1.09800);
    });

    it('preserves low when newPrice is higher', () => {
      const data = { price: 1.10000 };
      const currentState = { ...baseCurrentState, low: 1.09900 };
      const result = normalizeTick(data, currentState);
      expect(result.low).toBe(1.09900);
    });
  });

  describe('null safety for high/low', () => {
    it('uses newPrice as seed when currentState.high is null', () => {
      const data = { price: 1.10000 };
      const currentState = { ...baseCurrentState, high: null };
      const result = normalizeTick(data, currentState);
      expect(result.high).toBe(1.10000);
    });

    it('uses newPrice as seed when currentState.low is null', () => {
      const data = { price: 1.10000 };
      const currentState = { ...baseCurrentState, low: null };
      const result = normalizeTick(data, currentState);
      expect(result.low).toBe(1.10000);
    });
  });

  describe('previousPrice', () => {
    it('uses currentState.current as previousPrice', () => {
      const data = { price: 1.10100 };
      const currentState = { ...baseCurrentState, current: 1.10000, previousPrice: 1.09990 };
      const result = normalizeTick(data, currentState);
      expect(result.previousPrice).toBe(1.10000);
    });

    it('falls back to currentState.previousPrice when currentState.current is null', () => {
      const data = { price: 1.10100 };
      const currentState = { ...baseCurrentState, current: null, previousPrice: 1.09990 };
      const result = normalizeTick(data, currentState);
      expect(result.previousPrice).toBe(1.09990);
    });
  });

  describe('price fallback chain', () => {
    it('falls through to midPrice when data.price absent', () => {
      const data = { bid: 1.10000, ask: 1.10004 };
      const result = normalizeTick(data, baseCurrentState);
      expect(result.current).toBeCloseTo(1.10002);
    });

    it('falls through to data.bid when price and midPrice absent', () => {
      const data = { bid: 1.10500 };
      const result = normalizeTick(data, baseCurrentState);
      expect(result.current).toBe(1.10500);
    });

    it('falls through to data.ask when only ask present', () => {
      const data = { ask: 1.10600 };
      const result = normalizeTick(data, baseCurrentState);
      expect(result.current).toBe(1.10600);
    });

    it('falls through to currentState.current when no price data in tick', () => {
      const data = {};
      const result = normalizeTick(data, baseCurrentState);
      expect(result.current).toBe(1.10000);
    });
  });

  describe('inherits from currentState', () => {
    it('inherits pipPosition from currentState when not in data', () => {
      const data = { price: 1.10000 };
      const result = normalizeTick(data, baseCurrentState);
      expect(result.pipPosition).toBe(4);
    });

    it('inherits digits from currentState when not in data', () => {
      const data = { price: 1.10000 };
      const result = normalizeTick(data, baseCurrentState);
      expect(result.digits).toBe(5);
    });

    it('inherits source from currentState when not in data', () => {
      const data = { price: 1.10000 };
      const result = normalizeTick(data, baseCurrentState);
      expect(result.source).toBe('ctrader');
    });

    it('overrides source when data provides it', () => {
      const data = { price: 1.10000, source: 'tradingview' };
      const result = normalizeTick(data, baseCurrentState);
      expect(result.source).toBe('tradingview');
    });
  });
});
