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
 * Merge local drawings with same-resolution pinned drawings (dedup by dbId).
 * Returns { mergedLocal, pinnedForeign }.
 */
function mergeDrawings(localDrawings, pinnedDrawings, resolution) {
  const pinnedLocal = new Map();
  const pinnedForeign = [];
  for (const d of pinnedDrawings) {
    if (d.resolution === resolution) pinnedLocal.set(d.id, d);
    else pinnedForeign.push(d);
  }

  const mergedLocal = [];
  const seenIds = new Set();
  for (const d of localDrawings) {
    mergedLocal.push(d);
    seenIds.add(d.id);
  }
  for (const [, d] of pinnedLocal) {
    if (!seenIds.has(d.id)) {
      mergedLocal.push(d);
      seenIds.add(d.id);
    }
  }

  return { mergedLocal, pinnedForeign };
}

/**
 * Render merged local drawings at full opacity with interaction callbacks.
 */
function renderLocalDrawings(chart, drawings, callbacks, overlayMeta) {
  for (const drawing of drawings) {
    const opts = {
      id: drawing.overlayId,
      name: drawing.overlayType,
      points: drawing.points,
      styles: drawing.styles,
      ...callbacks,
    };
    if (drawing.extendData != null) opts.extendData = drawing.extendData;
    chart.createOverlay(opts);
    overlayMeta.setDbId(drawing.overlayId, drawing.id);
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
  const fromTimestamp = dataList?.[visibleRange.from]?.timestamp;

  for (const drawing of drawings) {
    const compoundId = `${drawing.overlayId}_pinned_${drawing.resolution}`;
    const mappedPoints = drawing.points.map(p => {
      if (isPriceOnlyOverlay(drawing.overlayType) && fromTimestamp != null) {
        return { ...p, timestamp: fromTimestamp };
      }
      return p;
    });
    const fadedStyles = getFadedStyles(drawing.styles, 0.5);
    const opts = {
      id: compoundId,
      name: drawing.overlayType,
      points: mappedPoints,
      styles: fadedStyles,
      lock: true,
    };
    if (drawing.extendData != null) {
      opts.extendData = withOriginBadge(drawing.extendData, drawing.resolution);
    }
    chart.createOverlay(opts);
    overlayMeta.setDbId(compoundId, drawing.id);
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
  async function restoreDrawings(symbol, resolution) {
    const chart = deps.chart;
    if (!chart) return;

    const localDrawings = await drawingStore.load(symbol, resolution);
    const pinnedDrawings = await drawingStore.loadPinned(symbol);
    const { mergedLocal, pinnedForeign } = mergeDrawings(localDrawings, pinnedDrawings, resolution);

    const callbacks = deps.getOverlayCallbacks();
    renderLocalDrawings(chart, mergedLocal, callbacks, deps.overlayMeta);
    renderForeignDrawings(chart, pinnedForeign, deps.overlayMeta);
  }

  return { restoreDrawings };
}
