/**
 * Custom overlay registrations for KLineChart.
 * rect, circle, polygon, arc, and triangle are built-in figures but NOT overlays.
 * These register them as interactive drawing overlays via registerOverlay().
 */

import { registerOverlay } from 'klinecharts';

/**
 * Horizontal line extending right from a single click point.
 * 1-click, right-extending, with permanent price label on Y axis.
 */
registerOverlay({
  name: 'horizontalRayLine',
  totalStep: 2,
  needDefaultPointFigure: true,
  createPointFigures: ({ coordinates, bounding }) => {
    return [{
      type: 'line',
      attrs: {
        coordinates: [
          { x: coordinates[0].x, y: coordinates[0].y },
          { x: bounding.width, y: coordinates[0].y }
        ]
      }
    }];
  },
  createYAxisFigures: ({ coordinates, bounding, yAxis, precision, overlay }) => {
    const isFromZero = yAxis?.isFromZero() ?? false;
    const x = isFromZero ? 0 : bounding.width;
    const align = isFromZero ? 'left' : 'right';
    const value = overlay.points?.[0]?.value;
    const text = value != null ? value.toFixed(precision.price) : '';
    return { type: 'text', attrs: { x, y: coordinates[0].y, text, align, baseline: 'middle' }, ignoreEvent: true };
  }
});

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

/**
 * Arrow overlay — 2 clicks (tail → head) with filled arrowhead.
 * Arrowhead: 3:1 ratio (base:depth), 30px long, filled black.
 */
registerOverlay({
  name: 'arrowOverlay',
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length !== 2) return [];
    const [tail, head] = coordinates;
    const dx = head.x - tail.x;
    const dy = head.y - tail.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return [];
    const ux = dx / len;
    const uy = dy / len;
    const px = -uy;
    const py = ux;
    const depth = 30;
    const halfWidth = 5;
    return [
      { type: 'line', attrs: { coordinates: [tail, head] }, styles: { color: '#333333' } },
      {
        type: 'polygon',
        attrs: {
          coordinates: [
            head,
            { x: head.x - depth * ux + halfWidth * px, y: head.y - depth * uy + halfWidth * py },
            { x: head.x - depth * ux - halfWidth * px, y: head.y - depth * uy - halfWidth * py },
          ]
        },
        styles: { style: 'fill', color: '#333333' }
      }
    ];
  }
});

const ANNOTATION_STYLE = {
  color: '#FFFFFF',
  size: 12,
  family: 'Helvetica Neue',
  weight: 'normal',
  backgroundColor: '#48752c',
  borderRadius: 0,
  paddingLeft: 4,
  paddingRight: 4,
  paddingTop: 3,
  paddingBottom: 3,
};

/**
 * Interactive annotation — replaces built-in simpleAnnotation.
 * Built-in version sets ignoreEvent:true on all figures, making overlays
 * non-selectable. This version removes that flag so click/select/right-click work.
 */
registerOverlay({
  name: 'simpleAnnotation',
  totalStep: 2,
  styles: {
    line: { style: 'dashed' }
  },
  needDefaultPointFigure: true,
  createPointFigures: ({ overlay, coordinates }) => {
    let text = '';
    if (overlay.extendData != null) {
      text = typeof overlay.extendData === 'function' ? overlay.extendData(overlay) : overlay.extendData;
    }
    const startX = coordinates[0].x;
    const startY = coordinates[0].y - 6;
    const lineEndY = startY - 50;
    const arrowEndY = lineEndY - 5;
    return [
      {
        type: 'line',
        attrs: { coordinates: [{ x: startX, y: startY }, { x: startX, y: lineEndY }] }
      },
      {
        type: 'polygon',
        attrs: { coordinates: [{ x: startX, y: lineEndY }, { x: startX - 4, y: arrowEndY }, { x: startX + 4, y: arrowEndY }] }
      },
      {
        type: 'text',
        attrs: { x: startX, y: arrowEndY, text: text || '', align: 'center', baseline: 'bottom' },
        styles: ANNOTATION_STYLE
      }
    ];
  }
});

/**
 * Interactive tag — replaces built-in simpleTag.
 * Built-in version sets ignoreEvent:true, preventing selection.
 */
registerOverlay({
  name: 'simpleTag',
  totalStep: 2,
  styles: {
    line: { style: 'dashed' }
  },
  needDefaultPointFigure: true,
  createPointFigures: ({ coordinates, bounding }) => {
    return {
      type: 'line',
      attrs: {
        coordinates: [
          { x: 0, y: coordinates[0].y },
          { x: bounding.width, y: coordinates[0].y }
        ]
      }
    };
  }
});
