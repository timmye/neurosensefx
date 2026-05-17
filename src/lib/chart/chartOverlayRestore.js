/**
 * Drawing restoration: load, merge, and render local + foreign (pinned
 * cross-resolution) drawings onto a KLineChart instance.
 */

import { drawingStore } from './drawingStore.js';
import {
  getFadedStyles,
  withOriginBadge,
  isPriceOnlyOverlay,
} from './styleUtils.js';

/**
 * Merge local drawings with same-resolution pinned drawings (dedup by overlayId).
 * Returns { mergedLocal, pinnedForeign }.
 */
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

/**
 * Render merged local drawings at full opacity with interaction callbacks.
 */
function renderLocalDrawings(chart, drawings, callbacks, overlayMeta) {
  for (const drawing of drawings) {
    if (!drawing.overlayId) continue;

    // Normalize points: strip dataIndex for timestamp-based resolution at render time.
    // KLineChart's _drawOverlay natively resolves { timestamp, value } via
    // timeScaleStore.timestampToDataIndex() internally. If timestamp is missing but
    // dataIndex exists (edge case: out-of-range click), fall back to dataIndex.
    const normalizedPoints = drawing.points.map(p => {
      if (p.timestamp != null && typeof p.timestamp === 'number') {
        return { timestamp: p.timestamp, value: p.value };
      }
      // Fallback: keep dataIndex when timestamp is missing
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
    overlayMeta.setPinned(drawing.overlayId, drawing.pinned || false);
    if (drawing.locked) {
      chart.overrideOverlay({ id: drawing.overlayId, lock: true });
    }
  }
}

/**
 * Render pinned foreign drawings (different resolution): faded, locked,
 * with origin badge showing source resolution.
 */
function renderForeignDrawings(chart, drawings, overlayMeta) {
  const visibleRange = chart.getVisibleRange();
  const dataList = chart.getDataList();

  // Guard: no data to resolve timestamps against
  if (!dataList || dataList.length === 0) return;

  const fromTimestamp = dataList[visibleRange.from]?.timestamp;

  for (const drawing of drawings) {
    const compoundId = `${drawing.overlayId}_pinned_${drawing.resolution}`;

    // Uniform timestamp normalization: strip dataIndex, use timestamp when available.
    // For truly price-only overlays (horizontalRayLine, rulerPriceLine), replace with
    // fromTimestamp so the line renders at the correct price level in the new resolution.
    const normalizedPoints = drawing.points.map(p => {
      if (isPriceOnlyOverlay(drawing.overlayType) && fromTimestamp != null) {
        return { timestamp: fromTimestamp, value: p.value };
      }
      if (p.timestamp != null && typeof p.timestamp === 'number') {
        return { timestamp: p.timestamp, value: p.value };
      }
      // Fallback: keep dataIndex when timestamp is missing
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
  }
}

/**
 * Create an overlay restorer.
 *
 * @param {object} deps
 * @param {object|null} deps.chart - KLineChart instance
 * @param {object} deps.overlayMeta - overlayMeta instance
 * @param {function} deps.getOverlayCallbacks - returns { onSelected, onDeselected, onRightClick }
 */
export function createOverlayRestore(deps) {
  async function restoreDrawings(symbol, resolution, attempt = 0) {
    const chart = deps.chart;
    if (!chart) return;

    const MIN_BARS = 10;
    const MAX_RESTORE_ATTEMPTS = 10; // ~3 seconds max wait

    // Guard: wait for minimum bars before restoring drawings.
    // Below 10 bars, KLineChart's barSpace layout may be incomplete.
    if (chart.getDataList().length < MIN_BARS) {
      if (attempt >= MAX_RESTORE_ATTEMPTS) {
        console.warn(`[restoreDrawings] Max attempts (${MAX_RESTORE_ATTEMPTS}) reached for ${symbol}/${resolution}`);
        return;
      }
      setTimeout(() => restoreDrawings(symbol, resolution, attempt + 1), 300);
      return;
    }

    const localDrawings = await drawingStore.load(symbol, resolution);
    const pinnedDrawings = await drawingStore.loadPinned(symbol);
    const { mergedLocal, pinnedForeign } = mergeDrawings(localDrawings, pinnedDrawings, resolution);

    const callbacks = deps.getOverlayCallbacks();
    renderLocalDrawings(chart, mergedLocal, callbacks, deps.overlayMeta);
    renderForeignDrawings(chart, pinnedForeign, deps.overlayMeta);
  }

  async function restorePinnedDrawings(symbol, resolution) {
    const chart = deps.chart;
    if (!chart) return;

    const pinnedDrawings = await drawingStore.loadPinned(symbol);
    const pinnedForeign = pinnedDrawings.filter(d => d.resolution !== resolution);
    renderForeignDrawings(chart, pinnedForeign, deps.overlayMeta);
  }

  return { restoreDrawings, restorePinnedDrawings };
}
