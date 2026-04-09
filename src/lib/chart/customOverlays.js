/**
 * Custom overlay registrations for KLineChart.
 * rect, circle, polygon, arc, and triangle are built-in figures but NOT overlays.
 * These register them as interactive drawing overlays via registerOverlay().
 */

import { registerOverlay, registerIndicator } from 'klinecharts';

/**
 * Background symbol watermark — faded text centered at top of candle pane.
 * extendData: { symbol, resolution, window } — updated via setExtendData().
 */
registerIndicator({
  name: 'symbolWatermark',
  shortName: '',
  series: 'price',
  visible: true,
  zLevel: -1,
  calcParams: [],
  shouldOhlc: false,
  calc: (dataList) => dataList.map(() => ({})),
  draw: ({ ctx, bounding, indicator }) => {
    const { symbol, resolution, window: windowLabel } = indicator.extendData ?? {};
    if (!symbol) return true;
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const cx = bounding.width / 2;
    const top = bounding.top + 16;
    ctx.font = 'bold 48px "DejaVu Serif", Georgia, serif';
    ctx.fillText(symbol, cx, top);
    if (resolution && windowLabel) {
      ctx.font = 'normal 24px "DejaVu Serif", Georgia, serif';
      ctx.fillText(`${resolution} · ${windowLabel}`, cx, top + 52);
    }
    ctx.restore();
    return true;
  }
});

/**
 * Cumulative OBV (no MA) — overrides built-in OBV which includes a 30-period MA line.
 * ta.cum(math.sign(ta.change(close)) * volume)
 */
registerIndicator({
  name: 'OBV',
  shortName: 'OBV',
  series: 'normal',
  calcParams: [],
  precision: 0,
  shouldOhlc: false,
  visible: true,
  figures: [
    { key: 'obv', title: 'OBV: ', type: 'line' }
  ],
  calc: function (dataList) {
    let obv = 0;
    return dataList.map((k, i) => {
      const prev = dataList[i - 1];
      if (!prev) return { obv: 0 };
      const sign = k.close > prev.close ? 1 : k.close < prev.close ? -1 : 0;
      obv += sign * (k.volume ?? 0);
      return { obv };
    });
  }
});

/**
 * Accumulation/Distribution Line — cumulative CLV × volume.
 * ta.cum(clv * volume) where clv = ((close - low) - (high - close)) / (high - low)
 */
registerIndicator({
  name: 'AD',
  shortName: 'A/D',
  series: 'normal',
  calcParams: [],
  precision: 2,
  shouldOhlc: false,
  visible: true,
  figures: [
    { key: 'ad', title: 'A/D: ', type: 'line' }
  ],
  calc: function (dataList) {
    let ad = 0;
    return dataList.map((k) => {
      const highLow = k.high - k.low;
      const clv = highLow === 0 ? 0 : ((k.close - k.low) - (k.high - k.close)) / highLow;
      ad += clv * (k.volume ?? 0);
      return { ad };
    });
  }
});

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
  family: '"DejaVu Serif", Georgia, serif',
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
      styles: { backgroundColor: '#958f00' },
      ignoreEvent: true
    };
  }
});

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
      // Vertical edge case: use x coordinates directly
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
      { type: 'text', isCheckEvent: false, attrs: texts }
    ];
  }
});
