# KLineChart Indicators

## Overview

This project uses **klinecharts@9.8.12** which ships a set of built-in technical indicators and a plugin system for custom indicators. Indicators can render on the main candle pane (overlaid on price) or in separate bottom panes.

## Volume Data Pipeline

Tick volume from cTrader flows through the system automatically:

1. **cTrader trendbar API** — `volume` field is an object: `{ tick, real }`
2. **`CTraderDataProcessor.js:122`** — extracts `bar.volume.tick || bar.volume.real || 0`
3. **`CTraderEventHandler.js:69`** — passes `volume: tb.volume || 0`
4. **`chartDataStore.js:91`** — stores as `volume: bar.volume ?? 0`
5. **`ChartDisplay.svelte:585-592`** — feeds to kline via `chart.updateData({ ..., volume: bar.volume || 0 })`
6. **Indicator `calc()`** — reads `dataList[i].volume`

All volume-based indicators (OBV, VOL, A/D, etc.) consume this tick volume without modification.

## Built-in Indicators

### Price Series (overlay on candle pane)

| Name | ID | Description | Default Params |
|------|----|-------------|----------------|
| Bollinger Bands | `BOLL` | Upper/middle/lower bands | `[20, 2]` |
| Moving Average | `MA` | Simple moving averages | `[5, 10, 30, 60]` |
| Exponential MA | `EMA` | Exponential moving averages | `[6, 12, 20]` |
| Simple MA | `SMA` | Weighted SMA | `[12, 2]` |
| SAR | `SAR` | Parabolic stop and reverse | `[2, 2, 20]` |
| AVP | `AVP` | Average price (VWAP-like) | `[]` |
| BBI | `BBI` | Bull and bear index | `[3, 6, 12, 24]` |

### Normal Series (separate bottom pane)

| Name | ID | Description | Default Params |
|------|----|-------------|----------------|
| OBV | `OBV` | On Balance Volume + MA | `[30]` |
| MACD | `MACD` | MACD histogram/lines | `[12, 26, 9]` |
| RSI | `RSI` | Relative Strength Index | `[6, 14, 6]` |
| KDJ | `KDJ` | Stochastic oscillator | `[9, 3, 3]` |
| DMI | `DMI` | Directional movement index | `[14, 6]` |
| CR | `CR` | Energy indicator | `[26, 10, 20, 40, 60]` |
| DMA | `DMA` | Different of moving averages | `[10, 50, 10]` |
| WR | `WR` | Williams %R | `[14]` |
| PVT | `PVT` | Price and volume trend | `[]` |

### Volume Series (separate bottom pane)

| Name | ID | Description | Default Params |
|------|----|-------------|----------------|
| Volume | `VOL` | Bar chart + MA lines | `[5, 10, 20]` |

## Creating Indicators on the Chart

### Adding a built-in indicator

```js
// Overlay on candle pane
chart.createIndicator('BOLL', false, { id: 'candle_pane' });

// New bottom pane
chart.createIndicator('OBV', false, { position: 'bottom', height: 100 });

// With custom calc params
chart.createIndicator('MA', false, { id: 'candle_pane' }, { calcParams: [10, 20, 50] });
```

### Removing an indicator

```js
chart.removeIndicator('candle_pane', 'BOLL');
chart.removeIndicator(paneId, 'OBV');
```

## Custom Indicator Registration

Use `registerIndicator()` from `klinecharts`. The existing `customOverlays.js` has a working example (symbolWatermark).

### Indicator Template Interface

```js
import { registerIndicator } from 'klinecharts';

registerIndicator({
  name: 'myIndicator',       // unique ID string
  shortName: 'MyInd',        // display label
  series: 'normal',          // 'normal' (bottom pane) | 'price' (overlay) | 'volume'
  calcParams: [],             // user-configurable numeric params
  precision: 2,               // decimal places
  shouldOhlc: false,          // show OHLC in tooltip
  shouldFormatBigNumber: false,
  visible: true,
  minValue: undefined,        // Y-axis floor (optional)
  maxValue: undefined,        // Y-axis ceiling (optional)
  figures: [                  // one per rendered line/bar
    { key: 'value', title: 'Val: ', type: 'line' }
  ],
  // Required: compute indicator values from OHLCV data
  calc: function (dataList, indicator) {
    // dataList: Array<{ timestamp, open, high, low, close, volume }>
    // indicator.calcParams: the params array above
    // Return: Array<{ key: value }> — same length as dataList
    return dataList.map((k, i) => ({ value: 0 }));
  },
  // Optional: custom canvas rendering
  draw: function ({ ctx, bounding, indicator }) {
    // ctx: CanvasRenderingContext2D
    // bounding: { width, height, left, top, right, bottom }
    // indicator.result: calc() output
    return true; // return false to skip default rendering
  }
});
```

### Example: Accumulation/Distribution Line

```js
registerIndicator({
  name: 'AD',
  shortName: 'A/D',
  series: 'normal',
  calcParams: [],
  precision: 2,
  shouldOhlc: false,
  visible: true,
  figures: [
    { key: 'ad', title: 'AD: ', type: 'line' }
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

// Then add to chart:
chart.createIndicator('AD', false, { position: 'bottom', height: 100 });
```

## Indicator Series Types

| Series | Pane | Y-axis | Use case |
|--------|------|--------|----------|
| `price` | Candle pane (overlay) | Price scale | MA, BOLL, SAR |
| `normal` | New bottom pane | Auto-scaled | OBV, MACD, RSI, A/D |
| `volume` | New bottom pane | Volume scale, min=0 | VOL |

## Figure Types

| Type | Description |
|------|-------------|
| `line` | Continuous line |
| `bar` | Histogram bars (MACD-style) |
| `circle` | Dot markers |
| `area` | Filled area under line |
| Volume figure | Special `getVolumeFigure()` for up/down colored bars |

## Key Files

| File | What |
|------|------|
| `src/lib/chart/customOverlays.js` | Custom indicator/overlay registrations |
| `src/components/ChartDisplay.svelte:695` | Where indicators are created |
| `src/lib/chart/chartThemeLight.js` | Indicator colors, tooltip, bar styles |
| `node_modules/klinecharts/dist/umd/klinecharts.js` | Built-in indicator source (search `name: 'OBV'` etc.) |
