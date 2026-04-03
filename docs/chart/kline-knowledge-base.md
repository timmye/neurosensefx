# KLineChart v9.8.12 — Knowledge Base

> Sources: Official docs at https://klinecharts.com, TypeScript declarations (`node_modules/klinecharts/dist/index.d.ts`), UMD source (`node_modules/klinecharts/dist/umd/klinecharts.js`)

## Version & Package

- **npm**: `klinecharts@9.8.12`
- **Entry**: `import { init, dispose, registerOverlay, ... } from 'klinecharts'`
- **Types**: `node_modules/klinecharts/dist/index.d.ts`
- **Zero dependencies** — pure canvas rendering, ~40kb gzipped

---

## Initialization

```js
import { init, dispose } from 'klinecharts'

// Init with options
const chart = init(containerElement, {
  styles: { /* Styles object or registered style name */ },
  locale: 'en-US',
  timezone: 'Etc/UTC',
  customApi: { formatDate, formatBigNumber },
  thousandsSeparator: ',',
  decimalFoldThreshold: null,
  layout: [/* LayoutChild array */]
})

// Destroy
dispose(containerElement)
```

---

## Styles (Theming)

Apply at init or later:

```js
// At init
init(el, { styles: myTheme })

// After init
chart.setStyles({ candle: { ... } })

// Or use a registered name
chart.setStyles('my_registered_theme')
```

### Register Named Styles

```js
import { registerStyles } from 'klinecharts'
registerStyles('dark_neon', { candle: { type: 'candle_solid', bar: { upColor: '#00ff88' } } })
```

### Full Style Object Structure

See `docs/chart/kline full default config.txt` for the complete structure. Top-level keys:

| Key | Controls |
|-----|----------|
| `grid` | Horizontal/vertical grid lines |
| `candle` | Candlestick type, colors, price marks, tooltip |
| `indicator` | Indicator lines/bars/circles, last value mark, tooltip |
| `xAxis` | Time axis line, tick text, tick lines |
| `yAxis` | Price axis line, tick text, tick lines, type (normal/percentage/log), position (left/right) |
| `separator` | Pane separator styling |
| `crosshair` | Crosshair lines and price/time labels |
| `overlay` | Default styles for drawing overlays (point, line, rect, polygon, circle, arc, text) |

### Candle Types

```
'candle_solid'      — Filled candles (default)
'candle_stroke'     — Hollow outlined candles
'candle_up_stroke'  — Up hollow, down filled
'candle_down_stroke'— Down hollow, up filled
'ohlc'              — OHLC bars (no body)
'area'              — Area chart (line + gradient fill)
```

### Indicator Lines Array

The `indicator.lines[]` array maps to indicator figure indices. For BOLL:
- `lines[0]` → UP (upper band)
- `lines[1]` → MID (MA middle)
- `lines[2]` → DN (lower band)

---

## Built-in Indicators

Registered in the source with `name:` property. Available by string name:

| Name | Description | Default calcParams |
|------|-------------|--------------------|
| `MA` | Moving Average | `[5, 10, 30, 60]` |
| `EMA` | Exponential Moving Average | `[6, 12, 20]` |
| `SMA` | Simple Moving Average | - |
| `BOLL` | Bollinger Bands | `[20, 2]` (period, stdDev) |
| `RSI` | Relative Strength Index | - |
| `MACD` | Moving Avg Convergence Divergence | - |
| `KDJ` | Stochastic Oscillator | - |
| `WR` | Williams %R | - |
| `SAR` | Stop and Reverse | - |
| `OBV` | On Balance Volume | - |
| `VOL` | Volume | - |
| `DMI` | Directional Movement Index | - |
| `CCI` | Commodity Channel Index | - |
| `CR` | Current Ratio | - |
| `MTM` | Momentum | - |
| `ROC` | Rate of Change | - |
| `TRIX` | Triple Exponential | - |
| `BRAR` | BRAR | - |
| `PSY` | Psychological Line | - |
| `DMA` | Different of Moving Average | - |
| `EMV` | Ease of Movement | - |
| `BIAS` | Bias | - |
| `AVP` | Average Price | - |
| `BBI` | Bull and Bear Index | - |
| `AO` | Awesome Oscillator | - |
| `PVT` | Price Volume Trend | - |
| `VR` | Volume Ratio | - |

### Creating Indicators

```js
// On candle pane (overlay style, e.g. BOLL, MA)
chart.createIndicator('BOLL', false, { id: 'candle_pane' })

// With custom params
chart.createIndicator({ name: 'BOLL', calcParams: [20, 2] }, false, { id: 'candle_pane' })

// On new pane (e.g. RSI, MACD)
chart.createIndicator('RSI', false, { height: 100 })

// Remove
chart.removeIndicator(paneId, 'BOLL')
```

**WARNING**: When passing `calcParams` via object form, always include ALL required params. BOLL expects `[period, stdDevMultiplier]`. Passing `[20]` causes NaN because `params[1]` is undefined.

---

## Built-in Overlays (Drawing Tools)

These 15 overlays are registered by default:

| Name | Clicks | Description |
|------|--------|-------------|
| `segment` | 2 | Line between two points |
| `straightLine` | 2 | Infinite straight line |
| `rayLine` | 2 | Ray from point A through B to infinity |
| `horizontalStraightLine` | 1 | Horizontal line spanning full width |
| `horizontalRayLine` | 1 | Horizontal ray from click point rightward |
| `horizontalSegment` | 2 | Horizontal segment between two x positions |
| `verticalStraightLine` | 1 | Vertical line spanning full height |
| `verticalRayLine` | 1 | Vertical ray from click point downward |
| `verticalSegment` | 2 | Vertical segment between two y positions |
| `parallelStraightLine` | 3 | Two parallel lines (channel) |
| `priceChannelLine` | 3 | Price channel |
| `priceLine` | 1 | Horizontal price line with label |
| `fibonacciLine` | 2 | Fibonacci retracement levels |
| `simpleAnnotation` | 1 | Arrow + text annotation (needs `extendData`) |
| `simpleTag` | 1 | Horizontal dashed line + y-axis tag |

### Creating Overlays

```js
chart.createOverlay({
  name: 'segment',
  mode: 'weak_magnet',  // 'normal' | 'weak_magnet' | 'strong_magnet'
  styles: { line: { color: '#bb2719' } },
  extendData: 'some text',  // for simpleAnnotation
  onDrawEnd: (event) => {
    // event.overlay has id, name, points, styles
  }
})
```

### `simpleAnnotation` — Text

The annotation overlay reads its display text from `extendData`:
```js
chart.createOverlay({
  name: 'simpleAnnotation',
  extendData: 'Entry point here'
})
```

### `fibonacciLine` — Levels

Levels are hardcoded at `[1, 0.786, 0.618, 0.5, 0.382, 0.236, 0]`. Text styling uses the overlay `text` style:
```js
styles: {
  line: { color: '#bb2719' },
  text: { color: '#FFFFFF', backgroundColor: '#bb2719' }
}
```

---

## Built-in Figures (Canvas Primitives)

Figures are NOT overlays — they are low-level canvas drawing primitives used inside overlays and indicators.

| Figure | attrs | styles |
|--------|-------|--------|
| `rect` | `{ x, y, width, height }` | `{ style: fill\|stroke\|stroke_fill, color, borderColor, borderSize, borderRadius }` |
| `circle` | `{ x, y, r }` | `{ style: fill\|stroke\|stroke_fill, color, borderColor, borderSize }` |
| `polygon` | `{ coordinates: [{x,y}...] }` | `{ style: fill\|stroke\|stroke_fill, color, borderColor, borderSize }` |
| `arc` | `{ x, y, r, startAngle, endAngle }` | `{ style: solid\|dashed, color, size }` |
| `line` | `{ coordinates: [{x,y}...] }` | `{ style: solid\|dashed, color, size, dashedValue }` |
| `text` | `{ x, y, text, align, baseline, width, height }` | `{ style: fill\|stroke\|stroke_fill, color, size, family, weight, backgroundColor, borderColor, borderRadius, padding }` |

### Custom Overlays Using Figures

`rect`, `circle`, `polygon`, `arc` are figures only — they must be wrapped in `registerOverlay()` to become interactive drawing tools. See `src/lib/chart/customOverlays.js`.

Pattern:
```js
import { registerOverlay } from 'klinecharts'

registerOverlay({
  name: 'myRect',
  totalStep: 3,  // number of clicks + 1
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates, overlay, bounding, barSpace, precision, defaultStyles }) => {
    // Return figure(s) using coordinates
    return { type: 'rect', attrs: { x, y, width, height } }
  }
})
```

---

## Chart API Quick Reference

### Data
```js
chart.applyNewData(klineDataList, more?)   // Replace all data
chart.updateData(klineDataItem)             // Update last or add new bar
chart.getDataList()                         // Get all loaded data
chart.clearData()
```

KLineData format: `{ timestamp, open, high, low, close, volume?, turnover? }`

### Scrolling & Zoom
```js
chart.setZoomEnabled(false)
chart.setScrollEnabled(true)
chart.setBarSpace(10)                       // 1–50
chart.getBarSpace()
chart.scrollByDistance(px)
chart.scrollToRealTime()
chart.scrollToDataIndex(index)
chart.scrollToTimestamp(ts)
chart.resize()
```

### Subscriptions
```js
chart.subscribeAction('onZoom', callback)
chart.subscribeAction('onScroll', callback)
chart.subscribeAction('onVisibleRangeChange', callback)
chart.subscribeAction('onCrosshairChange', callback)
chart.subscribeAction('onCandleBarClick', callback)
chart.unsubscribeAction('onZoom', callback)
```

### Precision
```js
chart.setPriceVolumePrecision(pricePrecision, volumePrecision)
```

### Visible Range
```js
const range = chart.getVisibleRange()
// { from, to, realFrom, realTo } — data indices
```

---

## Project Integration

| File | Purpose |
|------|---------|
| `src/components/ChartDisplay.svelte` | Main chart component — init, data loading, resize, wheel scroll, BOLL indicator |
| `src/components/ChartToolbar.svelte` | Resolution/window buttons, drawing tool buttons, magnet toggle |
| `src/components/displays/ChartHeader.svelte` | Auto-hide header with symbol, status, controls |
| `src/lib/chart/chartConfig.js` | Resolution/window constants, barSpace calculation |
| `src/lib/chart/chartThemeLight.js` | Light theme styles (natural reds & greens) |
| `src/lib/chart/customOverlays.js` | Registers rectOverlay, circleOverlay, polygonOverlay, arcOverlay |
| `src/lib/chart/drawingStore.js` | IndexedDB persistence for drawings via Dexie.js |
| `src/lib/chart/drawingCommands.js` | Undo/redo command pattern for drawings |
| `src/stores/chartDataStore.js` | OHLC bar arrays per symbol:resolution, candle subscriptions |

### Theme Palette (Light)

| Element | Color | Hex |
|---------|-------|-----|
| Body up (green) | green | `#9dc384` |
| Body down (red) | red | `#de9d9b` |
| Border/wick up | dk green | `#48752c` |
| Border/wick down | dk red | `#bb2719` |
| Fibonacci lines | dk red | `#bb2719` |
| Fibonacci text | white | `#FFFFFF` |
| Levels/channels | dk green | `#48752c` |
| BOLL upper band | dk red | `#bb2719` |
| BOLL MA (mid) | black 2px | `#000000` |
| BOLL lower band | dk green | `#48752c` |

---

## Common Pitfalls

1. **BOLL NaN**: Passing `calcParams: [20]` (1 element) — BOLL needs `[period, stdDev]` (2 elements). Use just `'BOLL'` for defaults `[20, 2]`.

2. **rect/circle/polygon/arc not drawing**: These are figures, not overlays. Must register via `registerOverlay()` with `createPointFigures` that returns the figure.

3. **totalStep**: Number of clicks + 1. A 2-click tool = `totalStep: 3`. A 3-click tool = `totalStep: 4`.

4. **indicator.lines[] order**: Maps to figure index, not semantic meaning. Check the indicator's `figures` array for key→index mapping (e.g. BOLL: `up=0, mid=1, dn=2`).

5. **Overlay styles**: Set via `chart.createOverlay({ styles: {...} })` or globally in theme `overlay` section. Per-overlay styles override theme defaults.

6. **simpleAnnotation text**: Requires `extendData` property — no built-in text input prompt. Pass string directly or prompt user.

7. **Chart pane ID**: The default candle pane ID is `'candle_pane'`. Use this when placing indicators on the price pane.
