/**
 * computeDayRange Tests
 *
 * Tests for the pure computation step extracted from the Day Range orchestrator.
 *   computeDayRange(d, s, getConfig) — no canvas dependency, deterministic output.
 *
 * Run: npm run test:unit -- src/lib/__tests__/dayRangeCompute.test.js
 */

import { describe, it, expect } from 'vitest';
import { computeDayRange } from '../dayRangeOrchestrator.js';

// ── Helpers ──

function makeDayRangeData(overrides = {}) {
  return {
    current: 1.0853, high: 1.0870, low: 1.0815,
    adrHigh: 1.0880, adrLow: 1.0801, open: 1.0835,
    pipSize: 0.0001,
    ...overrides
  };
}

function makeSize(overrides = {}) {
  return { width: 300, height: 200, config: { features: {} }, ...overrides };
}

function makeGetConfig() {
  return (opts = {}) => ({
    positioning: { adrAxisX: 100, padding: 0 },
    features: { boundaryLines: true, percentageMarkers: { static: false, dynamic: false } },
    scaling: { maxExpansion: 2 },
    ...opts
  });
}

// ── Normal ADR data ──

describe('computeDayRange with normal ADR data', () => {
  const d = makeDayRangeData();
  const s = makeSize();
  const getConfig = makeGetConfig();

  it('returns an object with all expected computed fields', () => {
    const result = computeDayRange(d, s, getConfig);

    expect(result).toHaveProperty('config');
    expect(result).toHaveProperty('adaptiveScale');
    expect(result).toHaveProperty('priceScale');
    expect(result).toHaveProperty('mappedData');
    expect(result).toHaveProperty('dayRangePercentage');
    expect(result).toHaveProperty('midPrice');
    expect(result).toHaveProperty('adrValue');
    expect(result).toHaveProperty('width', 300);
    expect(result).toHaveProperty('height', 200);
  });

  it('returns config as an object', () => {
    const result = computeDayRange(d, s, getConfig);
    expect(result.config).toBeInstanceOf(Object);
  });

  it('returns adaptiveScale with min, max, range properties', () => {
    const result = computeDayRange(d, s, getConfig);
    expect(result.adaptiveScale).toHaveProperty('min');
    expect(result.adaptiveScale).toHaveProperty('max');
    expect(result.adaptiveScale).toHaveProperty('range');
  });

  it('returns adaptiveScale with max > min', () => {
    const result = computeDayRange(d, s, getConfig);
    expect(result.adaptiveScale.max).toBeGreaterThan(result.adaptiveScale.min);
  });

  it('returns priceScale as a function', () => {
    const result = computeDayRange(d, s, getConfig);
    expect(typeof result.priceScale).toBe('function');
  });

  it('priceScale maps a price to a pixel value within height bounds', () => {
    const result = computeDayRange(d, s, getConfig);
    const pixel = result.priceScale(1.0835);
    expect(pixel).toBeGreaterThanOrEqual(0);
    expect(pixel).toBeLessThanOrEqual(200);
  });

  it('priceScale maps open price to near center for normal data', () => {
    const result = computeDayRange(d, s, getConfig);
    const pixel = result.priceScale(d.open);
    // With 50% ADR expansion (default), open is at center → ~100px
    expect(pixel).toBeGreaterThanOrEqual(80);
    expect(pixel).toBeLessThanOrEqual(120);
  });

  it('priceScale higher price yields lower pixel (inverted Y axis)', () => {
    const result = computeDayRange(d, s, getConfig);
    const pixelHigh = result.priceScale(d.high);
    const pixelLow = result.priceScale(d.low);
    expect(pixelHigh).toBeLessThan(pixelLow);
  });
});

// ── ADR expansion ──

describe('computeDayRange with ADR expansion', () => {
  it('expands scale when prices exceed ADR bounds', () => {
    const d = makeDayRangeData({ high: 1.0920, low: 1.0780 });
    const s = makeSize();
    const getConfig = makeGetConfig();
    const result = computeDayRange(d, s, getConfig);

    expect(result.adaptiveScale.isProgressive).toBe(true);
    expect(result.adaptiveScale.upperExpansion).toBeGreaterThan(0.5);
  });

  it('symmetric expansion: upperExpansion equals lowerExpansion', () => {
    const d = makeDayRangeData({ high: 1.0920, low: 1.0780 });
    const s = makeSize();
    const getConfig = makeGetConfig();
    const result = computeDayRange(d, s, getConfig);

    expect(result.adaptiveScale.upperExpansion).toBe(result.adaptiveScale.lowerExpansion);
  });
});

// ── Day range percentage ──

describe('computeDayRange dayRangePercentage', () => {
  it('calculates correct percentage string for known values', () => {
    // dayRange = 1.0870 - 1.0815 = 0.0055
    // adr = 1.0880 - 1.0801 = 0.0079
    // pct = 0.0055 / 0.0079 * 100 = 69.6202... → "69.6"
    const d = makeDayRangeData({ high: 1.0870, low: 1.0815, adrHigh: 1.0880, adrLow: 1.0801 });
    const s = makeSize();
    const getConfig = makeGetConfig();
    const result = computeDayRange(d, s, getConfig);

    expect(result.dayRangePercentage).toBe('69.6');
  });

  it('returns null when high/low/adrHigh/adrLow are missing', () => {
    const d = makeDayRangeData({ high: undefined, low: undefined, adrHigh: undefined, adrLow: undefined });
    const s = makeSize();
    const getConfig = makeGetConfig();
    const result = computeDayRange(d, s, getConfig);

    expect(result.dayRangePercentage).toBeNull();
  });
});

// ── Missing data ──

describe('computeDayRange with missing data', () => {
  it('does not crash when current is null', () => {
    const d = makeDayRangeData({ current: null });
    const s = makeSize();
    const getConfig = makeGetConfig();

    expect(() => computeDayRange(d, s, getConfig)).not.toThrow();
  });

  it('returns valid result when current is null (config and adaptiveScale use fallback)', () => {
    const d = makeDayRangeData({ current: null });
    const s = makeSize();
    const getConfig = makeGetConfig();
    const result = computeDayRange(d, s, getConfig);

    expect(result).toBeDefined();
    expect(result.config).toBeDefined();
    expect(result.adaptiveScale).toBeDefined();
    expect(result.adaptiveScale.range).toBeGreaterThan(0);
  });
});

// ── Zero ADR range ──

describe('computeDayRange with zero ADR range', () => {
  it('does not divide by zero when adrHigh equals adrLow', () => {
    const d = makeDayRangeData({ adrHigh: 1.0850, adrLow: 1.0850 });
    const s = makeSize();
    const getConfig = makeGetConfig();

    expect(() => computeDayRange(d, s, getConfig)).not.toThrow();
  });

  it('priceScale does not crash when called with zero ADR data', () => {
    const d = makeDayRangeData({ adrHigh: 1.0850, adrLow: 1.0850 });
    const s = makeSize();
    const getConfig = makeGetConfig();
    const result = computeDayRange(d, s, getConfig);

    expect(() => result.priceScale(1.0850)).not.toThrow();
  });
});

// ── mappedData ──

describe('computeDayRange mappedData', () => {
  it('contains todayHigh and todayLow matching input', () => {
    const d = makeDayRangeData({ high: 1.0900, low: 1.0800 });
    const s = makeSize();
    const getConfig = makeGetConfig();
    const result = computeDayRange(d, s, getConfig);

    expect(result.mappedData.todayHigh).toBe(1.0900);
    expect(result.mappedData.todayLow).toBe(1.0800);
  });

  it('contains current matching input', () => {
    const d = makeDayRangeData({ current: 1.0845 });
    const s = makeSize();
    const getConfig = makeGetConfig();
    const result = computeDayRange(d, s, getConfig);

    expect(result.mappedData.current).toBe(1.0845);
  });

  it('contains adrHigh and adrLow matching input', () => {
    const d = makeDayRangeData({ adrHigh: 1.0900, adrLow: 1.0750 });
    const s = makeSize();
    const getConfig = makeGetConfig();
    const result = computeDayRange(d, s, getConfig);

    expect(result.mappedData.adrHigh).toBe(1.0900);
    expect(result.mappedData.adrLow).toBe(1.0750);
  });
});

// ── midPrice and adrValue ──

describe('computeDayRange midPrice and adrValue', () => {
  it('prefers open over current for midPrice', () => {
    const d = makeDayRangeData({ open: 1.0835, current: 1.0853 });
    const s = makeSize();
    const getConfig = makeGetConfig();
    const result = computeDayRange(d, s, getConfig);

    expect(result.midPrice).toBe(1.0835);
  });

  it('falls back to current when open is missing', () => {
    const d = makeDayRangeData({ open: undefined, current: 1.0853 });
    const s = makeSize();
    const getConfig = makeGetConfig();
    const result = computeDayRange(d, s, getConfig);

    expect(result.midPrice).toBe(1.0853);
  });

  it('calculates adrValue as adrHigh minus adrLow', () => {
    const d = makeDayRangeData({ adrHigh: 1.0880, adrLow: 1.0801 });
    const s = makeSize();
    const getConfig = makeGetConfig();
    const result = computeDayRange(d, s, getConfig);

    expect(result.adrValue).toBeCloseTo(0.0079, 10);
  });
});
