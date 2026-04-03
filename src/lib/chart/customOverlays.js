/**
 * Custom overlay registrations for KLineChart.
 * rect, circle, polygon, arc, and triangle are built-in figures but NOT overlays.
 * These register them as interactive drawing overlays via registerOverlay().
 */

import { registerOverlay } from 'klinecharts';

/**
 * Rectangle overlay — 2 clicks (opposite corners)
 */
registerOverlay({
  name: 'rectOverlay',
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length === 2) {
      const cx = Math.min(coordinates[0].x, coordinates[1].x);
      const cy = Math.min(coordinates[0].y, coordinates[1].y);
      const w = Math.abs(coordinates[1].x - coordinates[0].x);
      const h = Math.abs(coordinates[1].y - coordinates[0].y);
      return { type: 'rect', attrs: { x: cx, y: cy, width: w, height: h } };
    }
    return [];
  }
});

/**
 * Circle overlay — 2 clicks (center + edge)
 */
registerOverlay({
  name: 'circleOverlay',
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length === 2) {
      const dx = coordinates[1].x - coordinates[0].x;
      const dy = coordinates[1].y - coordinates[0].y;
      const r = Math.sqrt(dx * dx + dy * dy);
      return { type: 'circle', attrs: { x: coordinates[0].x, y: coordinates[0].y, r } };
    }
    return [];
  }
});

/**
 * Polygon (triangle) overlay — 3 clicks for a triangle
 */
registerOverlay({
  name: 'polygonOverlay',
  totalStep: 4,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length === 3) {
      return { type: 'polygon', attrs: { coordinates } };
    }
    return [];
  }
});

/**
 * Arc overlay — 3 clicks (center, start angle point, end angle point)
 */
registerOverlay({
  name: 'arcOverlay',
  totalStep: 4,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length > 1) {
      const cx = coordinates[0].x;
      const cy = coordinates[0].y;
      const dx0 = coordinates[1].x - cx;
      const dy0 = coordinates[1].y - cy;
      const r = Math.sqrt(dx0 * dx0 + dy0 * dy0);
      const startAngle = Math.atan2(dy0, dx0);
      let endAngle = startAngle;
      if (coordinates.length === 3) {
        const dx1 = coordinates[2].x - cx;
        const dy1 = coordinates[2].y - cy;
        endAngle = Math.atan2(dy1, dx1);
      }
      return { type: 'arc', attrs: { x: cx, y: cy, r, startAngle, endAngle } };
    }
    return [];
  }
});
