# Data Pipeline Audit: Price Data Flow & Accuracy

> Date: 2026-03-31
> Trigger: Mini market profile scaling/bounds not auto-updating (fixed in `f01c519`)
> Scope: Repo-wide investigation of high/low, ADR, and price data accuracy across all sources and displays

---

## Architecture Overview

Two independent backend data pipelines (cTrader, TradingView) feed a single frontend Svelte store via WebSocket. A third service layer (MarketProfile, TWAP) consumes M1 bar data to generate derived data products.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BACKEND SERVICES                            │
│                                                                     │
│  cTrader Open API              TradingView WebSocket API            │
│       │                               │                             │
│       ▼                               ▼                             │
│  CTraderDataProcessor        TradingViewCandleHandler               │
│  (protobuf → price)          (array → OHLC)                         │
│       │                               │                             │
│       ▼                               ▼                             │
│  CTraderEventHandler         TradingViewDataPackageBuilder          │
│  (spot events → tick)        (D1+M1 → package)                      │
│       │                               │                             │
│       ├──────────────┬────────────────┘                             │
│       ▼              ▼                                               │
│  RequestCoordinator   DataRouter                                     │
│  (cTrader path)       (TradingView path)                             │
│       │              │                                               │
│       ▼              ▼                                               │
│  MessageBuilder (routes & formats)                                   │
│       │                                                             │
│       ▼                                                             │
│  WebSocketServer → WebSocket → Frontend                             │
│                                                                     │
│  ┌──────────────────────────────────┐                               │
│  │ Derived Services (consume M1):   │                               │
│  │  MarketProfileService → profile  │                               │
│  │  TwapService → twap              │                               │
│  └──────────────────────────────────┘                               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                     │
│                                                                     │
│  WebSocket → marketDataStore (Svelte writable)                      │
│       │                                                             │
│       ├── PriceTicker.svelte (mini market profile, stats)            │
│       ├── FloatingDisplay.svelte → DisplayCanvas.svelte              │
│       │       └── dayRangeOrchestrator.js (day range display)        │
│       │       └── marketProfile/orchestrator.js (full profile)       │
│       └── FxBasketDisplay.svelte (independent data path)             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Message Types & Data Flow

### 1. `symbolDataPackage` — Initial subscription data

Sent once per symbol when a client subscribes. Contains the day's starting state.

**cTrader path** (bypasses DataRouter, sent directly via `RequestCoordinator.sendDataToClients()`):

```
CTraderDataProcessor.getSymbolDataPackage()
  → RequestCoordinator.sendDataToClients()
  → WebSocketServer.sendToClient()
```

| Field | Value | Source |
|-------|-------|--------|
| `todaysOpen` | First M1 bar open, or D1 bar open | `CTraderDataProcessor.js:80,66` |
| `todaysHigh` | `Math.max(...M1 bars)` or D1 bar high | `CTraderDataProcessor.js:81,67` |
| `todaysLow` | `Math.min(...M1 bars)` or D1 bar low | `CTraderDataProcessor.js:82,68` |
| `projectedAdrHigh` | `todaysOpen + (adr / 2)` | `CTraderDataProcessor.js:132` |
| `projectedAdrLow` | `todaysOpen - (adr / 2)` | `CTraderDataProcessor.js:133` |
| `initialPrice` | Last M1 bar close, or D1 bar close | `CTraderDataProcessor.js:83,69` |
| `prevDayOpen/High/Low/Close` | Previous D1 bar OHLC (raw integers) | `CTraderDataProcessor.js:115-120,139-142` |
| `initialMarketProfile` | Today's M1 bars (not sent to client) | `CTraderDataProcessor.js:84` |

**TradingView path** (routed through `DataRouter.routeFromTradingView()` → `buildTradingViewMessage()`):

```
TradingViewCandleHandler → TradingViewDataPackageBuilder.buildDataPackage()
  → DataRouter.routeFromTradingView() → buildTradingViewMessage()
  → broadcastToClients()
```

| Field | Value | Source |
|-------|-------|--------|
| `open` | First today's M1 open, or last D1 close | `TradingViewDataPackageBuilder.js:66` |
| `high` | `Math.max(...today's M1)` or D1 high | `TradingViewDataPackageBuilder.js:67` |
| `low` | `Math.min(...today's M1)` or D1 low | `TradingViewDataPackageBuilder.js:68` |
| `current` | Last D1 candle close | `TradingViewDataPackageBuilder.js:69` |
| `projectedAdrHigh` | `todaysOpen + (adr / 2)` | `TradingViewDataPackageBuilder.js:73` |
| `projectedAdrLow` | `todaysOpen - (adr / 2)` | `TradingViewDataPackageBuilder.js:74` |
| `prevDayOpen/High/Low/Close` | Previous D1 candle OHLC | `TradingViewDataPackageBuilder.js:77-80` |
| `initialMarketProfile` | Today's M1 candles (passes through MessageBuilder) | `TradingViewDataPackageBuilder.js:75` |

### 2. `tick` — Real-time price updates

Sent on every spot event (cTrader) or candle update (TradingView).

**cTrader path**:
```
CTraderEventHandler.processSpotEvent()
  → DataRouter.routeFromCTrader() → buildCTraderMessage()
  → broadcastToClients()
```

Fields: `symbol`, `bid`, `ask`, `timestamp`, `pipPosition`, `pipSize`, `pipetteSize`
**No high/low, no adrHigh/adrLow, no open.**

**TradingView path**:
```
TradingViewCandleHandler.onCandleUpdate()
  → DataRouter.routeFromTradingView() → buildTradingViewMessage()
  → broadcastToClients()
```

Fields: `symbol`, `price`/`current`, `timestamp`, `pipPosition`, `pipSize`
`open`/`high`/`low` included only if present on the candle object (conditionally via `includeField`).
`projectedAdrHigh`/`projectedAdrLow` included only if present on the candle object.

### 3. `profileUpdate` — Market profile data

Generated by `MarketProfileService` when M1 bars complete. Contains either a full profile or delta update.

```
MarketProfileService.onM1Bar() → generatePriceLevels()
  → DataRouter.routeProfileUpdate()
  → broadcastToClients()
```

Fields: `type`, `symbol`, `source`, `seq`, and either:
- `profile: { levels: Array<{price, tpo}>, bucketSize }` (full replacement)
- `delta: { added: Array, updated: Array }` (incremental)

**No high/low, no adrHigh/adrLow, no price.** The frontend extracts profile bounds from the levels array.

### 4. `twapUpdate` — TWAP calculations

Generated by `TwapService` from M1 bar close prices.

```
TwapService.onM1Bar() → DataRouter.routeTwapUpdate() → broadcastToClients()
```

### 5. `dailyReset` — Day boundary reset

Broadcast at UTC midnight. Triggers store cleanup on frontend.

```
WebSocketServer.performDailyReset() → broadcastToClients({ type: 'dailyReset' })
```

---

## Frontend Store Normalization

All incoming messages pass through `marketDataStore.js` → `normalizeData()` or the `profileUpdate` handler.

### Field Name Mapping (symbolDataPackage)

The backend uses **two different naming conventions** depending on source. The store normalizes to canonical frontend names:

| Canonical (store) | cTrader sends | TradingView sends | Fallback chain in store |
|---|---|---|---|
| `current` | *(none)* | `current` | `data.current ?? data.price ?? data.bid ?? data.ask ?? null` |
| `high` | `todaysHigh` | `high` | `data.high ?? data.todaysHigh ?? null` |
| `low` | `todaysLow` | `low` | `data.low ?? data.todaysLow ?? null` |
| `open` | `todaysOpen` | `open` | `data.open ?? data.todaysOpen ?? null` |
| `adrHigh` | *(none)* | *(none)* | `data.adrHigh ?? data.projectedAdrHigh ?? null` |
| `adrLow` | *(none)* | *(none)* | `data.adrLow ?? data.projectedAdrLow ?? null` |

**Key observation**: No backend path ever sends the canonical names `adrHigh`/`adrLow`. The frontend always hits the `projectedAdrHigh`/`projectedAdrLow` fallback.

### Per-Message-Type Store Updates

| Store field | `symbolDataPackage` | `tick` | `profileUpdate` |
|---|---|---|---|
| `current` | Set from `current/price/bid/ask` | Set from `price/bid/ask` | Not updated |
| `high` | Set from `high/todaysHigh` | `Math.max(current, newPrice)` | `Math.max(current, profileHigh)` |
| `low` | Set from `low/todaysLow` | `Math.min(current, newPrice)` | `Math.min(current, profileLow)` |
| `open` | Set from `open/todaysOpen` | Not updated | Not updated |
| `adrHigh` | Set from `adrHigh/projectedAdrHigh` | Not updated | Not updated |
| `adrLow` | Set from `adrLow/projectedAdrLow` | Not updated | Not updated |
| `marketProfile` | Not updated | Not updated | Full replacement or delta merge |
| `prevDayOHLC` | **Not extracted** (see C1) | Not applicable | Not applicable |

---

## Frontend Consumers

### Price Display Components

| Component | Fields consumed | Null safety | Update mechanism |
|---|---|---|---|
| `PriceTicker.svelte` | `current`, `high`, `low`, `open`, `adrHigh`, `adrLow`, `marketProfile` | Template `{#if}` guards, `?? null` bindings | Reactive `$:` from `$marketData` |
| `FloatingDisplay.svelte` | All fields (passed through as `data` prop) | Delegated to DisplayCanvas | Reactive `$:` from `$marketData` |
| `DisplayCanvas.svelte` | All fields (passed to renderers) | Delegated to renderers | Reactive `$:` on `data` and `marketProfileData` props |

### Scaling & Bounds Calculations

| Function | File:Line | Inputs | Null guard | Risk |
|---|---|---|---|---|
| `calculateAdaptiveScale()` | `dayRangeCalculations.js:57` | `d.adrHigh`, `d.adrLow`, `d.current`, `d.open`, `d.high`, `d.low` | **None** on adrHigh/adrLow | NaN if null (mitigated by `validateMarketData` gate) |
| `calculateAdaptiveScale()` | `marketProfile/scaling.js:9` | `profile[]`, `marketData.adrHigh/adrLow/current` | Truthy check + profile fallback | Safe |
| `createPriceScale()` | `dayRangeRenderingUtils.js:28` | `adaptiveScale.min`, `adaptiveScale.max` | **None** (division by `max-min`) | Infinity if min===max |
| `renderMiniMarketProfile()` | `marketProfile/orchestrator.js:59` | `highPrice`, `lowPrice`, `profile[]` | `!= null` check + profile fallback | Safe |
| `calculateDayRangePercentage()` | `dayRangeCalculations.js:5` | `d.high`, `d.low`, `d.adrHigh`, `d.adrLow` | Full `typeof` checks | Safe |
| `validateMarketData()` | `dayRangeRenderingUtils.js:6` | `d.current`, `d.adrLow`, `d.adrHigh` | Gates entire render | Safe (primary defense) |
| `toPrice()` | `priceMarkerCoordinates.js:7` | `data.adrHigh`, `data.adrLow`, `data.current` | Truthy check + fallbacks | Safe |

### Unprotected Call Sites for `calculateAdaptiveScale()`

These call `calculateAdaptiveScale()` directly without the `validateMarketData()` gate:

1. **`displayCanvasRenderer.js:150`** — `renderPriceDelta()` (right-click drag interaction)
2. **`priceMarkerInteraction.js:148`** — `handleContextMenu()` (Alt+right-click)

Both construct `scaleData` from `data?.adrHigh`/`data?.adrLow` and pass directly. If either is null, the entire scale becomes NaN. Practically low risk since these interactions only fire on an already-rendered display.

---

## Known Issues

### CRITICAL

**C1: `prevDayOHLC` never assembled — previous day OHLC markers never render** ~~RESOLVED~~

Backend sends `prevDayOpen`, `prevDayHigh`, `prevDayLow`, `prevDayClose` as separate flat fields. The renderer at `dayRangeOrchestrator.js:72` expects `d.prevDayOHLC` (a nested `{open, high, low, close}` object). The store's `normalizeData()` at `marketDataStore.js:61-77` never assembles these fields.

- Backend sends: `prevDayOpen: 1.08, prevDayHigh: 1.09, prevDayLow: 1.07, prevDayClose: 1.085`
- Store produces: `{ ... }` (no `prevDayOHLC` property)
- Renderer reads: `d.prevDayOHLC` → `undefined` → `renderPreviousDayOHLC()` returns early

Both pipelines (cTrader `RequestCoordinator.js:176-179` and TradingView `TradingViewDataPackageBuilder.js:77-80`) send the raw fields. The data contract at `dataContracts.js:181` defines `prevDayOHLC` as a nested object, but no code ever constructs it.

**Fix**: Added `prevDayOHLC` assembly in `normalizeData()` with null guard (all 4 fields required). Added `prevDayOHLC: null` to `createInitialData()`. See `marketDataStore.js`.

**C2: `current` is null after cTrader `symbolDataPackage`** ~~RESOLVED~~

`RequestCoordinator.sendDataToClients()` sends `initialPrice` but the store looks for `current ?? price ?? bid ?? ask` (`marketDataStore.js:62`). Since cTrader's symbolDataPackage contains none of these, `current` is null until the first tick arrives. The display shows "Waiting for market data..." in the interim.

TradingView path is unaffected (sends `current` at `TradingViewDataPackageBuilder.js:69`).

**Fix**: Added `data.initialPrice` to the `current` fallback chain: `data.current ?? data.price ?? data.initialPrice ?? data.bid ?? data.ask ?? null`. See `marketDataStore.js`.

### HIGH

**H1: Backend never sends canonical field names — contract is fiction** ~~RESOLVED~~

No backend code path ever produces `adrHigh`, `adrLow`, `high`, `low`, or `open` (canonical names) for the cTrader source. The `dataContracts.js` JSDoc documents these as primary fields but the frontend always resolves them via legacy fallbacks:

```
adrHigh  ← always resolves from projectedAdrHigh
adrLow   ← always resolves from projectedAdrLow
high     ← always resolves from todaysHigh (cTrader) or high (TradingView)
low      ← always resolves from todaysLow (cTrader) or low (TradingView)
open     ← always resolves from todaysOpen (cTrader) or open (TradingView)
```

The store logs a DEV warning when legacy names are used (`marketDataStore.js:46,49,54,58`).

**Fix**: Documented fallback chain as intentional design with block comment at top of `normalizeData()`. Removed DEV warnings for `projectedAdrHigh`/`projectedAdrLow` (these are expected field names, not legacy deviations). See `marketDataStore.js`.

**H2: Daily reset skips TradingView data re-fetch** ~~KNOWN BEHAVIOR — ACCEPTED~~

`WebSocketServer.js:183-184` logs "skipping re-fetch" for TradingView subscriptions. After a daily reset:
- `high`/`low` self-correct via frontend running high/low from ticks
- `open` remains from previous day (never re-sent)
- `adrHigh`/`adrLow` remain from previous day's ADR calculation (never re-sent)
- Fresh values only arrive on full resubscription

**Resolution**: Accepted as known behavior. Frontend running high/low from ticks self-corrects. ADR is a daily projection (not recalculated intraday). Fresh values arrive on resubscription.

**H3: `calculateAdaptiveScale()` has no internal null guard on `adrHigh`/`adrLow`** ~~RESOLVED~~

`dayRangeCalculations.js:59`: `d.adrHigh - d.adrLow` produces NaN if either is null, corrupting the entire scale (min, max, range all NaN). The main render pipeline is protected by `validateMarketData()`, but two interaction handlers bypass it (see unprotected call sites above).

**Fix**: Added null guard at top of `calculateAdaptiveScale()`. Returns a default scale using `pipSize * 10000` when either `adrHigh` or `adrLow` is null. See `dayRangeCalculations.js`.

### MEDIUM

**M1: `percentageMarkerRenderer.js:48` — `d.adrHigh - d.adrLow` with no null guard** ~~RESOLVED~~

Same NaN propagation as H3 but in the percentage marker renderer. Inside the main render pipeline so partially mitigated by `validateMarketData()`.

**Fix**: Replaced `d.adrHigh - d.adrLow` with guarded expression: `d.adrHigh && d.adrLow ? d.adrHigh - d.adrLow : 0`. Also added epsilon guard to priceScale lambda. See `percentageMarkerRenderer.js`.

**M2: `createPriceScale()` has no zero-division guard** ~~RESOLVED~~

`dayRangeRenderingUtils.js:31`: divides by `(max - min)`. If `max === min` (identical prices), produces Infinity for all Y coordinates. Canvas operations with Infinity are silently ignored (no crash, but invisible rendering).

**Fix**: Replaced `max - min` divisor with `Math.max(max - min, 1e-10)`. See `dayRangeRenderingUtils.js`.

**M3: Runtime validation only checks message `type`, not field contents** ~~RESOLVED~~

`dataContracts.js:206-228` validates that data is an object and `type` is a known string. It does not validate field presence, numeric types, or value ranges. A `symbolDataPackage` with missing `high`/`low`/`adrHigh`/`adrLow` passes validation silently. Validation only runs in DEV mode.

**Fix**: Added field-presence warnings for `symbolDataPackage` messages (high, low, open, adrHigh, adrLow, price fields). Returns `warnings` array alongside `errors`. See `dataContracts.js`.

**M4: Hardcoded fallback range 0.5-1.5 in `priceMarkerCoordinates.js:37-40`** ~~RESOLVED~~

When no data is available for Y-to-price conversion (mouse coordinate to price), falls back to range 0.5-1.5. Correct for EURUSD but wildly wrong for BTCUSD (~70000) or US30 (~40000).

**Fix**: Replaced hardcoded 0.5-1.5 with pipSize-derived range: `pipSize * 10000`, centered on `data.current ?? 0`. See `priceMarkerCoordinates.js`.

### LOW

**L1: Dead code** — `calculateMaxAdrPercentage()` at `dayRangeCalculations.js:16-43` never called
**L2: Dead code** — `createMarkerState()` at `percentageMarkerRenderer.js:138-145` never called
**L3: `schemaVersion`** documented in `dataContracts.js:162` but never populated in `createInitialData()`
**L4: `drawBoundaries()`** at `dayRangeElements.js:29-30` has no null guard on ADR fields (dead code, not in active render path)

---

## Data Accuracy Summary by Field

| Field | Source | Accuracy | Notes |
|---|---|---|---|
| `current` | tick `bid`/`ask` | Accurate | Real-time, updates every tick |
| `high` | Initial package + running max from ticks + profile max | Accurate (after fix) | Was frozen before `f01c519` |
| `low` | Initial package + running min from ticks + profile min | Accurate (after fix) | Was frozen before `f01c519` |
| `open` | Initial package only | Stale after daily reset (TradingView) | Never re-sent after midnight |
| `adrHigh` | Initial package only | Stale after daily reset (TradingView) | ADR is a daily projection, intentional to not update intraday |
| `adrLow` | Initial package only | Stale after daily reset (TradingView) | Same as adrHigh |
| `marketProfile` | profileUpdate messages | Accurate | Built from M1 bar OHLC via MarketProfileService |
| `prevDayOHLC` | Initial package (flat fields) | **Never assembled** | Backend sends raw fields, store drops them (C1) |

---

## ADR Calculation Details

**cTrader** (`CTraderDataProcessor.js:49-56`):
- Source: `deltaHigh` field from D1 bars (protobuf spec: `deltaHigh = high - low`)
- Lookback: 14 previous daily bars (excludes today)
- Formula: `average(deltaHigh values)` converted via `calculatePrice(rawValue / 100000, digits)`

**TradingView** (`TradingViewCandleHandler.js:125-135`):
- Source: `c.high - c.low` from D1 candle objects
- Lookback: 14 previous daily candles (excludes today)
- Formula: `average(high - low values)`

Both compute the same value (average daily range over 14 days). ADR is a **daily projection** — it is not recalculated intraday. The projected boundaries are:

```
projectedAdrHigh = todaysOpen + (adr / 2)
projectedAdrLow  = todaysOpen - (adr / 2)
```

---

## Backend File Reference

| File | Role |
|---|---|
| `services/tick-backend/CTraderDataProcessor.js` | cTrader protobuf → price conversion, ADR, OHLC extraction |
| `services/tick-backend/CTraderEventHandler.js` | cTrader spot/trendbar events → tick objects |
| `services/tick-backend/TradingViewCandleHandler.js` | TradingView candle data → OHLC, M1 bar management |
| `services/tick-backend/TradingViewDataPackageBuilder.js` | TradingView D1+M1 → symbolDataPackage |
| `services/tick-backend/RequestCoordinator.js` | cTrader subscription management, data package delivery |
| `services/tick-backend/DataRouter.js` | Routes all message types from backend services to WebSocket clients |
| `services/tick-backend/utils/MessageBuilder.js` | Consistent message construction, field inclusion, backend field stripping |
| `services/tick-backend/WebSocketServer.js` | WebSocket server, client management, daily reset |
| `services/tick-backend/MarketProfileService.js` | M1 bars → TPO price levels (market profile) |
| `services/tick-backend/TwapService.js` | M1 bar closes → TWAP calculation |

## Frontend File Reference

| File | Role |
|---|---|
| `src/stores/marketDataStore.js` | Central Svelte store: WebSocket message normalization, subscription management |
| `src/lib/dataContracts.js` | JSDoc type definitions, DEV-only runtime validation |
| `src/lib/dayRangeCalculations.js` | ADR-based adaptive scale, day range percentage |
| `src/lib/dayRangeOrchestrator.js` | Day range render orchestration, structural elements |
| `src/lib/dayRangeRenderingUtils.js` | `validateMarketData()`, `createPriceScale()`, `createMappedData()` |
| `src/lib/dayRangeCore.js` | Core day range rendering (grid, labels, ADR boundaries) |
| `src/lib/dayRangeElements.js` | Day range structural elements (dead code) |
| `src/lib/displayCanvasRenderer.js` | Canvas render dispatch, price markers, price delta overlay |
| `src/lib/priceMarkerCoordinates.js` | Y-coordinate ↔ price conversion |
| `src/lib/priceMarkerInteraction.js` | Mouse interaction (context menu, coordinate mapping) |
| `src/lib/priceMarkerRenderer.js` | High/low price marker rendering |
| `src/lib/percentageMarkerRenderer.js` | ADR percentage marker rendering |
| `src/lib/adrBoundaryCalculations.js` | ADR boundary price calculations |
| `src/lib/marketProfile/orchestrator.js` | Market profile render (full + mini), TPO bars |
| `src/lib/marketProfile/scaling.js` | Market profile adaptive scale (ADR-aware with profile fallback) |
| `src/lib/fxBasket/fxBasketOrchestrator.js` | FX basket display (independent data path) |
| `src/components/PriceTicker.svelte` | Price stats + mini market profile canvas |
| `src/components/FloatingDisplay.svelte` | Floating display container, passes data to DisplayCanvas |
| `src/components/displays/DisplayCanvas.svelte` | Canvas element, reactive render dispatch |
| `src/components/FxBasketDisplay.svelte` | FX basket display (independent subscription) |
| `src/components/BackgroundShader.svelte` | Volatility-driven background (uses volatilityStore, not price data) |
