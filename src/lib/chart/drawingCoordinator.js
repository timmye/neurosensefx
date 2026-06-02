/**
 * Drawing coordinator: single factory that encapsulates all drawing state
 * and operations — absorbs logic from overlayMeta, chartOverlayRestore,
 * and chartDrawingHandlers into one cohesive module.
 */

import { writable, derived } from 'svelte/store';
import { DrawingCommandStack, CreateDrawingCommand } from './drawingCommands.js';
import { DeleteDrawingCommand } from './DeleteDrawingCommand.js';
import { getFadedStyles, withOriginBadge, isPriceOnlyOverlay } from './styleUtils.js';

/**
 * @param {object} deps
 * @param {object} deps.drawingStore - drawing persistence store
 * @param {function} deps.onLog - callback for errors/warnings
 * @returns {object} drawing coordinator API
 */
export function createDrawingCoordinator({ drawingStore, onLog }) {
  // ── Private state ──────────────────────────────────────────────
  const commandStack = new DrawingCommandStack();
  const overlayMeta = new Map(); // overlayId → { pinned }
  let selectedOverlayId = null;
  let chartInstance = null;
  let abortController = new AbortController();
  let _currentSymbol = null;
  let _currentResolution = null;
  const _onLog = onLog || function () {};

  const selectedOverlayIdStore = writable(null);

  // Writable stores
  const contextMenuState = writable({ visible: false, x: 0, y: 0, overlayId: null });
  const contextState = writable({ locked: false, pinned: false });

  // ── overlayMeta helpers (private) ──────────────────────────────
  function overlayMetaGet(overlayId) {
    return overlayMeta.get(overlayId);
  }

  function overlayMetaSetPinned(overlayId, pinned) {
    const entry = overlayMeta.get(overlayId) || {};
    overlayMeta.set(overlayId, { ...entry, pinned });
  }

  function overlayMetaGetPinned(overlayId) {
    return overlayMeta.get(overlayId)?.pinned ?? false;
  }

  function overlayMetaDelete(overlayId) {
    overlayMeta.delete(overlayId);
  }

  function overlayMetaClear() {
    overlayMeta.clear();
  }

  // ── Merge drawings (from chartOverlayRestore) ──────────────────
  function mergeDrawings(localDrawings, pinnedDrawings, resolution) {
    const pinnedLocal = new Map();
    const pinnedForeign = [];
    for (const d of pinnedDrawings) {
      if (d.resolution === resolution) pinnedLocal.set(d.overlayId, d);
      else pinnedForeign.push(d);
    }

    const mergedLocal = [];
    const seenIds = new Set();
    for (const d of localDrawings) {
      mergedLocal.push(d);
      seenIds.add(d.overlayId);
    }
    for (const [, d] of pinnedLocal) {
      if (!seenIds.has(d.overlayId)) {
        mergedLocal.push(d);
        seenIds.add(d.overlayId);
      }
    }

    return { mergedLocal, pinnedForeign };
  }

  // ── Render local drawings (from chartOverlayRestore) ──────────
  function renderLocalDrawings(chart, drawings, callbacks) {
    for (const drawing of drawings) {
      if (!drawing.overlayId) continue;

      const normalizedPoints = drawing.points.map(p => {
        if (p.timestamp != null && typeof p.timestamp === 'number') {
          return { timestamp: p.timestamp, value: p.value };
        }
        return { dataIndex: p.dataIndex, value: p.value };
      });

      const opts = {
        id: drawing.overlayId,
        name: drawing.overlayType,
        points: normalizedPoints,
        styles: drawing.styles,
        ...callbacks,
      };
      if (drawing.extendData != null) opts.extendData = drawing.extendData;
      chart.createOverlay(opts);
      overlayMetaSetPinned(drawing.overlayId, drawing.pinned || false);
      if (drawing.locked) {
        chart.overrideOverlay({ id: drawing.overlayId, lock: true });
      }
    }
  }

  // ── Render foreign pinned drawings (from chartOverlayRestore) ─
  function renderForeignDrawings(chart, drawings) {
    const visibleRange = chart.getVisibleRange();
    const dataList = chart.getDataList();

    if (!dataList || dataList.length === 0) return;

    const fromTimestamp = dataList[visibleRange.from]?.timestamp;

    for (const drawing of drawings) {
      const compoundId = `${drawing.overlayId}_pinned_${drawing.resolution}`;

      const normalizedPoints = drawing.points.map(p => {
        if (isPriceOnlyOverlay(drawing.overlayType) && fromTimestamp != null) {
          return { timestamp: fromTimestamp, value: p.value };
        }
        if (p.timestamp != null && typeof p.timestamp === 'number') {
          return { timestamp: p.timestamp, value: p.value };
        }
        return { dataIndex: p.dataIndex, value: p.value };
      });

      const fadedStyles = getFadedStyles(drawing.styles, 0.5);
      const opts = {
        id: compoundId,
        name: drawing.overlayType,
        points: normalizedPoints,
        styles: fadedStyles,
        lock: true,
      };
      if (drawing.extendData != null) {
        opts.extendData = withOriginBadge(drawing.extendData, drawing.resolution);
      }
      chart.createOverlay(opts);

      overlayMetaSetPinned(drawing.overlayId, drawing.pinned || false);
    }
  }

  // ── Register overlay for interaction (from chartDrawingHandlers) ─
  function registerOverlayForInteraction(overlayId, persistPromise) {
    overlayMetaSetPinned(overlayId, false);
    chartInstance.overrideOverlay({ id: overlayId, ...getOverlayCallbacks() });
    if (persistPromise) {
      persistPromise.then(() => {
        const overlay = chartInstance.getOverlayById(overlayId);
        if (overlay) {
          const ext = overlay.extendData;
          chartInstance.overrideOverlay({ id: overlayId, extendData: ext });
        }
      }).catch(err => _onLog('[DrawingHandlers] persistPromise failed for ' + overlayId + ':', err));
    }
  }

  // ── Restore pinned drawings only (foreign) ───────────────────
  async function restorePinnedDrawings(symbol, resolution) {
    const chart = chartInstance;
    if (!chart) return;

    const pinnedDrawings = await drawingStore.loadPinned(symbol);
    const pinnedForeign = pinnedDrawings.filter(d => d.resolution !== resolution);
    renderForeignDrawings(chart, pinnedForeign);
  }

  // ── Public API ─────────────────────────────────────────────────

  function handleDrawingCreated(event) {
    const { overlayId, overlayType, points, styles, extendData } = event.detail;
    const command = new CreateDrawingCommand(
      chartInstance, drawingStore, _currentSymbol, _currentResolution,
      overlayType, points, styles, extendData
    );
    command.overlayId = overlayId;
    commandStack.execute(command);
    registerOverlayForInteraction(overlayId, command.persist());
  }

  async function handleOverlayDelete(overlayId) {
    const overlay = chartInstance.getOverlayById(overlayId);
    if (!overlay) return;
    const serialized = {
      overlayId: overlay.id, overlayType: overlay.name,
      points: overlay.points, styles: overlay.styles, extendData: overlay.extendData,
      pinned: overlayMetaGetPinned(overlay.id),
      locked: overlay.lock ?? false,
    };
    const callbacks = getOverlayCallbacks();
    const command = new DeleteDrawingCommand(
      chartInstance, drawingStore, _currentSymbol, _currentResolution,
      overlayId, serialized, callbacks
    );
    commandStack.execute(command);
    overlayMetaDelete(overlayId);
  }

  async function toggleLock(overlayId) {
    const overlay = chartInstance.getOverlayById(overlayId);
    if (!overlay) return false;
    const newLock = !overlay.lock;
    chartInstance.overrideOverlay({ id: overlayId, lock: newLock });
    await drawingStore.update(overlayId, { locked: newLock });
    return newLock;
  }

  async function togglePin(overlayId) {
    const isPinned = overlayMetaGetPinned(overlayId);
    const newPinned = !isPinned;
    await drawingStore.update(overlayId, { pinned: newPinned });
    overlayMetaSetPinned(overlayId, newPinned);
    return newPinned;
  }

  async function undo() {
    await commandStack.undo();
  }

  async function redo() {
    const cmd = await commandStack.redo();
    if (cmd && cmd.overlayId && cmd.persist) {
      registerOverlayForInteraction(cmd.overlayId, cmd.persist());
    }
    return cmd;
  }

  function setChart(chart) {
    chartInstance = chart;
  }

  function resetForNewSymbol() {
    abortController.abort();
    abortController = new AbortController();
    commandStack.clear();
    overlayMetaClear();
    selectedOverlayId = null;
    selectedOverlayIdStore.set(null);
    contextMenuState.set({ visible: false, x: 0, y: 0, overlayId: null });
    contextState.set({ locked: false, pinned: false });
  }

  async function restoreDrawings(symbol, resolution) {
    const chart = chartInstance;
    if (!chart) return;

    const signal = abortController.signal;
    const MIN_BARS = 10;
    const MAX_RESTORE_ATTEMPTS = 10;

    let attempt = 0;
    const tryRestore = async () => {
      if (signal.aborted) return;

      if (chart.getDataList().length < MIN_BARS) {
        if (attempt >= MAX_RESTORE_ATTEMPTS) {
          _onLog(`[restoreDrawings] Max attempts (${MAX_RESTORE_ATTEMPTS}) reached for ${symbol}/${resolution}`);
          return;
        }
        attempt++;
        await new Promise(r => setTimeout(r, 300));
        await tryRestore();
        return;
      }

      const localDrawings = await drawingStore.load(symbol, resolution);
      const pinnedDrawings = await drawingStore.loadPinned(symbol);
      const { mergedLocal, pinnedForeign } = mergeDrawings(localDrawings, pinnedDrawings, resolution);

      if (signal.aborted) return;

      const callbacks = getOverlayCallbacks();
      renderLocalDrawings(chart, mergedLocal, callbacks);
      renderForeignDrawings(chart, pinnedForeign);

      if (signal.aborted) return;
      _currentSymbol = symbol;
      _currentResolution = resolution;
    };

    await tryRestore();
  }

  async function clearDrawings(symbol, resolution) {
    const capturedSymbol = symbol;
    const capturedResolution = resolution;

    if (chartInstance) chartInstance.removeOverlay();
    await drawingStore.clearAll(capturedSymbol, capturedResolution);
    commandStack.clear();
    for (const [id] of overlayMeta.entries()) {
      if (!id.includes('_pinned_')) {
        overlayMeta.delete(id);
      }
    }
    await restorePinnedDrawings(capturedSymbol, capturedResolution);
  }

  function destroy() {
    resetForNewSymbol();
    chartInstance = null;
  }

  function getOverlayCallbacks() {
    return {
      onSelected: (e) => {
        selectedOverlayId = e.overlay.id;
        selectedOverlayIdStore.set(selectedOverlayId);
        const baseId = e.overlay.id.replace(/_pinned_.+$/, '');
        const pinned = overlayMetaGetPinned(baseId);
        const locked = e.overlay.lock || false;
        contextState.set({ locked, pinned });
      },
      onDeselected: () => {
        selectedOverlayId = null;
        selectedOverlayIdStore.set(null);
        contextMenuState.set({ visible: false, x: 0, y: 0, overlayId: null });
        contextState.set({ locked: false, pinned: false });
      },
      onPressedMoveEnd: (e) => {
        const o = e.overlay;
        const baseId = o.id.replace(/_pinned_.+$/, '');
        drawingStore.update(baseId, { points: o.points });
      },
      onRightClick: (e) => {
        const o = e.overlay;
        const baseId = o.id.replace(/_pinned_.+$/, '');
        contextMenuState.set({ visible: true, x: e.pageX || e.x, y: e.pageY || e.y, overlayId: baseId });
        contextState.set({ locked: o.lock || false, pinned: overlayMetaGetPinned(baseId) });
        return true;
      },
      onMouseEnter: (e) => {
        const o = e.overlay;
        if (o.name !== 'simpleAnnotation') return false;
        let data = o.extendData;
        if (typeof data === 'string' || data == null) {
          data = { text: data || '', hovered: false };
        }
        if (!data.hovered) {
          chartInstance.overrideOverlay({ id: o.id, extendData: { ...data, hovered: true } });
        }
        return false;
      },
      onMouseLeave: (e) => {
        const o = e.overlay;
        if (o.name !== 'simpleAnnotation') return false;
        let data = o.extendData;
        if (typeof data === 'string' || data == null) return false;
        if (data.hovered) {
          chartInstance.overrideOverlay({ id: o.id, extendData: { ...data, hovered: false } });
        }
        return false;
      },
    };
  }

  return {
    handleDrawingCreated,
    handleOverlayDelete,
    toggleLock,
    togglePin,
    undo,
    redo,
    canUndo: commandStack.canUndo,
    canRedo: commandStack.canRedo,
    selectedOverlayId: selectedOverlayIdStore,
    contextMenuState,
    contextState,
    setChart,
    resetForNewSymbol,
    restoreDrawings,
    clearDrawings,
    destroy,
    getOverlayCallbacks,
  };
}
