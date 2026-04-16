/**
 * Indicator registrations for KLineChart.
 *
 * Symbol watermark and Accumulation/Distribution line indicators.
 * Side-effect module — imported once in ChartDisplay.svelte.
 */

import { registerIndicator } from 'klinecharts';

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
    ctx.font = 'bold 48px "Georgia Pro", Georgia, serif';
    ctx.fillText(symbol, cx, top);
    if (resolution && windowLabel) {
      ctx.font = 'normal 24px "Georgia Pro", Georgia, serif';
      ctx.fillText(`${resolution} · ${windowLabel}`, cx, top + 52);
    }
    ctx.restore();
    return true;
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
