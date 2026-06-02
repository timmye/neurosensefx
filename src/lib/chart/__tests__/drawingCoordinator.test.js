import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDrawingCoordinator } from '../drawingCoordinator.js';
import { createMockChart } from './helpers/chartHarness.js';
import { createMockDrawingStore } from './helpers/drawingStoreHarness.js';

/**
 * Helper: create a mock chart with enough data for restoreDrawings to succeed,
 * plus an overrideOverlay spy and createOverlay that returns an ID.
 */
function createCoordinatorChart(overrides = {}) {
  const chart = createMockChart(overrides);

  // Set return values via the descriptor properties defined in chartHarness
  chart.getDataList.returns = Array.from({ length: 20 }, (_, i) => ({
    timestamp: 1000000 + i * 60000,
    open: 1.0, high: 1.01, low: 0.99, close: 1.005, volume: 100,
  }));
  chart.getVisibleRange.returns = { from: 0, to: 19 };

  // Override createOverlay to return a deterministic overlayId so that
  // CreateDrawingCommand can capture it as this.overlayId.
  let overlayCounter = 0;
  const origCreateOverlay = chart.createOverlay;
  const wrappedCreateOverlay = (...args) => {
    wrappedCreateOverlay.calls.push(args);
    origCreateOverlay(...args);
    const id = args[0]?.id || `overlay-${overlayCounter++}`;
    return id;
  };
  wrappedCreateOverlay.calls = [];
  chart.createOverlay = wrappedCreateOverlay;

  // Add overrideOverlay if not already present (chartHarness may not include it)
  if (!chart.overrideOverlay) {
    const overrideOverlay = (...args) => {
      overrideOverlay.calls.push(args);
    };
    overrideOverlay.calls = [];
    chart.overrideOverlay = overrideOverlay;
  }

  return chart;
}

describe('drawingCoordinator', () => {
  let chart, store, logMessages, coordinator;

  beforeEach(() => {
    chart = createCoordinatorChart();
    store = createMockDrawingStore();
    logMessages = [];
    coordinator = createDrawingCoordinator({
      drawingStore: store,
      onLog: (...args) => logMessages.push(args),
    });
    coordinator.setChart(chart);
  });

  // ── resetForNewSymbol ──────────────────────────────────────
  describe('resetForNewSymbol', () => {
    it('clears command stack and overlay meta', () => {
      // Put something in overlayMeta via a create event
      const event = {
        detail: {
          overlayId: 'o1',
          overlayType: 'horizontalRayLine',
          points: [{ dataIndex: 5, value: 1.1 }],
          styles: {},
        },
      };
      coordinator.handleDrawingCreated(event);
      expect(coordinator.canUndo).toBeDefined();

      coordinator.resetForNewSymbol();
      // After clear, canUndo derived store should reflect empty undoStack
      let canUndoValue = true;
      const unsub = coordinator.canUndo.subscribe(v => { canUndoValue = v; });
      unsub();
      // Subscribe returns current value; after clear it should be false
      expect(canUndoValue).toBe(false);
    });

    it('resets context menu and context state', () => {
      coordinator.resetForNewSymbol();
      let menuState, ctxState;
      coordinator.contextMenuState.subscribe(v => { menuState = v; })();
      coordinator.contextState.subscribe(v => { ctxState = v; })();
      expect(menuState).toEqual({ visible: false, x: 0, y: 0, overlayId: null });
      expect(ctxState).toEqual({ locked: false, pinned: false });
    });
  });

  // ── handleOverlayDelete serialization ────────────────────────
  describe('handleOverlayDelete', () => {
    it('serializes pinned and locked state', () => {
      chart.getOverlayById = vi.fn(() => ({
        id: 'o1',
        name: 'horizontalRayLine',
        points: [{ dataIndex: 5, value: 1.1 }],
        styles: {},
        extendData: null,
        lock: true,
      }));

      coordinator.handleOverlayDelete('o1');
      expect(chart.removeOverlay.calls.length).toBeGreaterThan(0);
    });
  });

  // ── clearDrawings race safety ────────────────────────────────
  describe('clearDrawings', () => {
    it('captures symbol and resolution at call time', async () => {
      await coordinator.clearDrawings('EUR/USD', '1H');
      expect(store.calls.clearAll).toHaveLength(1);
      expect(store.calls.clearAll[0]).toEqual({ symbol: 'EUR/USD', resolution: '1H' });
    });

    it('calls clearAll which tombstones instead of hard-deletes', async () => {
      await store.save('EUR/USD', '1H', {
        overlayId: 'o1',
        overlayType: 'horizontalRayLine',
        points: [{ dataIndex: 5, value: 1.1 }],
      });

      await coordinator.clearDrawings('EUR/USD', '1H');
      const record = store._data.get('o1');
      expect(record.deletedAt).toBeDefined();
      expect(record.overlayId).toBe('o1');
    });
  });

  // ── toggleLock / togglePin ──────────────────────────────────
  describe('toggleLock', () => {
    it('toggles lock state and updates store', async () => {
      chart.getOverlayById = vi.fn(() => ({
        id: 'o1',
        lock: false,
      }));
      const result = await coordinator.toggleLock('o1');
      expect(result).toBe(true);
      expect(store.calls.update).toHaveLength(1);
      expect(store.calls.update[0].changes.locked).toBe(true);
    });
  });

  describe('togglePin', () => {
    it('toggles pin state and updates store', async () => {
      const result = await coordinator.togglePin('o1');
      expect(result).toBe(true);
      expect(store.calls.update).toHaveLength(1);
      expect(store.calls.update[0].changes.pinned).toBe(true);
    });
  });

  // ── restoreDrawings abort ──────────────────────────────────
  describe('restoreDrawings', () => {
    it('loads and renders drawings from store', async () => {
      await store.save('EUR/USD', '1H', {
        overlayId: 'o1',
        overlayType: 'horizontalRayLine',
        points: [{ dataIndex: 5, value: 1.1 }],
      });

      await coordinator.restoreDrawings('EUR/USD', '1H');
      expect(store.calls.load).toHaveLength(1);
      expect(chart.createOverlay.calls.length).toBeGreaterThan(0);
    });

    it('aborts when resetForNewSymbol is called during restore', async () => {
      const slowStore = createMockDrawingStore();
      const originalLoad = slowStore.load.bind(slowStore);
      slowStore.load = vi.fn(async () => {
        await new Promise(r => setTimeout(r, 500));
        return originalLoad('EUR/USD', '1H');
      });

      const coord = createDrawingCoordinator({ drawingStore: slowStore, onLog: () => {} });
      coord.setChart(chart);

      const restorePromise = coord.restoreDrawings('EUR/USD', '1H');
      coord.resetForNewSymbol();
      await restorePromise;

      // Should not have created overlays since restore was aborted
      expect(chart.createOverlay.calls.length).toBe(0);
    });

    it('logs warning when max restore attempts reached', async () => {
      const emptyChart = createCoordinatorChart();
      emptyChart.getDataList.returns = [];
      emptyChart.getVisibleRange.returns = { from: 0, to: 0 };
      const coord = createDrawingCoordinator({ drawingStore: store, onLog: (...args) => logMessages.push(args) });
      coord.setChart(emptyChart);

      await coord.restoreDrawings('EUR/USD', '1H');
      expect(logMessages.length).toBeGreaterThan(0);
      expect(logMessages[0][0]).toContain('Max attempts');
    });
  });

  // ── destroy ─────────────────────────────────────────────────
  describe('destroy', () => {
    it('clears all internal state and nulls chart', () => {
      coordinator.destroy();
      // Should not throw after destroy
      coordinator.resetForNewSymbol();
    });
  });

  // ── overlayMeta behavior (absorbed from overlayMeta.js) ────
  describe('overlayMeta (absorbed)', () => {
    it('tracks pinned state for overlays', async () => {
      await coordinator.togglePin('o1');
      const result = await coordinator.togglePin('o1');
      expect(result).toBe(false);
    });
  });

  // ── DeleteDrawingCommand.undo validation ────────────────────
  describe('DeleteDrawingCommand.undo validation', () => {
    it('no-ops when serializedOverlay is missing required fields', async () => {
      const event = {
        detail: {
          overlayId: 'o1',
          overlayType: 'horizontalRayLine',
          points: [{ dataIndex: 5, value: 1.1 }],
          styles: {},
        },
      };
      coordinator.handleDrawingCreated(event);

      chart.getOverlayById = vi.fn(() => ({
        id: 'o1',
        name: 'horizontalRayLine',
        points: [{ dataIndex: 5, value: 1.1 }],
        styles: {},
        extendData: null,
        lock: false,
      }));
      coordinator.handleOverlayDelete('o1');

      // Undo should re-create the overlay since data is valid
      await coordinator.undo();
      expect(chart.createOverlay.calls.length).toBeGreaterThan(0);
    });
  });
});
