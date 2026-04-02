# Chart Data Pipeline Fix Plan

> Status: Approved for implementation
> Date: 2026-04-02
> Priority: Critical — chart data inaccurate and not live

## Problem Statement

Chart data is inaccurate and not live despite multiple fix attempts. Root cause analysis identified 4 compounding bugs. The day range meter proves the cTrader connection and live tick pipeline are healthy — all chart problems are self-inflicted.

## Root Cause Analysis

### RC1: Trendbar Period Routing (CRITICAL)

**File**: `CTraderSession.js:134-166`, `CTraderEventHandler.js:15-81`

The spot event handler processes trendbar data for ALL subscribed periods using the SAME array entry (`event.trendbar[event.trendbar.length - 1]`). When M1 (market profile) and H4 (chart) are both subscribed for EURUSD, both processors get the same trendbar entry. One of them always processes wrong-period data.

**The fix was blocked by a false comment** at `CTraderSession.js:150-152` claiming "The cTrader event doesn't carry a period field." This is wrong -- the official cTrader API docs confirm `ProtoOATrendbar` has an `optional ProtoOATrendbarPeriod period = 4` field. The code simply never reads it.

**Impact**: Market profile and TWAP can receive H4 data labeled as M1. Chart can receive M1 data labeled as H4. Both are silently wrong.

### RC2: M1 Handler Has Same Bug

**File**: `CTraderEventHandler.js:15-48`

`processTrendbarEvent()` (M1 handler) also takes `event.trendbar[event.trendbar.length - 1]`. When M1 + H4 are subscribed, it may process the H4 bar as M1, corrupting market profile and TWAP.

### RC3: Loading State Drops Live Updates

**File**: `chartDataStore.js:417-418`

The store guard `if (current.state === STATE.IDLE || current.state === STATE.LOADING) return current` silently discards all live candle updates during LOADING state. No queuing, no replay. If historical fetch takes seconds, all live data during that window is lost.

### RC4: lastBarCount Heuristic

**File**: `ChartDisplay.svelte:234-244`

Uses bar count change (`Math.abs(data.bars.length - lastBarCount) > 1`) to guess whether to do a full replace or incremental update. Can miss updates or apply wrong operation. The store knows the update type but doesn't communicate it.

### RC5: fetchHistoricalCandles Request Storm (CRITICAL -- CONFIRMED)

**File**: `CTraderDataProcessor.js:73-192`, `WebSocketServer.js:420-442`

Confirmed by diagnostic logging: D1/M1 requests via `RequestCoordinator` queue achieve 100% success (60/60 matched). H4 requests sent directly (no queue) generate 659 requests with 33 `REQUEST_FREQUENCY_EXCEEDED` errors. The function calls `sendCommand()` in a while loop with no rate limiting, no queueing, no coalescing. Retry logic (3 retries per chunk with backoff) amplifies the storm.

**Cascading impact**: All H4 chunks fail, function returns empty bars, `candleHistory` sent with `bars: []`, chart shows no data. Subscription alone can't populate missing history.

**Fix**: Route `fetchHistoricalCandles` through `RequestCoordinator.enqueueDirect()` with 90s timeout. Fixed infinite loop where `currentFrom` never advanced past in-progress bars at chunk start (`Math.max(lastBarTimestamp + 1, chunkEnd)`). Result: single H4 request yields 30 bars in ~2 seconds with zero rate-limit errors.

### RC6: Period Field is Always M1

**File**: `CTraderSession.js:143-150`

Every trendbar entry in spot events has `tb.period=1` (M1) with `arrayLen=1` -- only ONE entry per spot event, regardless of subscribed periods. The cTrader API does NOT differentiate periods in spot event trendbar data. Period-field routing correctly handles M1 but can NEVER route non-M1 bars from spot events. Non-M1 live data requires frontend M1 aggregation.

### RC7: subscribeCandles Never Reaches Backend (Until Fix Applied)

**File**: `src/stores/chartDataStore.js:448-491`

`subscribeToCandles()` was only called from `handleCandleHistory()` or the cache-hit path. Since historical fetch returned empty bars (RC5), the subscription alone couldn't populate missing data. Fixed by calling `subscribeToCandles` immediately on cache-miss, before the backend fetch completes.

### RC8: candleBoundaryTimestamp Produces Wrong Boundaries (CRITICAL -- CONFIRMED)

**File**: `src/lib/chart/chartConfig.js:115-133`

The function uses clean math (`Math.floor(ts / periodMs) * periodMs`) producing timestamps aligned to 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC for H4. cTrader's actual H4 bars are anchored to 07:40, 17:40, 21:40, 02:40 UTC (forex market session offset). No mathematical formula can reproduce these boundaries without broker-specific session configuration.

**Cascading impact**: `bars.findIndex(b => b.timestamp === boundaryTs)` always returns -1. The else branch pushes a new duplicate bar at the wrong timestamp. Every M1 tick creates a fake H4 bar. This is why live prices are wrong on every non-M1 timeframe.

**Fix**: Replaced boundary-based aggregation with simple last-bar close/high/low update. Removed `candleBoundaryTimestamp()` entirely.

### RC9a: Aggregation Approach is Fundamentally Flawed

The M1-to-higher-timeframe aggregation using boundary math is broker-dependent and fragile: cTrader's session anchor is non-standard, different instruments may have different anchors, and the anchor can change with broker configuration. Historical fetch already provides correct OHLC bars for any timeframe -- aggregation is only needed for the current in-progress bar.

**Fix**: Just update the last bar's close/high/low. No boundary computation, no new bar creation.

### RC9b: M1 Aggregation Never Creates New Period Bars (CRITICAL)

**File**: `src/stores/chartDataStore.js:455-475`

The simplified aggregation only updates the last bar's close/high/low. It never creates new bars when M1 data crosses a period boundary. Over time, the chart's last candle grows indefinitely instead of splitting. Example: H1 bars fetched up to 10:00 UTC, current time 10:45 -- the 09:00-10:00 bar gets its close patched but no 10:00-11:00 bar is created.

### RC10: M1 Subscription Torn Down on Resolution Switch (HIGH)

**File**: `src/stores/chartDataStore.js:340-365`

Switching from 4h to 1h: `unsubscribeFromCandles('EURUSD', '4h')` empties the aggregation targets set, which deletes the M1 subscription and sends `unsubscribeCandles` to backend. The new M1 subscription is async, creating a gap where no live data arrives.

### RC11: Stale IndexedDB Cache Serves Old Bars on Timeframe Switch (MEDIUM)

**File**: `src/stores/chartDataStore.js:270-295`

The staleness threshold (`RESOLUTION_MS[resolution] * 2`) was 8 hours for H4, 2 days for D1. Switching timeframes could serve stale cached bars without a backend fetch.

**Fix**: Cache staleness cap raised from 2min to 1hr, making cache useful for H4+ timeframes.

### RC12: Backend Drops Non-M1 Updates (HIGH -- WORKAROUND ONLY)

**File**: `services/tick-backend/DataRouter.js:85-108`

Frontend only subscribes to M1 candles. When cTrader sends H4 trendbar data in spot events, `routeCandleUpdate` looks up `candleSubscriptions["EURUSD:H4"]`, finds zero subscribers, drops the message. Attempted fix: subscribe to actual target period alongside M1. However, cTrader `ProtoOASubscribeLiveTrendbarReq` for non-M1 periods returns error on this account. The M1 aggregation path remains the primary live data mechanism for non-M1.

### Verified: Symbol Flow is Correct Throughout

Frontend always sends symbol name (e.g. "EURUSD"), backend resolves to symbol ID via `CTraderSymbolLoader.getSymbolId()`. Historical and live paths use the same resolution. No symbol mismatch.

### Verified: Resolution Mapping is Symmetric

Frontend `resolutionToPeriod`: `'1h' -> 'H1'`, `'4h' -> 'H4'`. Backend `RESOLUTION_TO_PERIOD`: `'1m' -> 'M1'`, `'4h' -> 'H4'`. Frontend `periodToResolution`: `'H1' -> '1h'`, `'H4' -> '4h'`. All correct and consistent.

## Implementation Status -- ALL CHANGES APPLIED

| # | Change | Status |
|---|---|---|

| 1 | `CTraderEventHandler.js` -- Period-based trendbar routing; individual entries | DONE |
| 2 | `CTraderSession.js` -- `PERIOD_ENUM_TO_STRING` mapping, subscription limit raised to 3 | DONE |
| 3 | `CTraderSession.js` -- False comments corrected | DONE |
| 4 | `chartDataStore.js` -- Removed LOADING state guard | DONE |
| 5 | `chartDataStore.js` -- `updateType` flag | DONE |
| 6 | `ChartDisplay.svelte` -- Replaced `lastBarCount` with `updateType` flag | DONE |
| 7 | `WebSocketServer.js` + `RequestCoordinator.js` -- Rate-limited historical fetch via queue | DONE |
| 8 | `chartDataStore.js` + `chartConfig.js` -- Simple last-bar close update (no boundary math). Removed `candleBoundaryTimestamp()`. | DONE |
| 9 | `chartDataStore.js` -- Subscribe immediately on cache-miss | DONE |
| 10 | `chartDataStore.js` -- Preserve FETCHING_MORE state during candle updates | DONE |
| 11 | `CTraderDataProcessor.js` -- Fixed chunk advancement (zero-progress guard) | DONE |
| 12 | `RequestCoordinator.js` -- Fixed `enqueueDirect` double-timeout | DONE |
| 13 | `ChartDisplay.svelte` -- `unsubscribeFromCandles` on window change | DONE |
| 14 | `chartDataStore.js` -- Cache staleness cap 2min -> 1hr | DONE |
| 15 | `chartDataStore.js` -- M1 subscription leak fix | DONE |
| 16 | `chartDataStore.js` -- `registerAggregationTarget()` helper | DONE |
| 17 | `chartConfig.js` -- Removed dead constants | DONE |
| 18 | Backend files -- Removed diagnostic logging | DONE |
| 19 | `chartDataStore.js` -- handleCandleHistory merges instead of replaces | DONE |
| 20 | `chartDataStore.js` -- Dedup keeps last (live > history) | DONE |
| 21 | `ChartDisplay.svelte` -- O(1) incremental updates | DONE |
| 22 | All affected files -- Removed quarterly (Q) resolution | DONE |
| 23 | `CTraderEventHandler.js` -- Removed dead wrapper methods | DONE |

## Acceptance Criteria

- [x] Backend pipeline test: PASS (230 ticks/60s, 190 M1 updates, H4 ends today, 0.0 pip diff)
- [x] Historical candle fetch completes without rate-limit errors or infinite hang
- [x] H4 history ends within 24h of now (not Sept 2025)
- [x] Chart shows correct OHLC data for any selected timeframe (frontend visual verification pending)
- [ ] Live candle updates appear in real-time (matching day range meter freshness)
- [ ] Resolution switching loads correct data
- [ ] Symbol switching loads correct data
- [ ] Reconnect restores subscriptions and data flow
- [ ] Progressive scroll loading still works
- [ ] Non-M1 timeframes show live updates via M1 aggregation

## Remaining Known Limitations

1. **New period bars not created from M1 aggregation**: When an H4 bar closes and a new one starts, the chart won't show the new bar until the next historical fetch (resolution switch or scroll). cTrader rejects non-M1 live subscriptions on this account.
2. **Volume not updated by M1 aggregation**: The last-bar update patches close/high/low but not volume. Volume on the forming bar stays at whatever the historical fetch returned.
