/**
 * Channel overlay registrations for KLineChart.
 *
 * Parallel lines and fibonacci retracement overlays that replace built-in
 * versions (klinecharts v9.8.x): parallelStraightLine renders full-width rays,
 * fibonacciLine draws from x=0.
 * Side-effect module — imported once in ChartDisplay.svelte.
 */

import { registerOverlay, getSupportedOverlays } from 'klinecharts';

// Warn if built-in overlay name changed
if (!getSupportedOverlays().includes('parallelStraightLine')) {
  console.warn(
    '[overlay] parallelStraightLine not found in klinecharts built-ins; ' +
    'registration may be redundant or target a renamed overlay. ' +
    'Remove if upstream klinecharts v9.8.x full-width ray issue is fixed.'
  );
}

/**
 * Parallel lines bounded by control points — replaces built-in
 * parallelStraightLine (v9.8.x) which renders two parallel rays spanning
 * the full chart width (x=0 to x=bounding.width).
 */
registerOverlay({
  name: 'parallelStraightLine',
  totalStep: 4,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length < 2) return [];
    const [p1, p2] = coordinates;

    if (coordinates.length === 2) {
      return [{ type: 'line', attrs: { coordinates: [p1, p2] } }];
    }

    const p3 = coordinates[2];

    // Same slope math as KLineChart's getParallelLines
    if (p1.x === p2.x) {
      return [
        { type: 'line', attrs: { coordinates: [p1, p2] } },
        { type: 'line', attrs: { coordinates: [{ x: p3.x, y: p1.y }, { x: p3.x, y: p2.y }] } }
      ];
    }

    const k = (p2.y - p1.y) / (p2.x - p1.x);
    const b = p1.y - k * p1.x;
    const b1 = p3.y - k * p3.x;

    const startX = p1.x;
    const endX = p2.x;

    return [
      { type: 'line', attrs: { coordinates: [p1, p2] } },
      { type: 'line', attrs: { coordinates: [{ x: startX, y: startX * k + b1 }, { x: endX, y: endX * k + b1 }] } }
    ];
  }
});

// Warn if built-in overlay name changed
if (!getSupportedOverlays().includes('fibonacciLine')) {
  console.warn(
    '[overlay] fibonacciLine not found in klinecharts built-ins; ' +
    'registration may be redundant or target a renamed overlay. ' +
    'Remove if upstream klinecharts v9.8.x x=0 origin issue is fixed.'
  );
}

/**
 * Fibonacci retracement — replaces built-in fibonacciLine (v9.8.x) which
 * draws fib level lines as rays from x=0 (left chart edge). This version
 * draws lines as segments starting at the leftmost click point, extending
 * right to the chart edge. Y-axis price labels are preserved.
 */
registerOverlay({
  name: 'fibonacciLine',
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates, bounding, overlay, precision, yAxis }) => {
    const points = overlay.points;
    if (coordinates.length === 0) return [];

    const inCandle = yAxis?.isInCandle() ?? true;
    const currentPrecision = inCandle ? precision.price : precision.excludePriceVolumeMax;

    const lines = [];
    const texts = [];

    if (coordinates.length > 1 && typeof points[0].value === 'number' && typeof points[1].value === 'number') {
      const startX = Math.min(coordinates[0].x, coordinates[1].x);
      const endX = bounding.width;
      const percents = [1, 0.786, 0.618, 0.5, 0.382, 0.236, 0];
      const yDif = coordinates[0].y - coordinates[1].y;
      const valueDif = points[0].value - points[1].value;

      percents.forEach((percent) => {
        const y = coordinates[1].y + yDif * percent;
        const value = ((points[1].value ?? 0) + valueDif * percent).toFixed(currentPrecision);
        lines.push({ coordinates: [{ x: startX, y }, { x: endX, y }] });
        texts.push({
          x: startX,
          y,
          text: `${value} (${(percent * 100).toFixed(1)}%)`,
          baseline: 'bottom'
        });
      });
    }

    return [
      { type: 'line', attrs: lines },
      { type: 'text', attrs: texts, styles: { style: 'fill', color: '#ef5350', size: 11, family: '"Georgia Pro", Georgia, serif', weight: 'normal', borderStyle: 'solid', borderSize: 0, borderColor: 'transparent', borderRadius: 0, backgroundColor: 'transparent' } }
    ];
  }
});
