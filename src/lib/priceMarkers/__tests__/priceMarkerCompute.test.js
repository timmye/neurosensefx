import { describe, it, expect } from 'vitest';
import {
  computeCurrentPrice,
  computeOpenPrice,
  computeHighLow,
  computeUserMarkers,
  computeHoverPreview,
  computePreviousDayOHLC,
  computeTwapMarker
} from '../priceMarkerCompute.js';

const identityPriceScale = (p) => p * 100;

function makeConfig(overrides = {}) {
  return {
    colors: {
      priceUp: '#00ff00',
      priceDown: '#ff0000',
      currentPrice: '#4488ff',
      openPrice: '#ff8800',
      sessionPrices: '#aabb00',
      previousDay: '#414141',
      twapMarker: '#8844ff'
    },
    fonts: {
      currentPrice: '36px serif',
      priceLabels: '14px serif'
    },
    ...overrides
  };
}

function makeSymbolData(direction = 'neutral', pipPosition = 2) {
  return { direction, pipPosition, digits: 5 };
}

describe('computeCurrentPrice', () => {
  const config = makeConfig();

  it('returns null when price is null', () => {
    expect(computeCurrentPrice(null, {}, config, identityPriceScale)).toBeNull();
  });

  it('returns null when price is undefined', () => {
    expect(computeCurrentPrice(undefined, {}, config, identityPriceScale)).toBeNull();
  });

  it('returns currentPrice color for neutral direction', () => {
    const result = computeCurrentPrice(1.0850, makeSymbolData('neutral'), config, identityPriceScale);
    expect(result.color).toBe('#4488ff');
  });

  it('returns priceUp color for up direction', () => {
    const result = computeCurrentPrice(1.0850, makeSymbolData('up'), config, identityPriceScale);
    expect(result.color).toBe('#00ff00');
  });

  it('returns priceDown color for down direction', () => {
    const result = computeCurrentPrice(1.0850, makeSymbolData('down'), config, identityPriceScale);
    expect(result.color).toBe('#ff0000');
  });

  it('returns formatted price text and Y from priceScale', () => {
    const result = computeCurrentPrice(1.0850, makeSymbolData(), config, identityPriceScale);
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('y');
    expect(result.y).toBe(108.5);
  });
});

describe('computeOpenPrice', () => {
  const config = makeConfig();

  it('returns null when price is null', () => {
    expect(computeOpenPrice(null, {}, config, identityPriceScale)).toBeNull();
  });

  it('returns correct color from config', () => {
    const result = computeOpenPrice(1.0850, makeSymbolData(), config, identityPriceScale);
    expect(result.color).toBe('#ff8800');
  });

  it('returns formatted price text and Y', () => {
    const result = computeOpenPrice(1.0850, makeSymbolData(), config, identityPriceScale);
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('y');
    expect(result.y).toBe(108.5);
  });
});

describe('computeHighLow', () => {
  const config = makeConfig();

  it('returns null for high when todayHigh is null', () => {
    const result = computeHighLow(null, 1.0800, makeSymbolData(), config, identityPriceScale);
    expect(result.high).toBeNull();
    expect(result.low).not.toBeNull();
    expect(result.low.y).toBe(108);
  });

  it('returns null for low when todayLow is null', () => {
    const result = computeHighLow(1.0900, null, makeSymbolData(), config, identityPriceScale);
    expect(result.low).toBeNull();
    expect(result.high).not.toBeNull();
    expect(result.high.y).toBeCloseTo(109);
  });

  it('returns both high and low when present', () => {
    const result = computeHighLow(1.0900, 1.0800, makeSymbolData(), config, identityPriceScale);
    expect(result.high).not.toBeNull();
    expect(result.low).not.toBeNull();
    expect(result.high.y).toBeCloseTo(109);
    expect(result.low.y).toBeCloseTo(108);
    expect(result.high.color).toBe(config.colors.sessionPrices);
    expect(result.low.color).toBe(config.colors.sessionPrices);
  });

  it('returns both null when both are null', () => {
    const result = computeHighLow(null, null, makeSymbolData(), config, identityPriceScale);
    expect(result.high).toBeNull();
    expect(result.low).toBeNull();
  });
});

describe('computeUserMarkers', () => {
  const config = makeConfig();

  const markerType = { name: 'normal', color: '#f7fa37', size: 2, opacity: 1 };
  const markers = [
    { id: 'm1', price: 1.0850, type: markerType },
    { id: 'm2', price: 1.0900, type: markerType }
  ];

  it('returns empty array when no markers', () => {
    expect(computeUserMarkers([], null, makeSymbolData(), identityPriceScale)).toEqual([]);
    expect(computeUserMarkers(null, null, makeSymbolData(), identityPriceScale)).toEqual([]);
  });

  it('computes Y for each marker', () => {
    const result = computeUserMarkers(markers, null, makeSymbolData(), identityPriceScale);
    expect(result).toHaveLength(2);
    expect(result[0].y).toBe(108.5);
    expect(result[1].y).toBeCloseTo(109);
  });

  it('selected marker gets orange color and thicker line', () => {
    const result = computeUserMarkers(markers, { id: 'm1' }, makeSymbolData(), identityPriceScale);
    expect(result[0].isSelected).toBe(true);
    expect(result[0].color).toBe('#ff6b35');
    expect(result[0].lineWidth).toBe(3);
  });

  it('non-selected uses marker.type.color and marker.type.size', () => {
    const result = computeUserMarkers(markers, { id: 'm1' }, makeSymbolData(), identityPriceScale);
    expect(result[1].isSelected).toBe(false);
    expect(result[1].color).toBe('#f7fa37');
    expect(result[1].lineWidth).toBe(2);
  });

  it('includes alpha from marker type', () => {
    const result = computeUserMarkers(markers, null, makeSymbolData(), identityPriceScale);
    expect(result[0].alpha).toBe(1);
  });
});

describe('computeHoverPreview', () => {
  it('returns null when hoverPrice is null', () => {
    expect(computeHoverPreview(null, makeSymbolData(), identityPriceScale)).toBeNull();
  });

  it('returns null when hoverPrice is undefined', () => {
    expect(computeHoverPreview(undefined, makeSymbolData(), identityPriceScale)).toBeNull();
  });

  it('returns Y and formatted price', () => {
    const result = computeHoverPreview(1.0850, makeSymbolData(), identityPriceScale);
    expect(result.y).toBe(108.5);
    expect(result).toHaveProperty('formattedPrice');
  });
});

describe('computePreviousDayOHLC', () => {
  const config = makeConfig();

  it('returns null when prevOHLC is null', () => {
    expect(computePreviousDayOHLC(null, makeSymbolData(), config)).toBeNull();
  });

  it('returns array with only present values (skips null prices)', () => {
    const prevOHLC = { open: 1.0850, high: null, low: 1.0800, close: null };
    const result = computePreviousDayOHLC(prevOHLC, makeSymbolData(), config);
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('PO');
    expect(result[1].label).toBe('PL');
  });

  it('labels are PO, PH, PL, PC', () => {
    const prevOHLC = { open: 1.0850, high: 1.0900, low: 1.0800, close: 1.0870 };
    const result = computePreviousDayOHLC(prevOHLC, makeSymbolData(), config);
    expect(result).toHaveLength(4);
    expect(result.map(e => e.label)).toEqual(['PO', 'PH', 'PL', 'PC']);
  });

  it('each entry has correct color from config', () => {
    const prevOHLC = { open: 1.0850, high: 1.0900, low: 1.0800, close: 1.0870 };
    const result = computePreviousDayOHLC(prevOHLC, makeSymbolData(), config);
    result.forEach(entry => {
      expect(entry.color).toBe('#414141');
    });
  });

  it('falls back to #414141 when previousDay color is missing', () => {
    const configNoColor = makeConfig();
    delete configNoColor.colors.previousDay;
    const prevOHLC = { open: 1.0850, high: null, low: null, close: null };
    const result = computePreviousDayOHLC(prevOHLC, makeSymbolData(), configNoColor);
    expect(result[0].color).toBe('#414141');
  });
});

describe('computeTwapMarker', () => {
  const config = makeConfig();

  it('returns null for null', () => {
    expect(computeTwapMarker(null, makeSymbolData(), config, identityPriceScale)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(computeTwapMarker(undefined, makeSymbolData(), config, identityPriceScale)).toBeNull();
  });

  it('returns null for NaN', () => {
    expect(computeTwapMarker(NaN, makeSymbolData(), config, identityPriceScale)).toBeNull();
  });

  it('returns null for non-number', () => {
    expect(computeTwapMarker('1.0850', makeSymbolData(), config, identityPriceScale)).toBeNull();
  });

  it('returns result for valid number', () => {
    const result = computeTwapMarker(1.0850, makeSymbolData(), config, identityPriceScale);
    expect(result).not.toBeNull();
    expect(result.y).toBe(108.5);
    expect(result.color).toBe('#8844ff');
    expect(result).toHaveProperty('text');
  });

  it('returns result for 0 (0 is a valid price)', () => {
    const result = computeTwapMarker(0, makeSymbolData(), config, identityPriceScale);
    expect(result).not.toBeNull();
    expect(result.y).toBe(0);
  });
});
