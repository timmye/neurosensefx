import { describe, it, expect } from 'vitest';
import { calculateRange, mapValueToY, computeFxBasketLayout } from '../fxBasketOrchestrator.js';

function makeBasket(currency, normalized, changePercent = 0) {
  return { currency, normalized, changePercent, initialized: true };
}

function makeBaskets(currencies, state = 'ready') {
  const result = { _state: state };
  currencies.forEach(([c, n, ch]) => {
    result[c] = makeBasket(c, n, ch);
  });
  return result;
}

const DEFAULT_DIMENSIONS = { width: 300, height: 200 };

describe('calculateRange', () => {
  it('expands range symmetrically around 100 for typical values', () => {
    const { rangeMin, rangeMax } = calculateRange(99.5, 101.2);
    expect(rangeMin).toBeLessThan(99.5);
    expect(rangeMax).toBeGreaterThan(101.2);
    const center = (rangeMin + rangeMax) / 2;
    expect(center).toBeCloseTo(100, 10);
  });

  it('applies minimum expansion when values are near 100', () => {
    const { rangeMin, rangeMax } = calculateRange(99.99, 100.01);
    expect(rangeMin).toBeLessThan(99.99);
    expect(rangeMax).toBeGreaterThan(100.01);
    const rangeSize = rangeMax - rangeMin;
    expect(rangeSize).toBeGreaterThan(0);
    const center = (rangeMin + rangeMax) / 2;
    expect(center).toBeCloseTo(100, 10);
  });

  it('is symmetric when input is symmetric around 100', () => {
    const { rangeMin, rangeMax } = calculateRange(99.5, 100.5);
    const expansionUp = rangeMax - 100;
    const expansionDown = 100 - rangeMin;
    expect(expansionUp).toBeCloseTo(expansionDown, 10);
  });
});

describe('mapValueToY', () => {
  const renderHeight = 200;
  const min = 99;
  const max = 101;
  const padding = 10;

  it('maps center value to vertical center', () => {
    const y = mapValueToY(100, renderHeight, min, max, padding);
    expect(y).toBeCloseTo(padding + renderHeight / 2);
  });

  it('maps max value to top (padding)', () => {
    const y = mapValueToY(max, renderHeight, min, max, padding);
    expect(y).toBeCloseTo(padding);
  });

  it('maps min value to bottom (padding + renderHeight)', () => {
    const y = mapValueToY(min, renderHeight, min, max, padding);
    expect(y).toBeCloseTo(padding + renderHeight);
  });

  it('values above center map above baseline', () => {
    const y101 = mapValueToY(101, renderHeight, min, max, padding);
    const y100 = mapValueToY(100, renderHeight, min, max, padding);
    expect(y101).toBeLessThan(y100);
  });

  it('values below center map below baseline', () => {
    const y99 = mapValueToY(99, renderHeight, min, max, padding);
    const y100 = mapValueToY(100, renderHeight, min, max, padding);
    expect(y99).toBeGreaterThan(y100);
  });
});

describe('computeFxBasketLayout', () => {
  it('computes positions for 3 baskets', () => {
    const baskets = makeBaskets([
      ['EUR', 101.5],
      ['GBP', 98.7],
      ['JPY', 100.3]
    ]);
    const layout = computeFxBasketLayout(baskets, DEFAULT_DIMENSIONS);

    expect(layout.basketPositions).toHaveLength(3);
    expect(layout.basketValues).toHaveLength(3);

    layout.basketPositions.forEach(bp => {
      expect(bp).toHaveProperty('y');
      expect(bp).toHaveProperty('basket');
      expect(typeof bp.y).toBe('number');
    });
  });

  it('range encompasses all basket values', () => {
    const baskets = makeBaskets([
      ['EUR', 101.5],
      ['GBP', 98.7],
      ['JPY', 100.3]
    ]);
    const layout = computeFxBasketLayout(baskets, DEFAULT_DIMENSIONS);

    expect(layout.rangeMin).toBeLessThan(98.7);
    expect(layout.rangeMax).toBeGreaterThan(101.5);
  });

  it('returns safe defaults for empty baskets', () => {
    const layout = computeFxBasketLayout({}, DEFAULT_DIMENSIONS);

    expect(layout.basketValues).toEqual([]);
    expect(layout.rangeMin).toBe(99.98);
    expect(layout.rangeMax).toBe(100.02);
    expect(layout.baselineY).toBe(DEFAULT_DIMENSIONS.height / 2);
  });

  it('places baseline at vertical center of render area', () => {
    const baskets = makeBaskets([['EUR', 100]]);
    const layout = computeFxBasketLayout(baskets, DEFAULT_DIMENSIONS);

    const verticalPadding = 20;
    const expectedRenderHeight = DEFAULT_DIMENSIONS.height - verticalPadding * 2;
    const expectedBaseline = verticalPadding + expectedRenderHeight / 2;
    expect(layout.baselineY).toBeCloseTo(expectedBaseline);
  });

  it('returns correct dimensions in output', () => {
    const baskets = makeBaskets([['EUR', 100]]);
    const layout = computeFxBasketLayout(baskets, DEFAULT_DIMENSIONS);

    expect(layout.dimensions).toEqual(DEFAULT_DIMENSIONS);
    expect(layout.width).toBe(DEFAULT_DIMENSIONS.width);
    expect(layout.height).toBe(DEFAULT_DIMENSIONS.height);
  });

  it('basket positions span a non-trivial Y range (canvas coords)', () => {
    const baskets = makeBaskets([
      ['EUR', 101.5],
      ['GBP', 98.7],
      ['JPY', 100.3]
    ]);
    const layout = computeFxBasketLayout(baskets, DEFAULT_DIMENSIONS);
    const ys = layout.basketPositions.map(bp => bp.y);

    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    expect(maxY - minY).toBeGreaterThan(10);
  });

  it('range is symmetric around 100 for symmetric input', () => {
    const baskets = makeBaskets([
      ['EUR', 99.5],
      ['GBP', 100.5]
    ]);
    const layout = computeFxBasketLayout(baskets, DEFAULT_DIMENSIONS);

    const expansionUp = layout.rangeMax - 100;
    const expansionDown = 100 - layout.rangeMin;
    expect(expansionUp).toBeCloseTo(expansionDown, 10);
  });
});
