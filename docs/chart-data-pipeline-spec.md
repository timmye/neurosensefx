# Chart Data Pipeline Spec

**Date:** 2026-04-08
**Related:** `plans/chart-data-fix.md` (original RCA, 2026-04-02)

## Architecture

### Data Sources

| Source | What it provides | Timestamps |
|--------|----------------|------------|
| cTrader historical (`ProtoOAGetTrendbarsReq`) | Complete OHLC bars for any period | cTrader session-anchored (e.g., 21:00/01:00/05:00 UTC for H4) |
| cTrader live trendbar subscription | Accepts subscriptions for all periods, but spot events only carry M1 entries (RC6) | M1-aligned when from spot events |
| TradingView M1 candles | Live M1 bars (1500 historical on connect, then real-time) | `time * 1000` (seconds from TradingView) |
| Per-tick spot price | Current bid/ask price | `Date.now()` in `ChartDisplay.svelte` |

### Live Subscription (All Timeframes)

All timeframes subscribe directly to their native cTrader period. The M1 aggregation layer was removed.

```
Historical: getHistoricalCandles(AUDUSD, '4h') → cTrader → session-anchored timestamps
Live:      subscribeCandles(AUDUSD, '4h')       → cTrader subscription accepted
           Per-tick close:  marketDataStore spot price → rAF-batched → chart.updateData()
```

### cTrader Limitations (RC6 + RC12 — confirmed by diagnostic)

**RC6 — Spot events only carry M1 trendbar entries.** cTrader `ProtoOASubscribeLiveTrendbarReq` accepts subscriptions for all periods (M1–D1), and the backend successfully registers them. However, spot events only contain M1 trendbar data. The period-field routing loop in `CTraderSession.js` never sees a non-M1 period in the trendbar entries — every entry has `period=M1`.

**RC12 — Non-M1 live trendbar subscriptions produce no data.** Even though cTrader accepts the subscription, no genuine non-M1 bar data arrives in the spot event stream. The old backend fallback took the M1 entry and re-labeled it as the subscribed period, creating fabricated bars with M1 timestamps.

**Consequence:** The per-tick spot price is the primary live close update source for all non-M1 timeframes.

### candleUpdate Diagnostic Results (2026-04-08)

Script: `scripts/diagnose-candle-updates.cjs` — subscribes to all 8 periods simultaneously for 30s.

```
Period | Subscribed | Updates/30s | Timestamp            | Period-aligned? | Genuine?
-------|------------|-------------|----------------------|-----------------|----------
M1     | YES        | 50          | 03:02:00 (correct)   | YES             | YES
M5     | YES        | 48          | 03:00:00 (wrong bar) | YES             | NO — M1 data
M15    | YES        | 47          | 03:00:00 (wrong bar) | YES             | NO — M1 data
M30    | YES        | 46          | 03:00:00 (wrong bar) | YES             | NO — M1 data
H1     | YES        | 45          | 03:00:00 (wrong bar) | YES             | NO — M1 data
H4     | YES        | 44          | 01:00:00 (suspicious)| NO              | NO — M1 data
H12    | YES        | 43          | 21:00:00 (suspicious)| NO              | NO — M1 data
D1     | YES        | 42          | 21:00:00 (suspicious)| NO              | NO — M1 data
```

All non-M1 candleUpdate messages were produced by the **backend fallback** (now removed) taking the single M1 trendbar entry from each spot event and re-labeling it as the subscribed period. This was the root cause of the price jumping — ~8 fabricated candleUpdate messages per tick, each overwriting the chart's close.

### Subscription Acceptance Test (2026-04-08)

Script: `scripts/test-ctrader-subscriptions.cjs`

cTrader accepts `ProtoOASubscribeLiveTrendbarReq` for all periods without error. The subscription itself succeeds — but no genuine non-M1 bar data arrives in the spot event stream (RC6).

## Changes Applied (2026-04-08)

| Change | File | Effect |
|--------|------|--------|
| Removed M1 aggregation layer | `chartDataStore.js` | Deleted `aggregationTargets` map, `registerAggregationTarget()`, and M1-to-higher-TF aggregation block |
| Direct native subscriptions | `chartDataStore.js:251-260` | `subscribeToCandles` sends native resolution (e.g., '4h') instead of always '1m' |
| Simplified unsubscribe | `chartDataStore.js:262-267` | Removed M1 reference counting and conditional unsubscribe |
| Cache freshness fix | `chartDataStore.js:212` | Removed `Math.min(..., 3_600_000)` 1-hour clamp |
| Cache invalidation | `chartDataStore.js:24,31` | Dexie version bump to 2 clears stale M1-aggregated cache |
| E2E test update | `chart-display.spec.js:454,459` | Updated assertion from '1m' to '4h' |
| Removed M1-as-nonM1 fallback | `CTraderSession.js:166-170` | Eliminated fallback that fabricated non-M1 barUpdates from M1 spot data |
| rAF batching for per-tick | `ChartDisplay.svelte:598-627` | All timeframes: multiple ticks per frame coalesced into one updateData call |
| Incremental path same-bar guard | `ChartDisplay.svelte:574-590` | candleUpdate only applies to genuinely new bars; same-bar close handled by rAF tick path |

## Live Price Rendering Fix (2026-04-08)

### Problem
Chart close price jumped on every tick.

### Root Cause
The backend fallback in `CTraderSession.js` fabricated non-M1 `barUpdate` events from M1 spot data on every tick (~8 messages per tick for 8 subscribed periods). The frontend incremental path applied these synchronously, overwriting the close that the rAF-batched per-tick path had just set. Between animation frames, the close oscillated between the fabricated trendbar close and the latest tick price.

### Fix
1. **Backend**: Removed the fallback — no more fabricated non-M1 barUpdates.
2. **Frontend**: rAF batching coalesces per-tick updates into one render frame. Incremental candleUpdate path skips same-bar updates (only applies genuinely new bars).
3. **Per-tick spot price** is the sole live close update source for all timeframes.

## Key Files

| File | Role |
|------|------|
| `src/stores/chartDataStore.js` | OHLC bar management, subscriptions, IndexedDB caching |
| `src/components/ChartDisplay.svelte` | KLineChart data feed + rAF-batched per-tick close updates (all resolutions) |
| `services/tick-backend/CTraderSession.js` | cTrader subscription + spot event routing (fallback removed) |
| `services/tick-backend/CTraderEventHandler.js` | Multi-TF trendbar processing |
| `services/tick-backend/DataRouter.js` | Bar routing to WebSocket clients |
| `services/tick-backend/TradingViewCandleHandler.js` | M1 candle handling (history batched for Market Profile, live emitted) |
| `plans/chart-data-fix.md` | Original RCA (12 root causes, 23 fixes applied) |
| `scripts/test-ctrader-subscriptions.cjs` | Subscription acceptance test |
| `scripts/diagnose-candle-updates.cjs` | candleUpdate flow diagnostic (all periods, simultaneous, with timestamp analysis) |
