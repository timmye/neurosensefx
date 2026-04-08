# Chart Data Pipeline Spec

**Date:** 2026-04-08
**Related:** `plans/chart-data-fix.md` (original RCA, 2026-04-02)

## Architecture

### Data Sources

| Source | What it provides | Timestamps |
|--------|----------------|------------|
| cTrader historical (`ProtoOAGetTrendbarsReq`) | Complete OHLC bars for any period | cTrader session-anchored (e.g., 21:00/01:00/05:00 UTC for H4) |
| cTrader direct live subscription | Live OHLC bars for any subscribed period | Same as historical — cTrader session-anchored |
| TradingView M1 candles | Live M1 bars (1500 historical on connect, then real-time) | `time * 1000` (seconds from TradingView) |
| Per-tick spot price | Current bid/ask price | `Date.now()` in `ChartDisplay.svelte` |

### Live Subscription (All Timeframes)

All non-M1 timeframes subscribe directly to their native cTrader period. The M1 aggregation layer was removed.

```
Historical: getHistoricalCandles(AUDUSD, '4h') → cTrader → session-anchored timestamps
Live:      subscribeCandles(AUDUSD, '4h')       → cTrader H4 live bars → session-anchored timestamps
```

Same pattern for 1h, 4h, 12h, D, W, M — no timeframe-specific logic.

### Subscription Test Results (2026-04-08)

Script: `scripts/test-ctrader-subscriptions.cjs`

All periods accept subscriptions and receive live candleUpdate data with session-anchored timestamps:

```
Period | Subscribed | candleUpdate received | Timestamp style
-------|------------|-----------------------|---------------
M1     | YES        | YES (11 updates)       | minute-aligned
M5     | YES        | YES (8 updates)        | session-anchored
M15    | YES        | YES (10 updates)       | session-anchored
M30    | YES        | YES (9 updates)        | session-anchored
H1     | YES        | YES (5 updates)        | session-anchored
H4     | YES        | YES (13 updates)       | session-anchored (01:00 UTC)
H12    | YES        | YES (7 updates)        | session-anchored
D1     | YES        | YES (8 updates)        | session-anchored
```

### Previous Limitation (Partially Resolved)

`plans/chart-data-fix.md` (2026-04-02) documented two cTrader constraints:
- **RC6**: Spot events only carry M1 trendbar entries — still true in production. Non-M1 bar data is not embedded in spot events.
- **RC12**: cTrader rejects non-M1 live trendbar subscriptions — the subscription test (`scripts/test-ctrader-subscriptions.cjs`) showed all periods accept subscriptions and receive candleUpdate data. However, production behavior is inconsistent (may be account/session-specific). The per-tick spot price path remains the primary live close update source for non-M1 timeframes as a safe fallback.

## Changes Applied (2026-04-08)

| Change | File | Effect |
|--------|------|--------|
| Removed M1 aggregation layer | `chartDataStore.js` | Deleted `aggregationTargets` map, `registerAggregationTarget()`, and M1-to-higher-TF aggregation block |
| Direct native subscriptions | `chartDataStore.js:251-260` | `subscribeToCandles` sends native resolution (e.g., '4h') instead of always '1m' |
| Simplified unsubscribe | `chartDataStore.js:262-267` | Removed M1 reference counting and conditional unsubscribe |
| Cache freshness fix | `chartDataStore.js:212` | Removed `Math.min(..., 3_600_000)` 1-hour clamp |
| Cache invalidation | `chartDataStore.js:24,31` | Dexie version bump to 2 clears stale M1-aggregated cache |
| E2E test update | `chart-display.spec.js:454,459` | Updated assertion from '1m' to '4h' |

## Live Price Rendering Fix (2026-04-08)

### Problem
Chart close price jumped on every tick — KLineChart re-rendered on every `updateData()` call without any frame batching.

### Root Cause
Two issues combined:

1. **Backend fallback emitted incorrect data**: `CTraderSession.js:166-182` had a fallback that took the M1 trendbar entry from every spot event (per RC6, cTrader only sends M1 entries) and re-labeled it as the subscribed non-M1 period (e.g., H4). This produced `barUpdate` events with M1 timestamps labeled as H4, firing on every spot event.

2. **Dual-path conflict**: The incremental candleUpdate path (`ChartDisplay:574-588`) applied these updates synchronously on every spot event, overwriting the close that the rAF-batched per-tick path had just set. Between animation frames, the close oscillated between the trendbar close (from candleUpdate) and the latest tick price (from rAF path).

### Fix
Added `requestAnimationFrame` batching to the per-tick path for **all** resolutions. Multiple ticks within one animation frame are coalesced into a single `chart.updateData()` call, eliminating the per-tick re-render overhead while preserving live close updates.

| Change | File | Effect |
|--------|------|--------|
| rAF batching for per-tick updates | `ChartDisplay.svelte:598-627` | All timeframes: multiple ticks per frame coalesced into one updateData call |
| Removed backend M1-as-nonM1 fallback | `CTraderSession.js:166-170` | Eliminated fallback that emitted M1-timestamped bars as H4 barUpdate on every spot event |
| Incremental path guards same-bar updates | `ChartDisplay.svelte:574-590` | candleUpdate only applies to genuinely new bars; same-bar close handled by rAF tick path |

### Why per-tick is needed for non-M1
cTrader live trendbar subscriptions for non-M1 periods fail (RC12). The per-tick spot price is the only real-time close update source for non-M1 timeframes. When/if cTrader enables non-M1 subscriptions in production, the per-tick path can be scoped to M1-only.

## Key Files

| File | Role |
|------|------|
| `src/stores/chartDataStore.js` | OHLC bar management, subscriptions, IndexedDB caching |
| `src/components/ChartDisplay.svelte` | KLineChart data feed + rAF-batched per-tick close updates (all resolutions) |
| `services/tick-backend/CTraderSession.js` | cTrader subscription + spot event routing |
| `services/tick-backend/CTraderEventHandler.js` | Multi-TF trendbar processing |
| `services/tick-backend/DataRouter.js` | Bar routing to WebSocket clients |
| `services/tick-backend/TradingViewCandleHandler.js` | M1 candle handling (history batched for Market Profile, live emitted) |
| `plans/chart-data-fix.md` | Original RCA (12 root causes, 23 fixes applied) |
| `scripts/test-ctrader-subscriptions.cjs` | Subscription diagnostic script |
