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
 *
 * Text label auto-hides and only appears on hover, reducing chart clutter.
 * extendData is an object: { text: string, hovered: boolean }.
 * Backward-compatible: plain string extendData is migrated on first render.
 *
 * NOTE: onMouseEnter/onMouseLeave cannot be set here because registerOverlay
 * callbacks don't receive a chart reference. They must be set per-instance
 * via overrideOverlay where chart is in closure scope. See getOverlayCallbacks()
 * in ChartDisplay.svelte.
 */
registerOverlay({
  name: 'simpleAnnotation',
  totalStep: 2,
  styles: {
    line: { style: 'dashed' }
  },
  needDefaultPointFigure: true,
  createPointFigures: ({ overlay, coordinates, bounding }) => {
    // Migrate legacy plain-string extendData
    let data = overlay.extendData;
    if (typeof data === 'string' || data == null) {
      data = { text: data || '', hovered: false };
    }

    const x = coordinates[0].x;
    const fromY = coordinates[0].y;

    const figures = [
      // Vertical dashed line from point to top of pane
      {
        type: 'line',
        attrs: { coordinates: [{ x, y: fromY }, { x, y: 0 }] }
      },
      // Invisible wide hit area for easier hover detection
      {
        type: 'rect',
        attrs: { x: x - 15, y: 0, width: 30, height: bounding.height },
        styles: { style: 'fill', color: 'transparent', borderColor: 'transparent' }
      }
    ];

    // Only render text label when hovered
    if (data.hovered && data.text) {
      figures.push({
        type: 'text',
        attrs: { x, y: 18, text: data.text, align: 'center', baseline: 'bottom' },
        styles: ANNOTATION_STYLE
      });
    }

    return figures;
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
