/**
 * Unit tests for barMerge.js — OHLC bar merge and dedup logic.
 *
 * Tests mergeTickBar (single-bar append/update) and mergeHistoryBars
 * (batch merge with Map-based dedup). Pure functions, no mocks needed.
 *
 * Run: npm run test:unit -- src/lib/chart/__tests__/barMerge.test.js
 */

import { describe, it, expect } from 'vitest';
import { mergeTickBar, mergeHistoryBars } from '../barMerge.js';

// ── Helpers ──

function makeBar(ts, o, h, l, c, vol = 0) {
  return { timestamp: ts, open: o, high: h, low: l, close: c, volume: vol };
}

// ── mergeTickBar ──

describe('mergeTickBar', () => {
  describe('append — new timestamp', () => {
    it('appends a bar to an empty array', () => {
      const bar = makeBar(1000, 1.0, 1.1, 0.9, 1.05);
      const result = mergeTickBar([], bar, false);
      expect(result).toEqual([bar]);
    });

    it('appends a bar with a later timestamp (ascending order)', () => {
      const existing = [makeBar(1000, 1.0, 1.1, 0.9, 1.05)];
      const newBar = makeBar(2000, 1.05, 1.15, 1.0, 1.1);
      const result = mergeTickBar(existing, newBar, false);
      expect(result).toEqual([existing[0], newBar]);
    });

    it('isBarClose=true forces append of out-of-order bar and sorts', () => {
      const existing = [makeBar(2000, 1.05, 1.15, 1.0, 1.1)];
      const lateBar = makeBar(1000, 1.0, 1.1, 0.9, 1.05);
      const result = mergeTickBar(existing, lateBar, true);
      expect(result).toEqual([lateBar, existing[0]]);
    });

    it('does not append out-of-order bar when isBarClose=false and timestamp < last', () => {
      const existing = [
        makeBar(1000, 1.0, 1.1, 0.9, 1.05),
        makeBar(3000, 1.1, 1.2, 1.0, 1.15),
      ];
      const newBar = makeBar(2000, 1.05, 1.15, 1.0, 1.1);
      const result = mergeTickBar(existing, newBar, false);
      // 2000 < 3000 (last), and isBarClose=false → returns original array
      expect(result).toBe(existing);
      expect(result).toHaveLength(2);
    });
  });

  describe('update — existing timestamp', () => {
    it('replaces bar when timestamp matches last element (fast path)', () => {
      const existing = [makeBar(1000, 1.0, 1.1, 0.9, 1.05)];
      const updated = makeBar(1000, 1.0, 1.12, 0.88, 1.07);
      const result = mergeTickBar(existing, updated, false);
      expect(result).toEqual([updated]);
      // Original array is not mutated
      expect(existing[0].high).toBe(1.1);
    });

    it('replaces bar when timestamp matches non-last element (linear scan)', () => {
      const existing = [
        makeBar(1000, 1.0, 1.1, 0.9, 1.05),
        makeBar(2000, 1.05, 1.15, 1.0, 1.1),
      ];
      const updated = makeBar(1000, 1.0, 1.12, 0.88, 1.07);
      const result = mergeTickBar(existing, updated, false);
      expect(result).toEqual([updated, existing[1]]);
    });

    it('updates high/low/close on a developing bar (tick merge pattern)', () => {
      const existing = [makeBar(1000, 1.0, 1.1, 0.9, 1.05)];
      // Simulate a tick that updates the bar: higher high, higher close
      const tickUpdate = makeBar(1000, 1.0, 1.15, 0.9, 1.12, 50);
      const result = mergeTickBar(existing, tickUpdate, false);
      expect(result).toHaveLength(1);
      expect(result[0].high).toBe(1.15);
      expect(result[0].close).toBe(1.12);
      expect(result[0].volume).toBe(50);
    });
  });

  describe('edge cases', () => {
    it('returns the same array reference when no mutation is needed (out-of-order, not isBarClose)', () => {
      const existing = [
        makeBar(1000, 1.0, 1.1, 0.9, 1.05),
        makeBar(2000, 1.05, 1.15, 1.0, 1.1),
      ];
      const lateBar = makeBar(500, 0.95, 1.0, 0.9, 0.98);
      const result = mergeTickBar(existing, lateBar, false);
      // Should return the original array (no copy, no mutation)
      expect(result).toBe(existing);
    });

    it('first tick of a new period: empty array becomes single-bar array', () => {
      const firstTick = makeBar(2000, 1.1, 1.1, 1.1, 1.1);
      const result = mergeTickBar([], firstTick, false);
      expect(result).toEqual([firstTick]);
    });

    it('tick exactly at open price: bar is still appended with correct OHLC', () => {
      const existing = [makeBar(1000, 1.0, 1.0, 1.0, 1.0)];
      const samePriceTick = makeBar(2000, 1.0, 1.0, 1.0, 1.0);
      const result = mergeTickBar(existing, samePriceTick, false);
      expect(result).toEqual([existing[0], samePriceTick]);
      expect(result[1].open).toBe(1.0);
      expect(result[1].high).toBe(1.0);
      expect(result[1].low).toBe(1.0);
      expect(result[1].close).toBe(1.0);
    });

    it('ticks out of order: isBarClose=false with earlier timestamp does nothing', () => {
      const existing = [
        makeBar(1000, 1.0, 1.1, 0.9, 1.05),
        makeBar(2000, 1.05, 1.15, 1.0, 1.1),
      ];
      const oldTick = makeBar(500, 0.95, 1.0, 0.9, 0.98);
      const result = mergeTickBar(existing, oldTick, false);
      expect(result).toBe(existing);
      expect(result).toHaveLength(2);
    });

    it('does not mutate the input array', () => {
      const existing = [makeBar(1000, 1.0, 1.1, 0.9, 1.05)];
      const newBar = makeBar(2000, 1.05, 1.15, 1.0, 1.1);
      mergeTickBar(existing, newBar, false);
      expect(existing).toEqual([makeBar(1000, 1.0, 1.1, 0.9, 1.05)]);
    });
  });
});

// ── mergeHistoryBars ──

describe('mergeHistoryBars', () => {
  it('returns incoming bars when existing is empty', () => {
    const incoming = [makeBar(1000, 1.0, 1.1, 0.9, 1.05), makeBar(2000, 1.05, 1.15, 1.0, 1.1)];
    const result = mergeHistoryBars([], incoming);
    expect(result).toEqual(incoming);
  });

  it('merges non-overlapping sets in timestamp order', () => {
    const existing = [makeBar(3000, 1.1, 1.2, 1.0, 1.15)];
    const incoming = [makeBar(1000, 1.0, 1.1, 0.9, 1.05), makeBar(2000, 1.05, 1.15, 1.0, 1.1)];
    const result = mergeHistoryBars(existing, incoming);
    expect(result).toEqual([incoming[0], incoming[1], existing[0]]);
  });

  it('deduplicates overlapping bars — existing (live data) wins over incoming (history)', () => {
    const existing = [makeBar(1000, 1.0, 1.12, 0.88, 1.07)]; // live: higher high, lower low
    const incoming = [makeBar(1000, 1.0, 1.1, 0.9, 1.05)]; // history: older snapshot
    const result = mergeHistoryBars(existing, incoming);
    expect(result).toHaveLength(1);
    // Existing bar wins (last write wins — existing is written second in the Map)
    expect(result[0].high).toBe(1.12);
    expect(result[0].low).toBe(0.88);
  });

  it('merges with partial overlap — only common timestamps are deduped', () => {
    const existing = [
      makeBar(2000, 1.05, 1.15, 1.0, 1.1),
      makeBar(3000, 1.1, 1.2, 1.0, 1.15),
    ];
    const incoming = [
      makeBar(1000, 1.0, 1.1, 0.9, 1.05),
      makeBar(2000, 1.05, 1.15, 1.0, 1.1),
    ];
    const result = mergeHistoryBars(existing, incoming);
    // 3 unique bars: 1000 from incoming, 2000 deduped (same data), 3000 from existing
    expect(result).toHaveLength(3);
    expect(result[0].timestamp).toBe(1000);
    expect(result[1].timestamp).toBe(2000);
    expect(result[2].timestamp).toBe(3000);
  });

  it('result is sorted by timestamp ascending', () => {
    const existing = [makeBar(500, 0.95, 1.0, 0.9, 0.98)];
    const incoming = [makeBar(2000, 1.05, 1.15, 1.0, 1.1), makeBar(1000, 1.0, 1.1, 0.9, 1.05)];
    const result = mergeHistoryBars(existing, incoming);
    expect(result[0].timestamp).toBe(500);
    expect(result[1].timestamp).toBe(1000);
    expect(result[2].timestamp).toBe(2000);
  });

  it('handles large merge without performance issues (Map-based O(1) dedup)', () => {
    const existing = Array.from({ length: 1000 }, (_, i) =>
      makeBar(i * 100, i, i + 0.1, i - 0.1, i + 0.05)
    );
    const incoming = Array.from({ length: 500 }, (_, i) =>
      makeBar(i * 100 + 50, i, i + 0.1, i - 0.1, i + 0.05)
    );
    const result = mergeHistoryBars(existing, incoming);
    // All bars are unique timestamps — 1500 total
    expect(result).toHaveLength(1500);
  });

  it('completely overlapping: all incoming timestamps exist in existing', () => {
    const existing = [makeBar(1000, 1.0, 1.1, 0.9, 1.05), makeBar(2000, 1.05, 1.15, 1.0, 1.1)];
    const incoming = [makeBar(1000, 1.0, 1.1, 0.9, 1.05), makeBar(2000, 1.05, 1.15, 1.0, 1.1)];
    const result = mergeHistoryBars(existing, incoming);
    // Same number of bars, existing wins for overlapping
    expect(result).toHaveLength(2);
  });
});
