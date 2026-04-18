/**
 * Annotation overlay registrations for KLineChart.
 *
 * Interactive annotation and tag overlays that replace built-in versions
 * (klinecharts v9.8.x) which set ignoreEvent:true, preventing selection.
 * Side-effect module — imported once in ChartDisplay.svelte.
 */

import { registerOverlay, getSupportedOverlays } from 'klinecharts';

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

// Warn if built-in overlay name changed (klinecharts update may have renamed it)
if (!getSupportedOverlays().includes('simpleAnnotation')) {
  console.warn(
    '[overlay] simpleAnnotation not found in klinecharts built-ins; ' +
    'registration may be redundant or target a renamed overlay. ' +
    'Remove if upstream klinecharts v9.8.x ignoreEvent:true issue is fixed.'
  );
}

/**
 * Interactive annotation — replaces built-in simpleAnnotation (v9.8.x).
 * Selection and right-click enabled on annotation figures; built-in sets
 * ignoreEvent:true, preventing interaction.
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

// Warn if built-in overlay name changed
if (!getSupportedOverlays().includes('simpleTag')) {
  console.warn(
    '[overlay] simpleTag not found in klinecharts built-ins; ' +
    'registration may be redundant or target a renamed overlay. ' +
    'Remove if upstream klinecharts v9.8.x ignoreEvent:true issue is fixed.'
  );
}

/**
 * Interactive tag — replaces built-in simpleTag (v9.8.x).
 * Selectable via right-click; built-in sets ignoreEvent:true.
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
