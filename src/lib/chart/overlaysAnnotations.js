/**
 * Annotation overlay registrations for KLineChart.
 *
 * Interactive annotation and tag overlays (replacing built-in versions
 * that set ignoreEvent:true, preventing selection).
 * Side-effect module — imported once in ChartDisplay.svelte.
 */

import { registerOverlay } from 'klinecharts';

const ANNOTATION_STYLE = {
  color: '#FFFFFF',
  size: 12,
  family: '"Georgia Pro", Georgia, serif',
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
