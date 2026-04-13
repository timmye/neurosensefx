# TradingView as Chart Data Source

**Date:** 2026-04-11
**Related:** `dual-source-architecture.md`, `chart-data-pipeline-spec.md`

## Motivation

Charts currently use cTrader as their sole data source. TradingView is used for tickers only (M1 + D1 candles for ADR and Market Profile). Using TradingView for charts would enable charting for symbols only available via TradingView (crypto, indices, cross-rates) and provide a fallback when cTrader is unavailable.

## Current State

### cTrader Chart Pipeline

```
Historical: CTraderDataProcessor.fetchHistoricalCandles(symbol, period)
            → ProtoOAGetTrendbarsReq → price conversion (rawValue / 100000)
            → chartDataStore.loadHistoricalBars() → IndexedDB cache (Dexie.js)
            → KLineChart.applyNewData()

Live:       CTraderSession spot events → M1 trendbar entries only (RC6)
            → Per-tick spot price via marketDataStore → rAF-batched → chart.updateData()
```

**Key limitation (RC6/RC12):** cTrader only delivers genuine live data for M1. All non-M1 timeframes rely on per-tick close updates — there are no real M5/H1/H4 bar completions from cTrader.

### TradingView Ticker Pipeline

```
Historical: TradingViewSession → WebSocket connect → D1 (14-day) + M1 (1500 bar) candles
Live:       TradingViewSession → real-time M1 candle updates
            → TradingViewCandleHandler → TradingViewDataPackageBuilder
            → DataRouter → WebSocket broadcast → marketDataStore
```

**Key capability:** TradingView delivers genuine M1 candle completions with correct OHLC, not just spot prices.

## Comparison

| Concern | cTrader | TradingView |
|---------|---------|-------------|
| Historical timeframes | M1–MN1 (all periods) | D1, M1 only (extensible to M5/M15/H1/H4) |
| Historical depth | Unlimited (API-limited per request, chunked) | ~14 days D1, 5000 bars M1 (server supports pagination beyond) |
| Live bar completions | M1 only (RC6) | M1 only (same as current) |
| Tick data | Yes (spot events) | No |
| Symbol coverage | cTrader broker symbols | Any TradingView symbol (crypto, indices, expressions) |
| Connection | Protobuf (OpenAPI) | JSON WebSocket |
| Price precision | Raw integer → float conversion | Native float |
| Authentication | cTrader credentials | None (public WebSocket) |

### TradingView Historical Depth Details

The current 1500 M1 bar cap is **self-imposed** (to keep Market Profile / Day Range Meter lean), not a TradingView server limitation.

- The `tradingview-ws` library this project uses has `MAX_BATCH_SIZE = 5000` (found experimentally)
- TradingView supports pagination via `request_more_data` to fetch beyond a single batch
- Per library docs, ~13,000 candles achievable for hourly timeframes
- Current caps in `TradingViewSubscriptionManager.js` (request) and `TradingViewCandleHandler.js` (hard cap) can be raised for chart use

**Time-window coverage at 5000 bars:**

| Timeframe | 5000 bars ≈ | Default window | 2x window | Notes |
|-----------|-------------|----------------|-----------|-------|
| M1 | ~3.5 days | 1d (covered) | 2d (covered) | Covers all intraday windows |
| M5 | ~17 days | 2d (covered) | 1W (covered) | Adequate for typical views |
| M15 | ~52 days | 2d (covered) | 2W (covered) | Ample |
| H1 | ~208 days | 2W (covered) | 3M (covered) | Near 6M with pagination |
| H4 | ~833 days | 3M (covered) | 6M (covered) | Near 2Y with pagination |

**Critical insight:** Neither source provides genuine live completions for non-M1 timeframes. Both rely on M1 data for higher-period bars. This means TradingView is not meaningfully worse for live charting — the per-tick close pattern is already the status quo for non-M1 charts.

## What Already Works

TradingView M1 candles are already fetched and processed:

- `TradingViewSession.js` — manages D1 and M1 sessions
- `TradingViewCandleHandler.js` — processes candle events into OHLCV
- `TradingViewDataPackageBuilder.js` — builds `symbolDataPackage` with `initialMarketProfile` (M1 bars)
- `MarketProfileService.js` — consumes M1 candles for TPO calculation

The M1 candle data is in the correct format for KLineChart: `{ timestamp, open, high, low, close, volume }`.

## Gaps

### 1. Multi-timeframe Historical Data

TradingView currently subscribes to D1 and M1 only. Charts need M5, M15, H1, H4, H1.

**Options:**
- **(a) Subscribe to additional timeframes on TradingView.** TradingView WebSocket supports `1`, `5`, `15`, `30`, `60`, `240`, `D` resolutions. Would need additional sessions or a resolution parameter in the existing session.
- **(b) Aggregate M1 on the backend.** Already have M1 bars (currently capped at 1500 for Market Profile, but the TradingView server supports 5000+ with pagination). Can aggregate into M5, M15, etc. server-side. Simpler, no additional subscriptions, but limited lookback (~3.5 days for M5 from 5000 M1 bars, ~10.4 days for M15).
- **(c) Aggregate M1 on the frontend.** `chartDataStore.js` could accept M1 data and aggregate into higher timeframes. Keeps backend simple but duplicates aggregation logic.

**Recommendation:** Option (a) for accuracy. TradingView natively supports the needed resolutions, and native bars have correct OHLC (not aggregated from M1 closes).

### 2. Data Routing to Chart Store

Currently TradingView data flows to `marketDataStore.js` only. Charts read from `chartDataStore.js`.

**Required changes:**
- `DataRouter.js` — emit chart-specific messages when TradingView is the chart source
- `chartDataStore.js` — accept data from TradingView in addition to cTrader
- Source tag on candle subscriptions so the backend knows which pipeline to use

### 3. Source Selection

No mechanism exists to choose between cTrader and TradingView for chart data.

**Design options:**
- **Per-symbol:** Workspace config specifies source per ticker. Symbol available on cTrader → cTrader; TradingView-only → TradingView.
- **Global fallback:** Use cTrader when available, fall back to TradingView on connection failure.
- **Explicit toggle:** User selects source per display or globally.

**Recommendation:** Per-symbol with automatic fallback. This matches the existing dual-source pattern in `dual-source-architecture.md` where routing is keyed by `symbol:source`.

### 4. Cache Integration

`chartDataStore.js` caches historical bars in IndexedDB via Dexie.js. TradingView-sourced bars need to go through the same cache with a source tag to avoid collisions.

### 5. Live Updates for Non-M1

Same RC6 limitation applies — TradingView only delivers M1 completions. The per-tick close pattern from `marketDataStore` already handles this for cTrader charts. TradingView charts would use the same approach: M1 candle completions + spot price for close updates.

## Implementation Scope

### Phase 1: M1 Charts from TradingView (minimal)

Bridge existing M1 data to `chartDataStore.js` for symbols that only have TradingView as a source.

**Files:**
- `services/tick-backend/DataRouter.js` — route TradingView M1 candles as `candleUpdate` messages
- `src/stores/chartDataStore.js` — accept `candleUpdate` from TradingView source
- `src/lib/connection/subscriptionManager.js` — emit chart candle subscriptions with source tag

### Phase 2: Multi-timeframe Support

Add TradingView subscriptions for M5, M15, H1, H4.

**Files:**
- `services/tick-backend/TradingViewSession.js` — support additional resolution sessions
- `services/tick-backend/TradingViewCandleHandler.js` — process multi-timeframe candles
- `services/tick-backend/TradingViewDataPackageBuilder.js` — include historical bars for all timeframes
- `services/tick-backend/RequestCoordinator.js` — request TradingView historical bars for chart timeframes

### Phase 3: Source Selection UI

Per-symbol source selection with automatic fallback.

**Files:**
- Workspace config schema — add `chartSource` field per ticker
- `src/stores/chartDataStore.js` — source-aware bar loading
- `src/components/ChartDisplay.svelte` — display source indicator

## Risks

| Risk | Mitigation |
|------|------------|
| TradingView rate limiting on additional timeframe subscriptions | Test subscription limits; batch subscriptions; cache aggressively |
| Historical depth insufficient for higher timeframes | TradingView supports 5000 bars per batch with pagination — covers all default + 2x windows for M15+ |
| Timestamp alignment differences (TradingView seconds vs cTrader minutes) | Normalize to milliseconds at the handler layer |
| Source-agnostic derived data (TWAP, Market Profile) double-counting | Already documented in `dual-source-architecture.md` — apply source-agnostic pattern |
| TradingView WebSocket disconnection during active chart | Existing reconnection logic in `TradingViewSession.js`; chart shows stale data with staleness indicator |

## Files

| File | Role |
|------|------|
| `services/tick-backend/TradingViewSession.js` | TV WebSocket session management |
| `services/tick-backend/TradingViewCandleHandler.js` | TV candle processing |
| `services/tick-backend/TradingViewDataPackageBuilder.js` | TV data package construction |
| `services/tick-backend/DataRouter.js` | Message routing (needs chart routing) |
| `services/tick-backend/RequestCoordinator.js` | Request dispatch to TV vs cTrader |
| `services/tick-backend/CTraderDataProcessor.js` | cTrader data processing (reference) |
| `src/stores/chartDataStore.js` | Chart bar storage and caching |
| `src/stores/marketDataStore.js` | Current TV data destination |
| `src/lib/connection/subscriptionManager.js` | Frontend subscription dispatch |
| `src/components/ChartDisplay.svelte` | Chart rendering |
| `src/lib/chart/chartConfig.js` | Timeframe and window configuration |
