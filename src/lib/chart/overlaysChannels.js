/**
 * Channel overlay registrations for KLineChart.
 *
 * Parallel lines and fibonacci retracement overlays.
 * Side-effect module — imported once in ChartDisplay.svelte.
 */

import { registerOverlay } from 'klinecharts';

/**
 * Custom parallelStraightLine overlay — overrides built-in.
 * Built-in renders two parallel rays (x=0 to x=bounding.width).
 * This version draws fixed-length lines bounded by the control points:
 * line 1 from point 1 to point 2, line 2 same slope with intercept
 * derived from point 3, spanning the same x-range.
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

/**
 * Custom fibonacciLine overlay — overrides built-in.
 * Built-in draws fib level lines as rays from x=0 (left chart edge).
 * This version draws lines as segments starting at the leftmost click point,
 * extending right to the chart edge. Y-axis price labels are preserved.
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
      { type: 'text', attrs: texts }
    ];
  }
});
