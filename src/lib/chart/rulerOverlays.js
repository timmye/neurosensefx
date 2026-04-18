/**
 * Overlay management for QuickRuler.
 *
 * Creates, updates, and removes horizontal price-line overlays
 * that mark the ruler's origin and cursor positions.
 *
 * @module rulerOverlays
 */

import { getThemeColor } from './themeColors.js';

function getLineColor() {
  return getThemeColor('#958f00', '#d4c44f');
}

export function createRulerOverlays(chart, origin, cursor) {
  const originPt = chart.convertFromPixel(
    [{ x: origin.x, y: origin.y }],
    { paneId: 'candle_pane' }
  );
  const cursorPt = chart.convertFromPixel(
    [{ x: cursor.x, y: cursor.y }],
    { paneId: 'candle_pane' }
  );
  if (originPt[0] == null || cursorPt[0] == null) return [null, null];

  const lineColor = getLineColor();
  const originId = chart.createOverlay({
    name: 'rulerPriceLine',
    points: [{ value: originPt[0].value }],
    styles: { line: { color: lineColor } },
    lock: true,
  });
  const cursorId = chart.createOverlay({
    name: 'rulerPriceLine',
    points: [{ value: cursorPt[0].value }],
    styles: { line: { color: lineColor } },
    lock: true,
  });
  return [originId, cursorId];
}

export function updateCursorOverlay(chart, overlayId, cursor) {
  if (overlayId == null) return;
  const cursorPt = chart.convertFromPixel(
    [{ x: cursor.x, y: cursor.y }],
    { paneId: 'candle_pane' }
  );
  if (cursorPt[0] == null) return;
  chart.overrideOverlay({
    id: overlayId,
    points: [{ value: cursorPt[0].value }],
  });
}

export function removeRulerOverlays(chart, ids) {
  for (const id of ids) {
    if (id != null) chart.removeOverlay({ id });
  }
}

export { getLineColor };
