/**
 * Price line overlay registrations for KLineChart.
 *
 * Horizontal ray line and ruler price line overlays.
 * Side-effect module — imported once in ChartDisplay.svelte.
 */

import { registerOverlay } from 'klinecharts';
import { getThemeColor } from './themeColors.js';

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
    const lineColor = overlay.styles?.line?.color ?? getThemeColor('#48752c', '#6ee7b7');
    return { type: 'text', attrs: { x, y: coordinates[0].y, text, align, baseline: 'middle' }, styles: { backgroundColor: lineColor }, ignoreEvent: true };
  }
});

/**
 * Ruler price line — dashed horizontal line spanning full chart width with
 * a permanent price label on the Y-axis. Used by QuickRuler to show price
 * levels at the origin and cursor during right-click drag.
 */
registerOverlay({
  name: 'rulerPriceLine',
  totalStep: 2,
  needDefaultPointFigure: true,
  styles: {
    line: { style: 'dashed' }
  },
  createPointFigures: ({ coordinates, bounding }) => {
    return [{
      type: 'line',
      attrs: {
        coordinates: [
          { x: 0, y: coordinates[0].y },
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
    return {
      type: 'text',
      attrs: { x, y: coordinates[0].y, text, align, baseline: 'middle' },
      styles: { backgroundColor: overlay.styles?.line?.color ?? getThemeColor('#48752c', '#6ee7b7') },
      ignoreEvent: true
    };
  }
});
