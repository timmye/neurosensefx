# TradingView Chart Data Source Integration

**Date:** 2026-04-13
**Status:** Research complete, implementation pending
**Related:** `tradingview-chart-data-source.md`, `dual-source-architecture.md`, `chart-data-pipeline-spec.md`

## Objective

Enable TradingView as a chart data source alongside cTrader, with per-symbol source selection. This unlocks charting for symbols only available via TradingView (crypto, indices, cross-rates, math expressions like `DE02Y/US02Y`).

---

## Current Architecture

### Data Flow (cTrader only for charts)

```
Historical: CTraderDataProcessor.fetchHistoricalCandles(symbol, period)
            → ProtoOAGetTrendbarsReq → price conversion (rawValue / 100000)
            → chartDataStore.loadHistoricalBars() → IndexedDB cache (Dexie.js)
            → KLineChart.applyNewData()

Live:       CTraderSession spot events → M1 trendbar entries only (RC6)
            → Per-tick spot price via marketDataStore → rAF-batched → chart.updateData()
```

### What TradingView Already Provides (tickers only)

```
Historical: TradingViewSession → WebSocket connect → D1 (14-day) + M1 (1500 bar) candles
Live:       TradingViewSession → real-time M1 candle updates
            → TradingViewCandleHandler → TradingViewDataPackageBuilder
            → DataRouter → WebSocket broadcast → marketDataStore (NOT chartDataStore)
```

> **Note:** The 1500 M1 bar cap is self-imposed for lean Market Profile / Day Range Meter operation. TradingView's server supports 5000 bars per batch with pagination via `request_more_data` (the `tradingview-ws` library sets `MAX_BATCH_SIZE = 5000`). For chart use, both `TradingViewSubscriptionManager.js` (request amount) and `TradingViewCandleHandler.js` (hard cap) can be raised.

### Source Comparison

| Concern | cTrader | TradingView |
|---------|---------|-------------|
| Historical timeframes | M1-MN1 (all periods) | D1, M1 only (extensible to M5/M15/H1/H4) |
| Historical depth | Unlimited (chunked API) | ~14 days D1, 5000 bars M1 (server supports pagination beyond) |
| Live bar completions | M1 only (RC6/RC12) | M1 only |
| Tick data | Yes (spot events) | No |
| Symbol coverage | cTrader broker symbols only | Any TradingView symbol |
| Math expressions | No | Yes (`DE02Y/US02Y`, `1/XAUUSD`, etc.) |
| Price precision | Raw integer → float conversion | Native float |
| Authentication | cTrader credentials required | None (public WebSocket) |

**Critical insight:** Neither source provides genuine non-M1 live completions. Both rely on M1 data + per-tick spot prices for higher timeframes. TradingView is not meaningfully worse for live charting — the per-tick close pattern is already the status quo.

---

## Existing Infrastructure

### Backend (fully functional for D1+M1)

| File | Role | Status |
|------|------|--------|
| `services/tick-backend/TradingViewSession.js` | WebSocket session management, reconnection | Working (D1+M1 sessions) |
| `services/tick-backend/TradingViewCandleHandler.js` | Candle event processing into OHLCV | Working (D1+M1) |
| `services/tick-backend/TradingViewDataPackageBuilder.js` | Builds `symbolDataPackage` with initialMarketProfile | Working |
| `services/tick-backend/TradingViewSubscriptionManager.js` | Symbol subscription management | Working |
| `services/tick-backend/RequestCoordinator.js` | Request coalescing, retry, TV/cTrader branching | Working |

### Frontend

| File | Role | Status |
|------|------|--------|
| `src/stores/marketDataStore.js` | Receives TradingView tickers (M1+D1 candles) | Working |
| `src/stores/chartDataStore.js` | OHLC bars, IndexedDB cache, candle subscriptions | cTrader-only |
| `src/components/ChartDisplay.svelte` | KLineChart rendering, real-time updates | cTrader-only |
| `src/components/ChartToolbar.svelte` | Resolution/window buttons | Source-agnostic UI |
| `src/lib/connection/subscriptionManager.js` | Frontend subscription dispatch by `symbol:source` | Working |

### Dual-Source Pattern (already established)

Subscriptions keyed by `symbol:source`. Routing layer is source-aware; computation layer (TWAP, Market Profile) is source-agnostic. See `dual-source-architecture.md`.

---

## Gaps Analysis

### Gap 1: Multi-timeframe TradingView Subscriptions

TradingView currently subscribes to D1 and M1 only. Charts need M5, M15, H1, H4.

**Options:**
- **(a) Native TradingView subscriptions** — TV WebSocket supports `1`, `5`, `15`, `30`, `60`, `240`, `D`. Needs additional sessions or resolution parameter.
- **(b) Backend M1 aggregation** — Aggregate M1 bars into higher TFs. With 5000 M1 bars: ~3.5 days M5, ~10.4 days M15. No additional TV subscriptions needed.
- **(c) Frontend M1 aggregation** — `chartDataStore.js` aggregates M1 into higher TFs. Duplicates logic.

**Recommendation:** Option (a) — native bars have correct OHLC, not aggregated from M1 closes.

### Gap 2: Data Routing to Chart Store

TradingView candle data flows to `marketDataStore.js` only. `chartDataStore.js` is cTrader-only.

**Required:**
- `DataRouter.js` — emit `candleUpdate`/`candleHistory` messages for TradingView chart candles
- `chartDataStore.js` — accept data from TradingView source
- Source tag on `subscribeCandles`/`getHistoricalCandles` so backend routes correctly

### Gap 3: Source Selection UI

No mechanism to choose cTrader vs TradingView for chart data.

**Options:**
- Per-symbol in workspace config (matches existing `source` field on tickers)
- Global fallback (cTrader first, TV on failure)
- Explicit toggle per display

**Recommendation:** Per-symbol, matching the existing `ticker.source` pattern. Auto-default: cTrader if symbol exists in cTrader map, TradingView otherwise.

### Gap 4: Cache Isolation

IndexedDB cache key is `[symbol+resolution+timestamp]`. Same symbol from both sources would collide.

**Fix:** Add `source` to the compound index: `[symbol+resolution+source+timestamp]`.

### Gap 5: Backend Candle History for TradingView

`WebSocketServer.js` handles `getHistoricalCandles` by delegating to `CTraderDataProcessor`. No TradingView path exists for chart historical requests.

**Required:** New handler that fetches historical bars from TradingView for chart resolutions.

### Gap 6: Live Close Updates for TradingView Charts

cTrader charts use per-tick spot prices for live close updates via `marketDataStore`. TradingView has no tick data — only M1 candle completions.

**Approach:** Use TradingView M1 candle close as the "tick" price for chart live updates. The M1 candle's close updates in real-time (TradingView pushes incremental M1 updates).

---

## Toggle Placement Analysis

| Location | File | Pros | Cons |
|----------|------|------|------|
| Ticker identity column | `PriceTicker.svelte:521-530` | Per-display, non-intrusive, local context | Only visible for focused ticker |
| Chart header | `displays/ChartHeader.svelte` | Always visible when chart is open | Not on non-chart displays |
| Workspace modal | `WorkspaceModal.svelte` | Centralized config | Requires modal interaction |
| Context menu | New component | Contextual access | Not discoverable |

**Recommendation:** Chart header — shows `CT` or `TV` badge next to symbol name. Click to toggle. Matches the pattern of per-display controls already in the header.

---

## Proposed Implementation Phases

### Phase 1: M1 Charts from TradingView (minimal viable)

Bridge existing M1 data to `chartDataStore.js`.

**Backend:**
- `WebSocketServer.js` — handle `getHistoricalCandles` with `source: 'tradingview'`, return M1 bars from TradingViewSession
- `DataRouter.js` — route TradingView M1 candles as `candleUpdate` messages with `timeframe: 'M1'`
- `RequestCoordinator.js` — handle TradingView candle history requests

**Frontend:**
- `chartDataStore.js` — pass `source` on `getHistoricalCandles`/`subscribeCandles` messages
- `ChartDisplay.svelte` — read source from workspace ticker, pass to chartDataStore
- `connectionManager.js` — include source in candle subscription messages

### Phase 2: Multi-timeframe TradingView Support

Add TradingView subscriptions for M5, M15, H1, H4.

**Backend:**
- `TradingViewSession.js` — support additional resolution sessions (parametrize current D1+M1 pattern)
- `TradingViewCandleHandler.js` — process multi-timeframe candles
- `TradingViewDataPackageBuilder.js` — include historical bars for requested chart timeframes
- `TradingViewSubscriptionManager.js` — manage multi-resolution subscriptions

**Frontend:**
- `chartDataStore.js` — resolution-aware TradingView candle handling

### Phase 3: Source Selection UI

Per-symbol source toggle with automatic fallback.

**Frontend:**
- `workspace.js` — add `chartSource` field per ticker (default: auto)
- `displays/ChartHeader.svelte` — source badge + click-to-toggle
- `ChartDisplay.svelte` — source indicator in header
- Auto-detection: if symbol not in cTrader map, default to TradingView

---

## Key Files Reference

### Backend — Will Need Modification

| File | Lines | What to Change |
|------|-------|----------------|
| `services/tick-backend/WebSocketServer.js` | ~493 | Add TradingView path for `getHistoricalCandles` handler |
| `services/tick-backend/DataRouter.js` | 155-181 | Emit `candleUpdate` from TradingView pipeline |
| `services/tick-backend/RequestCoordinator.js` | 28-34 | Handle TradingView candle history requests |
| `services/tick-backend/TradingViewSession.js` | full | Multi-resolution session support |
| `services/tick-backend/TradingViewCandleHandler.js` | full | Multi-TF candle processing |
| `services/tick-backend/TradingViewSubscriptionManager.js` | full | Multi-resolution subscription tracking |

### Frontend — Will Need Modification

| File | Lines | What to Change |
|------|-------|----------------|
| `src/stores/chartDataStore.js` | 25-34, 417-444 | Source-aware cache key, source on WS messages |
| `src/components/ChartDisplay.svelte` | 467-491 | Pass source to chartDataStore on symbol change |
| `src/components/displays/ChartHeader.svelte` | full | Source badge + toggle |
| `src/stores/workspace.js` | full | `chartSource` field per ticker |
| `src/lib/connectionManager.js` | 120-128 | Source on candle subscription messages |

### Files — Reference Only (no changes needed)

| File | Why |
|------|-----|
| `src/stores/marketDataStore.js` | Understand existing TradingView data flow |
| `src/lib/chart/chartConfig.js` | Resolution/period mapping constants |
| `src/lib/chart/xAxisCustom.js` | X-axis rendering (source-agnostic) |
| `src/lib/connection/subscriptionManager.js` | Source-aware dispatch (already works) |
| `docs/dual-source-architecture.md` | Source-agnostic pattern for derived data |

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| TradingView rate limiting on additional TF subscriptions | Missing chart data | Test subscription limits; batch subscriptions; cache aggressively |
| Insufficient historical depth for higher TFs | Short chart history | TV supports 5000 bars per batch with pagination — covers all default + 2x windows for M15+ |
| Timestamp alignment (TV seconds vs cTrader ms) | Misaligned bars | Normalize to ms at handler layer (already done in TradingViewCandleHandler) |
| Source-agnostic derived data double-counting | Corrupted TWAP/Profile | Apply pattern from `dual-source-architecture.md` |
| TradingView WebSocket disconnection during active chart | Stale chart data | Existing reconnection logic; show staleness indicator |
| IndexedDB cache collision between sources | Wrong bars displayed | Add source to compound index |
