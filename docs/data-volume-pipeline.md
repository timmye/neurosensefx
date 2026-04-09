# Volume Data Pipeline

## Overview

cTrader provides tick volume via the `ProtoOATrendbar` protobuf message. This volume should flow from cTrader → backend → WebSocket → frontend store → klinechart → indicators (OBV, VOL, etc.). Currently it is **broken at three points**, resulting in all volume values being `0`.

## Proto Definition

```proto
// libs/cTrader-Layer/protobuf/OpenApiModelMessages.proto:515
message ProtoOATrendbar {
  required int64 volume = 3;  // Bar volume in ticks
  // ... other fields (low, deltaOpen, deltaHigh, deltaClose, utcTimestampInMinutes, period)
}
```

The `int64` field is deserialized by **protobufjs 5.0.1** as a `Long` object from the `long` npm package:

```js
Long { low: <number>, high: <number>, unsigned: false }
```

**Important:** protobufjs 5.x `Long` objects expose `.toNumber()` and `.toString()`. They do **NOT** have `.tick` or `.real` properties (those exist in protobufjs 6+/7+ wrappers).

## Data Flow Diagram

```
cTrader API
  │
  ├─ Historical: ProtoOAGetTrendbarsRes.trendbar[]
  │     │
  │     ▼
  │   CTraderDataProcessor.js:115-125   ← BUG #1: volume always 0
  │     │
  │     ▼
  │   DataRouter.js → WebSocket → Frontend
  │     │
  │     ▼
  │   chartDataStore.js → IndexedDB
  │     │
  │     ▼
  │   ChartDisplay.svelte:564-571  (applyNewData)
  │
  ├─ Live M1: ProtoOASpotEvent.trendbar[]
  │     │
  │     ▼
  │   CTraderEventHandler.js:19-43  ← BUG #2: volume dropped entirely
  │     │
  │     ▼
  │   DataRouter.js:113-128         ← BUG #3: volume hardcoded to 0
  │     │
  │     ▼
  │   WebSocket → Frontend → chart.updateData()
  │
  └─ Live non-M1: ProtoOASpotEvent.trendbar[] (with period field)
        │
        ▼
      CTraderEventHandler.js:53-72  (processMultiTimeframeTrendbarEntry)
        │                            ← BUG #4: Long object leaks through
        ▼
      DataRouter.js → WebSocket → Frontend
```

## Bugs

### Bug #1: Historical volume extraction uses wrong Long API

**File:** `services/tick-backend/CTraderDataProcessor.js:122`

```js
// CURRENT (broken) — written for protobufjs 6+/7+ API
volume: typeof bar.volume === 'object'
  ? (bar.volume.tick || bar.volume.real || 0)   // .tick and .real don't exist on Long
  : (bar.volume || 0)
```

`bar.volume` is a `Long` object. `typeof` is `'object'` so the first branch runs. `.tick` and `.real` are `undefined`, so it falls to `0`.

**Fix:**
```js
volume: bar.volume ? Number(bar.volume) : 0
```

### Bug #2: M1 trendbar processing drops volume

**File:** `services/tick-backend/CTraderEventHandler.js:24-32`

```js
// CURRENT (broken) — no volume field in returned object
const m1Bar = {
  symbol: symbolName,
  open: ...,
  high: ...,
  low: ...,
  close: ...,
  timestamp: ...
};
```

**Fix:** Add `volume: Number(tb.volume) || 0` to the m1Bar object.

### Bug #3: M1 candle routing hardcodes volume to 0

**File:** `services/tick-backend/DataRouter.js:128`

```js
// CURRENT (broken) — hardcoded
bar: {
  open: m1Bar.open,
  high: m1Bar.high,
  low: m1Bar.low,
  close: m1Bar.close,
  volume: 0,           // ← hardcoded
  timestamp: m1Bar.timestamp
}
```

**Fix:** Change to `volume: m1Bar.volume || 0`.

### Bug #4: Multi-timeframe live path leaks Long object

**File:** `services/tick-backend/CTraderEventHandler.js:69`

```js
// CURRENT (broken) — Long object is truthy, passes through || 0
volume: tb.volume || 0,   // tb.volume is Long {} → truthy → Long object returned
```

The `Long` object survives into the WebSocket message. `JSON.stringify` serializes it as `{"low":N,"high":N,"unsigned":false}` instead of a number. On the frontend, this arrives as a plain object, which when used in arithmetic (`oldObv += objectValue`) produces string concatenation and eventually `NaN`.

**Fix:** Change to `volume: Number(tb.volume) || 0`.

## Frontend Volume Handling

The frontend correctly passes volume through all paths:

| Path | Code | Location |
|------|------|----------|
| Initial load | `volume: bar.volume \|\| 0` | `ChartDisplay.svelte:570` |
| Incremental bar | `volume: bar.volume \|\| 0` | `ChartDisplay.svelte:591` |
| Per-tick rAF update | `volume: lastBar.volume \|\| 0` | `ChartDisplay.svelte:624` |
| IndexedDB store | `volume: bar.volume ?? 0` | `chartDataStore.js:91` |

**Note:** klinecharts `updateData()` does a **full object replacement** (not merge) when the timestamp matches the last bar. The per-tick path correctly includes all OHLCV fields to avoid data loss.

## klinecharts Indicator Volume Behavior

Indicators read `kLineData.volume` with nullish coalescing (`?? 0`):

```js
// OBV calc (klinecharts built-in)
oldObv -= ((_b = kLineData.volume) !== null && _b !== void 0 ? _b : 0);
```

| Volume value | Result |
|-------------|--------|
| `0` (number) | Treated as 0 — OBV stays flat |
| `undefined` | Falls back to 0 |
| `null` | Falls back to 0 |
| `NaN` | **NOT caught** — passes through, corrupts accumulator |
| Object `{low, high}` | **NOT caught** — arithmetic produces string → NaN |

## Impact on Indicators

| Indicator | Current Behavior | After Fix |
|-----------|-----------------|-----------|
| OBV | Flat zero line, MAOBV may show NaN | Cumulative tick volume line |
| VOL | Empty bars (volume = 0) | Colored volume bars with MA lines |
| A/D (custom) | Flat zero line | Accumulation/distribution curve |
| PVT (built-in) | Flat zero line | Price-volume trend |
