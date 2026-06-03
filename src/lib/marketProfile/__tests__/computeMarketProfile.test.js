import { describe, it, expect } from 'vitest';
import { computeMarketProfile, computeMiniMarketProfile } from '../orchestrator.js';

function makeProfileLevel(price, tpo) {
  return { price, tpo };
}

function makeProfile(levels) {
  return levels.map(([price, tpo]) => makeProfileLevel(price, tpo));
}

function makeConfig(overrides = {}) {
  return { width: 300, height: 200, marketData: { current: 1.0850, adrHigh: 1.0900, adrLow: 1.0800 }, ...overrides };
}

describe('computeMarketProfile', () => {
  it('returns all required computed fields for a normal profile', () => {
    const profile = makeProfile([[1.0850, 5], [1.0855, 8], [1.0860, 3]]);
    const config = makeConfig();
    const result = computeMarketProfile(profile, config);

    expect(result).toHaveProperty('poc');
    expect(result).toHaveProperty('valueArea');
    expect(result).toHaveProperty('maxTpo');
    expect(result).toHaveProperty('dimensions');
    expect(result).toHaveProperty('priceScale');
    expect(result).toHaveProperty('tpoScale');
    expect(result).toHaveProperty('adaptiveScale');
    expect(result).toHaveProperty('width');
    expect(result).toHaveProperty('height');
  });

  it('computes POC as the level with the highest TPO', () => {
    const profile = makeProfile([[1.0850, 5], [1.0855, 8], [1.0860, 3]]);
    const result = computeMarketProfile(profile, makeConfig());

    expect(result.poc.price).toBe(1.0855);
    expect(result.poc.tpo).toBe(8);
  });

  it('computes maxTpo as the highest TPO value', () => {
    const profile = makeProfile([[1.0850, 5], [1.0855, 8], [1.0860, 3]]);
    const result = computeMarketProfile(profile, makeConfig());

    expect(result.maxTpo).toBe(8);
  });

  it('computes value area with high and low within profile range', () => {
    const profile = makeProfile([[1.0850, 5], [1.0855, 8], [1.0860, 3]]);
    const result = computeMarketProfile(profile, makeConfig());

    expect(result.valueArea).toHaveProperty('high');
    expect(result.valueArea).toHaveProperty('low');
    expect(result.valueArea.high).toBeLessThanOrEqual(1.0860);
    expect(result.valueArea.high).toBeGreaterThanOrEqual(1.0850);
    expect(result.valueArea.low).toBeLessThanOrEqual(1.0860);
    expect(result.valueArea.low).toBeGreaterThanOrEqual(1.0850);
  });

  it('computes tpoScale as a positive number', () => {
    const profile = makeProfile([[1.0850, 5], [1.0855, 8], [1.0860, 3]]);
    const result = computeMarketProfile(profile, makeConfig());

    expect(result.tpoScale).toBeGreaterThan(0);
  });

  it('returns priceScale as a function', () => {
    const profile = makeProfile([[1.0850, 5], [1.0855, 8], [1.0860, 3]]);
    const result = computeMarketProfile(profile, makeConfig());

    expect(typeof result.priceScale).toBe('function');
  });

  it('returns dimensions with marketProfileStartX and marketProfileWidth', () => {
    const profile = makeProfile([[1.0850, 5], [1.0855, 8], [1.0860, 3]]);
    const result = computeMarketProfile(profile, makeConfig());

    expect(result.dimensions).toHaveProperty('marketProfileStartX');
    expect(result.dimensions).toHaveProperty('marketProfileWidth');
    expect(result.dimensions.marketProfileStartX).toBeGreaterThan(0);
    expect(result.dimensions.marketProfileWidth).toBeGreaterThan(0);
  });

  it('uses fallback scale when marketData is minimal', () => {
    const profile = makeProfile([[1.0850, 5], [1.0855, 8], [1.0860, 3]]);
    const config = { width: 300, height: 200, marketData: {} };
    const result = computeMarketProfile(profile, config);

    expect(result.adaptiveScale).toBeDefined();
    expect(result.adaptiveScale.min).toBeDefined();
    expect(result.adaptiveScale.max).toBeDefined();
  });
});

describe('computeMiniMarketProfile', () => {
  it('returns priceScale as a function and correct maxTpo', () => {
    const profile = makeProfile([[1.0850, 5], [1.0855, 8], [1.0860, 3]]);
    const size = { width: 37.5, height: 60, highPrice: 1.0860, lowPrice: 1.0840 };
    const result = computeMiniMarketProfile(profile, size);

    expect(typeof result.priceScale).toBe('function');
    expect(result.maxTpo).toBe(8);
  });

  it('uses highPrice/lowPrice from size over profile range', () => {
    const profile = makeProfile([[1.0850, 5], [1.0855, 8], [1.0860, 3]]);
    const size = { width: 37.5, height: 60, highPrice: 1.0860, lowPrice: 1.0840 };
    const result = computeMiniMarketProfile(profile, size);

    expect(result.maxPrice).toBe(1.0860);
    expect(result.minPrice).toBe(1.0840);
  });

  it('falls back to profile range when highPrice/lowPrice are null', () => {
    const profile = makeProfile([[1.0850, 5], [1.0855, 8], [1.0860, 3]]);
    const size = { width: 37.5, height: 60, highPrice: null, lowPrice: null };
    const result = computeMiniMarketProfile(profile, size);

    expect(result.minPrice).toBe(1.0850);
    expect(result.maxPrice).toBe(1.0860);
  });

  it('maps maxPrice to a low Y value (near top) and minPrice to a high Y value (near bottom)', () => {
    const minPrice = 1.0840;
    const maxPrice = 1.0860;
    const height = 60;
    const size = { width: 37.5, height, highPrice: maxPrice, lowPrice: minPrice };
    const profile = makeProfile([[1.0850, 5], [1.0855, 8], [1.0860, 3]]);
    const result = computeMiniMarketProfile(profile, size);

    const yMaxPrice = result.priceScale(maxPrice);
    const yMinPrice = result.priceScale(minPrice);

    expect(yMaxPrice).toBeLessThan(yMinPrice);
    expect(yMaxPrice).toBeLessThanOrEqual(1);
    expect(yMinPrice).toBeGreaterThanOrEqual(height - 1);
  });

  it('handles empty profile without crashing', () => {
    const size = { width: 37.5, height: 60, highPrice: 1.0860, lowPrice: 1.0840 };
    const result = computeMiniMarketProfile([], size);

    expect(result).toBeDefined();
    expect(result.maxTpo).toBe(0);
    expect(typeof result.priceScale).toBe('function');
  });

  it('returns width and height from size', () => {
    const size = { width: 37.5, height: 60, highPrice: 1.0860, lowPrice: 1.0840 };
    const profile = makeProfile([[1.0850, 5], [1.0855, 8], [1.0860, 3]]);
    const result = computeMiniMarketProfile(profile, size);

    expect(result.width).toBe(37.5);
    expect(result.height).toBe(60);
  });
});
