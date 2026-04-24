/**
 * Unit tests for createReconcile — single-writer reconciliation logic.
 *
 * Mocks the KLineChart instance and rAF so no DOM or canvas is needed.
 * Verifies: full replace, new-bar append, developing-bar tick update,
 * same-timestamp skip, rAF coalescing, and unsubscribe cleanup.
 *
 * Run: npm run test:unit -- src/lib/chart/__tests__/reconcile.test.js
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writable } from 'svelte/store';
import { createReconcile, mapBarToKline } from '../chartTickSubscriptions.js';

// ── rAF mock ──

let rafCallbacks = [];

function flushRAF() {
  const fns = rafCallbacks;
  rafCallbacks = [];
  for (const fn of fns) fn();
}

beforeEach(() => {
  rafCallbacks = [];
  vi.stubGlobal('requestAnimationFrame', (cb) => {
    rafCallbacks.push(cb);
    return 42;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Helpers ──

function makeBar(ts, o, h, l, c, vol = 0) {
  return { timestamp: ts, open: o, high: h, low: l, close: c, volume: vol };
}

function makeChart(dataList = []) {
  const chart = {
    getDataList: vi.fn(() => dataList),
    applyNewData: vi.fn(),
    updateData: vi.fn(),
    scrollToRealTime: vi.fn(),
  };
  return chart;
}

/** Minimal deps for createReconcile. chartSubs mock just collects onDataReady. */
function makeDeps(overrides = {}) {
  const onDataReadyFns = [];
  return {
    applyBarSpace: vi.fn(),
    chartContainer: { clientWidth: 800, clientHeight: 600 },
    setPending: vi.fn(),
    onDataReady: null,
    chartSubs: {
      subscribeOnDataReady: vi.fn((fn) => onDataReadyFns.push(fn)),
    },
    ...overrides,
  };
}

// ── Tests ──

describe('createReconcile', () => {
  // 1. Full data replace
  it('full data replace: barStore updateType=full calls chart.applyNewData with all bars', () => {
    const chart = makeChart();
    const barStore = writable({ state: 'idle', bars: [] });
    const marketStore = writable({ current: null });
    const deps = makeDeps();

    createReconcile(chart, barStore, marketStore, deps);

    const bars = [makeBar(1000, 1.0, 1.1, 0.9, 1.05), makeBar(2000, 1.05, 1.15, 1.0, 1.1)];
    barStore.set({ state: 'ready', updateType: 'full', bars });

    flushRAF();

    expect(chart.applyNewData).toHaveBeenCalledOnce();
    expect(chart.applyNewData).toHaveBeenCalledWith(bars.map(mapBarToKline));
  });

  // 2. New bar append
  it('new bar append: incremental update with new timestamp calls chart.updateData once', () => {
    const existingBars = [makeBar(1000, 1.0, 1.1, 0.9, 1.05)];
    const chart = makeChart(existingBars);
    const barStore = writable({ state: 'idle', bars: [] });
    const marketStore = writable({ current: null });
    const deps = makeDeps();

    // First: full replace to set initial state
    createReconcile(chart, barStore, marketStore, deps);
    barStore.set({ state: 'ready', updateType: 'full', bars: existingBars });
    flushRAF();

    // Now: incremental with a new bar
    const newBar = makeBar(2000, 1.05, 1.15, 1.0, 1.1);
    barStore.set({ state: 'ready', updateType: 'incremental', bars: [...existingBars, newBar] });
    flushRAF();

    // applyNewData called once (full), updateData called once (new bar)
    expect(chart.applyNewData).toHaveBeenCalledOnce();
    expect(chart.updateData).toHaveBeenCalledOnce();
    expect(chart.updateData).toHaveBeenCalledWith(mapBarToKline(newBar));
  });

  // 3. Developing bar tick update
  it('developing bar tick: marketStore tick merges high/low/close into last bar', () => {
    const existingBars = [makeBar(1000, 1.0, 1.1, 0.9, 1.05)];
    const chart = makeChart(existingBars);
    const barStore = writable({ state: 'idle', bars: [] });
    const marketStore = writable({ current: null });
    const deps = makeDeps();

    createReconcile(chart, barStore, marketStore, deps);

    // Full replace first
    barStore.set({ state: 'ready', updateType: 'full', bars: existingBars });
    flushRAF();

    // Tick comes in at 1.12 — higher than current high (1.1)
    marketStore.set({ current: 1.12 });
    flushRAF();

    expect(chart.updateData).toHaveBeenCalledOnce();
    expect(chart.updateData).toHaveBeenCalledWith({
      timestamp: 1000,
      open: 1.0,
      high: 1.12,   // max(1.1, 1.12)
      low: 0.9,
      close: 1.12,
      volume: 0,
    });
  });

  it('developing bar tick: updates low when tick is lower', () => {
    const existingBars = [makeBar(1000, 1.0, 1.1, 0.9, 1.05)];
    const chart = makeChart(existingBars);
    const barStore = writable({ state: 'idle', bars: [] });
    const marketStore = writable({ current: null });
    const deps = makeDeps();

    createReconcile(chart, barStore, marketStore, deps);

    barStore.set({ state: 'ready', updateType: 'full', bars: existingBars });
    flushRAF();

    // Tick comes in at 0.85 — lower than current low (0.9)
    marketStore.set({ current: 0.85 });
    flushRAF();

    expect(chart.updateData).toHaveBeenCalledOnce();
    expect(chart.updateData).toHaveBeenCalledWith({
      timestamp: 1000,
      open: 1.0,
      high: 1.1,
      low: 0.85,   // min(0.9, 0.85)
      close: 0.85,
      volume: 0,
    });
  });

  // 4. Same-timestamp bar update is skipped
  it('same-timestamp bar update is skipped (candle store developing bar ignored)', () => {
    const existingBars = [makeBar(1000, 1.0, 1.1, 0.9, 1.05)];
    const chart = makeChart(existingBars);
    const barStore = writable({ state: 'idle', bars: [] });
    const marketStore = writable({ current: null });
    const deps = makeDeps();

    createReconcile(chart, barStore, marketStore, deps);

    // Full replace
    barStore.set({ state: 'ready', updateType: 'full', bars: existingBars });
    flushRAF();

    // Candle store sends updated developing bar with same timestamp (1000)
    const updatedDeveloping = makeBar(1000, 1.0, 1.12, 0.88, 1.07);
    barStore.set({ state: 'ready', updateType: 'incremental', bars: [updatedDeveloping] });
    flushRAF();

    // updateData should NOT have been called — same timestamp is skipped
    expect(chart.updateData).not.toHaveBeenCalled();
  });

  // 5. rAF coalescing
  it('rAF coalescing: multiple rapid updates result in only one chart write per frame', () => {
    const existingBars = [makeBar(1000, 1.0, 1.1, 0.9, 1.05)];
    const chart = makeChart(existingBars);
    const barStore = writable({ state: 'idle', bars: [] });
    const marketStore = writable({ current: null });
    const deps = makeDeps();

    createReconcile(chart, barStore, marketStore, deps);

    // Full replace
    barStore.set({ state: 'ready', updateType: 'full', bars: existingBars });
    flushRAF();

    // Rapid-fire: 3 ticks in the same frame
    marketStore.set({ current: 1.06 });
    marketStore.set({ current: 1.07 });
    marketStore.set({ current: 1.08 });

    // Before flush: updateData not called yet (coalesced)
    expect(chart.updateData).not.toHaveBeenCalled();

    // Flush — only one chart write should happen
    flushRAF();
    expect(chart.updateData).toHaveBeenCalledOnce();
    // The last tick price (1.08) wins
    expect(chart.updateData).toHaveBeenCalledWith({
      timestamp: 1000,
      open: 1.0,
      high: 1.1,   // max(1.1, 1.08)
      low: 0.9,
      close: 1.08,
      volume: 0,
    });
  });

  it('rAF coalescing: full replace drains pending tick and new-bar', () => {
    const existingBars = [makeBar(1000, 1.0, 1.1, 0.9, 1.05)];
    const chart = makeChart(existingBars);
    const barStore = writable({ state: 'idle', bars: [] });
    const marketStore = writable({ current: null });
    const deps = makeDeps();

    createReconcile(chart, barStore, marketStore, deps);

    // Full replace
    barStore.set({ state: 'ready', updateType: 'full', bars: existingBars });
    flushRAF();

    // Queue a tick and a new bar
    marketStore.set({ current: 1.06 });
    const newBar = makeBar(2000, 1.05, 1.15, 1.0, 1.1);
    barStore.set({ state: 'ready', updateType: 'incremental', bars: [...existingBars, newBar] });

    // Before flush — another full replace arrives (history refresh)
    const refreshedBars = [makeBar(500, 0.95, 1.0, 0.9, 0.98), ...existingBars];
    barStore.set({ state: 'ready', updateType: 'full', bars: refreshedBars });

    flushRAF();

    // Only applyNewData called (full replace wins), tick and new-bar drained
    expect(chart.applyNewData).toHaveBeenCalledTimes(2); // initial + refresh
    expect(chart.updateData).not.toHaveBeenCalled();
  });

  // 6. Unsubscribe
  it('unsubscribe: both store subscriptions are cleaned up', () => {
    const chart = makeChart();
    const barStore = writable({ state: 'idle', bars: [] });
    const marketStore = writable({ current: null });
    const deps = makeDeps();

    const { unsubscribe } = createReconcile(chart, barStore, marketStore, deps);

    // Set data before unsubscribe
    const bars = [makeBar(1000, 1.0, 1.1, 0.9, 1.05)];
    barStore.set({ state: 'ready', updateType: 'full', bars });
    flushRAF();
    expect(chart.applyNewData).toHaveBeenCalledOnce();

    // Unsubscribe
    unsubscribe();

    // Set data after unsubscribe — should not trigger any chart writes
    barStore.set({ state: 'ready', updateType: 'full', bars: [makeBar(2000, 1.1, 1.2, 1.0, 1.15)] });
    marketStore.set({ current: 1.2 });
    flushRAF();

    // applyNewData still called only once (from before unsubscribe)
    expect(chart.applyNewData).toHaveBeenCalledOnce();
    expect(chart.updateData).not.toHaveBeenCalled();
  });

  // Edge: no data before full is received
  it('incremental updates before full replace are ignored', () => {
    const chart = makeChart();
    const barStore = writable({ state: 'idle', bars: [] });
    const marketStore = writable({ current: null });
    const deps = makeDeps();

    createReconcile(chart, barStore, marketStore, deps);

    // Incremental without prior full — should be ignored
    const bar = makeBar(1000, 1.0, 1.1, 0.9, 1.05);
    barStore.set({ state: 'ready', updateType: 'incremental', bars: [bar] });
    flushRAF();

    expect(chart.applyNewData).not.toHaveBeenCalled();
    expect(chart.updateData).not.toHaveBeenCalled();
  });

  // Edge: empty bars
  it('empty bars array is ignored', () => {
    const chart = makeChart();
    const barStore = writable({ state: 'idle', bars: [] });
    const marketStore = writable({ current: null });
    const deps = makeDeps();

    createReconcile(chart, barStore, marketStore, deps);

    barStore.set({ state: 'ready', updateType: 'full', bars: [] });
    flushRAF();

    expect(chart.applyNewData).not.toHaveBeenCalled();
    expect(chart.updateData).not.toHaveBeenCalled();
  });

  // Edge: non-ready state
  it('non-ready state is ignored', () => {
    const chart = makeChart();
    const barStore = writable({ state: 'idle', bars: [] });
    const marketStore = writable({ current: null });
    const deps = makeDeps();

    createReconcile(chart, barStore, marketStore, deps);

    barStore.set({ state: 'loading', updateType: 'full', bars: [makeBar(1000, 1, 1, 1, 1)] });
    flushRAF();

    expect(chart.applyNewData).not.toHaveBeenCalled();
  });

  // Edge: null tick in market store
  it('null current in marketStore is ignored', () => {
    const chart = makeChart();
    const barStore = writable({ state: 'idle', bars: [] });
    const marketStore = writable({ current: null });
    const deps = makeDeps();

    createReconcile(chart, barStore, marketStore, deps);

    marketStore.set({ current: null });
    flushRAF();

    expect(chart.updateData).not.toHaveBeenCalled();
  });

  // Edge: onDataReady callback
  it('onDataReady is invoked after full replace', () => {
    const chart = makeChart();
    const barStore = writable({ state: 'idle', bars: [] });
    const marketStore = writable({ current: null });
    const onDataReady = vi.fn();
    const deps = makeDeps({ onDataReady });

    createReconcile(chart, barStore, marketStore, deps);

    const bars = [makeBar(1000, 1.0, 1.1, 0.9, 1.05)];
    barStore.set({ state: 'ready', updateType: 'full', bars });
    flushRAF();

    // onDataReady should be registered via chartSubs.subscribeOnDataReady
    expect(deps.chartSubs.subscribeOnDataReady).toHaveBeenCalledOnce();
    // Invoke the registered callback
    const registeredFn = deps.chartSubs.subscribeOnDataReady.mock.calls[0][0];
    registeredFn();
    expect(onDataReady).toHaveBeenCalledOnce();
  });
});

describe('mapBarToKline', () => {
  it('maps a bar to KLineChart data shape', () => {
    const bar = makeBar(1000, 1.0, 1.1, 0.9, 1.05, 100);
    expect(mapBarToKline(bar)).toEqual({
      timestamp: 1000,
      open: 1.0,
      high: 1.1,
      low: 0.9,
      close: 1.05,
      volume: 100,
    });
  });

  it('defaults volume to 0 when missing', () => {
    const bar = { timestamp: 1000, open: 1.0, high: 1.1, low: 0.9, close: 1.05 };
    expect(mapBarToKline(bar).volume).toBe(0);
  });
});
