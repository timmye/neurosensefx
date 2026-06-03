/**
 * Unit tests for cache freshness checks and bar cache configuration.
 *
 * barCache.js requires Dexie/IndexedDB (browser-only runtime) and cannot
 * be tested in vitest's node environment without heavy mocking. This file
 * tests cacheFreshness.js (pure logic) and verifies CACHE_MAX_BARS config.
 *
 * Run: npm run test:unit -- src/lib/chart/__tests__/cacheFreshness.test.js
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkCacheFreshness } from '../cacheFreshness.js';
import { CACHE_MAX_BARS } from '../chartConfig.js';

// ── checkCacheFreshness ──

describe('checkCacheFreshness', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-03T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns fresh=false with maxAgeMs=0 for empty bars', () => {
    const result = checkCacheFreshness([], '1m');
    expect(result.fresh).toBe(false);
    expect(result.maxAgeMs).toBe(0); // early return when empty
  });

  it('fresh bar within 2 bar-periods is fresh', () => {
    const now = Date.now();
    const bars = [{ timestamp: 1000, updatedAt: now - 60_000 }]; // 1m ago, within 2m
    const result = checkCacheFreshness(bars, '1m');
    expect(result.fresh).toBe(true);
    expect(result.maxAgeMs).toBe(120_000);
  });

  it('stale bar older than 2 bar-periods is not fresh', () => {
    const now = Date.now();
    const bars = [{ timestamp: 1000, updatedAt: now - 180_000 }]; // 3m ago, exceeds 2m threshold
    const result = checkCacheFreshness(bars, '1m');
    expect(result.fresh).toBe(false);
  });

  it('uses newest bar (last element) for freshness check', () => {
    const now = Date.now();
    const bars = [
      { timestamp: 500, updatedAt: now - 500_000 }, // very stale
      { timestamp: 1000, updatedAt: now - 30_000 }, // fresh
    ];
    const result = checkCacheFreshness(bars, '1m');
    expect(result.fresh).toBe(true); // newest bar is fresh
  });

  it('4h resolution: maxAgeMs is 8 hours (2 * 4h)', () => {
    const bars = [{ timestamp: 1000, updatedAt: Date.now() }];
    const result = checkCacheFreshness(bars, '4h');
    expect(result.maxAgeMs).toBe(28_800_000); // 2 * 14400000
  });

  it('Daily resolution: maxAgeMs is 2 days (2 * 86400000)', () => {
    const bars = [{ timestamp: 1000, updatedAt: Date.now() }];
    const result = checkCacheFreshness(bars, 'D');
    expect(result.maxAgeMs).toBe(172_800_000);
  });

  it('unknown resolution falls back to 1 hour maxAgeMs', () => {
    const bars = [{ timestamp: 1000, updatedAt: Date.now() }];
    const result = checkCacheFreshness(bars, 'UNKNOWN');
    expect(result.fresh).toBe(true); // updatedAt = now
    expect(result.maxAgeMs).toBe(3_600_000);
  });

  it('bar without updatedAt field is treated as fresh', () => {
    const bars = [{ timestamp: 1000 }]; // no updatedAt
    const result = checkCacheFreshness(bars, '1m');
    expect(result.fresh).toBe(true);
  });

  it('exact boundary: bar updatedAt exactly 2 bar-periods ago is stale', () => {
    const now = Date.now();
    const bars = [{ timestamp: 1000, updatedAt: now - 120_000 }]; // exactly 2m
    const result = checkCacheFreshness(bars, '1m');
    // (Date.now() - updatedAt) > maxAgeMs → 120000 > 120000 is false → fresh
    expect(result.fresh).toBe(true);
  });

  it('exact boundary + 1ms is stale', () => {
    const now = Date.now();
    const bars = [{ timestamp: 1000, updatedAt: now - 120_001 }]; // 2m + 1ms
    const result = checkCacheFreshness(bars, '1m');
    expect(result.fresh).toBe(false);
  });
});

// ── CACHE_MAX_BARS configuration ──

describe('CACHE_MAX_BARS configuration', () => {
  it('intraday resolutions have 260k cap', () => {
    expect(CACHE_MAX_BARS['1m']).toBe(260_000);
    expect(CACHE_MAX_BARS['5m']).toBe(260_000);
    expect(CACHE_MAX_BARS['15m']).toBe(260_000);
    expect(CACHE_MAX_BARS['30m']).toBe(260_000);
  });

  it('hourly resolutions have 50k cap', () => {
    expect(CACHE_MAX_BARS['1h']).toBe(50_000);
    expect(CACHE_MAX_BARS['4h']).toBe(50_000);
  });

  it('daily+ resolutions have 10k cap', () => {
    expect(CACHE_MAX_BARS['D']).toBe(10_000);
    expect(CACHE_MAX_BARS['W']).toBe(10_000);
    expect(CACHE_MAX_BARS['M']).toBe(10_000);
  });

  it('all standard resolutions have a defined cap', () => {
    const resolutions = ['1m', '5m', '10m', '15m', '30m', '1h', '4h', 'D', 'W', 'M'];
    for (const res of resolutions) {
      expect(CACHE_MAX_BARS[res]).toBeDefined();
      expect(typeof CACHE_MAX_BARS[res]).toBe('number');
      expect(CACHE_MAX_BARS[res]).toBeGreaterThan(0);
    }
  });
});
