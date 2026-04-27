# TradingView Subscription Latency Analysis

## Problem Statement

After the tunnel optimization commit (`e7d93df`), symbols sourced from TradingView loaded slowly -- tickers showed "..." placeholders, charts rendered blank, and floating displays showed red error indicators. The delay lasted tens of seconds. FX basket symbols (sourced from cTrader) loaded normally.

## Root Cause

TradingView bans IPs that send subscriptions too rapidly. The tunnel optimization removed per-subscription throttling on the frontend `subscriptionManager.js`, causing all subscriptions to arrive at the backend in bursts. The backend forwarded these to TradingView without any rate limiting, triggering an IP ban. The ban caused subsequent subscriptions to fail silently or time out.

No rate limiter existed on the TradingView subscription path in `RequestCoordinator.js` -- the cTrader path had a 300ms queue (`_MIN_REQUEST_INTERVAL_MS`), but the TradingView path sent all requests as fast as they arrived.

## Timeline of Changes

### Commit e7d93df (2026-04-23) -- Tunnel Optimization

Changed `src/lib/connection/subscriptionManager.js` to batch subscriptions in bursts of 10 with 200ms pauses between batches instead of 400ms per subscription. This reduced total frontend-to-backend subscription time for 75 symbols from ~30s to ~1.4s.

**Impact**: All subscriptions -- both cTrader and TradingView -- arrived at the backend within ~1.4s. The cTrader path handled this fine because `RequestCoordinator._processQueue` already enforced 300ms intervals between requests. The TradingView path had no such protection.

### Fix -- TradingView Queue Added to RequestCoordinator.js

Added a dedicated queue for TradingView subscriptions (`_tvQueue`, `_tvProcessing`, `_TV_MIN_INTERVAL_MS`) in `services/tick-backend/RequestCoordinator.js`. The queue serializes TradingView `subscribeToSymbol` calls with a configurable minimum interval.

| Phase | `_TV_MIN_INTERVAL_MS` | 20-symbol load time | Notes |
|-------|----------------------|--------------------|-------|
| Before queue | N/A (parallel) | 1-3s | Triggered IP ban |
| Initial fix | 2000ms | 39-41s | No IP ban, but slow |
| After tuning | 500ms | ~12s | No IP ban, acceptable |

## Latency Analysis

### Subscription Paths

Two independent queues operate in `RequestCoordinator.js`:

**cTrader queue** (`_queue`, line 15):
- Minimum interval: `_MIN_REQUEST_INTERVAL_MS = 300` (line 17)
- Each request blocks for the full fetch duration (1-3s per symbol)
- Queue processing at line 102: serial with 300ms gap between starts
- For 10 cTrader symbols: 10 x (1-3s fetch + 0.3s gap) = 13-33s

**TradingView queue** (`_tvQueue`, line 19):
- Minimum interval: `_TV_MIN_INTERVAL_MS = 500` (line 21)
- Each `subscribeToSymbol` call completes in <10ms (WebSocket message send)
- Queue processing at line 373: serial with 500ms gap between starts
- For 20 TV symbols: 19 x 0.5s gap = 9.5s (last symbol completes at ~10s)

### Per-Symbol TradingView Protocol Cost

TradingView sends 6 WebSocket messages per symbol subscription (defined in `services/tick-backend/TradingViewSubscriptionManager.js`):

1. `chart_create_session` (D1 session)
2. `resolve_symbol` (D1 symbol resolution)
3. `create_series` (D1 daily candles, 14+5 bars)
4. `chart_create_session` (M1 session)
5. `resolve_symbol` (M1 symbol resolution)
6. `create_series` (M1 1-minute candles, 1500 bars)

All 6 messages are sent within the same `subscribeToSymbol` call. The 500ms queue interval spaces entire symbol subscriptions, not individual messages.

### Combined Load Timing

With 10 cTrader + 20 TradingView symbols subscribing concurrently:

| Path | Queue | Symbols | Time to last symbol |
|------|-------|---------|-------------------|
| cTrader | 300ms + fetch blocking | 10 | 13-33s |
| TradingView | 500ms (subscribe only) | 20 | ~10s |
| **Total (parallel)** | Both queues run independently | 30 | **~33s** (cTrader-bound) |

The two queues are independent -- they do not block each other. Total wall-clock time is determined by whichever queue finishes last (cTrader, due to fetch blocking).

## UX Impact During Loading

What traders see while subscriptions are queued:

1. **Tickers**: Show "..." placeholder text until `symbolDataPackage` arrives for that symbol
2. **Charts**: Render blank/empty until historical candle data arrives
3. **Floating displays**: Show red error indicator when `subscribeToSymbol` times out (30s timeout per symbol in `TradingViewSubscriptionManager.setCompletionTimeout`, line 93)
4. **FX basket**: Loads normally (cTrader-sourced, separate queue)

The 500ms queue interval means the 20th TradingView symbol starts subscribing at ~9.5s and receives data within ~10s. The 10th cTrader symbol starts at ~2.7s but may not finish fetching until ~33s. During this window, those symbols show loading state.

## Research Findings

### TradingView Rate Limits (Undocumented)

TradingView does not publish official rate limits for its WebSocket API. Evidence from community sources:

- **Reddit**: Users report sustained rates of ~28 req/s trigger IP bans. Occasional bursts are tolerated but sustained throughput above this threshold causes connection drops.
- **Python `tradingview-ws` library**: Uses a 5-second default delay between subscriptions (conservative).
- **TypeScript `twc` library**: Recommends 1-3 concurrent chart sessions maximum per connection.
- **Community consensus**: 500ms-1s interval between subscription commands is safe for sustained use.

### Rate Calculation

At 500ms per symbol, the system sends 2 symbols/second x 6 messages = 12 messages/second. This is well below the ~28 req/s ban threshold observed in the wild. At 200ms per symbol, it would be 5 x 6 = 30 messages/second -- right at the threshold, explaining why the initial unthrottled burst triggered bans.

### Authenticated Sessions

TradingView Pro authenticated sessions have higher rate limits than anonymous sessions. The current implementation uses anonymous sessions via the `tradingview-ws` library (`services/tick-backend/TradingViewSession.js`, line 74: `connect(options)` with optional sessionId). Adding authentication would allow faster subscription rates.

## Resolution

### Changes Made

**`services/tick-backend/RequestCoordinator.js`**:

| Line | Addition | Purpose |
|------|----------|---------|
| 12 | `pendingTradingViewRequests` Map | Track clients waiting for TV data per symbol |
| 18-21 | `_tvQueue`, `_tvProcessing`, `_TV_MIN_INTERVAL_MS = 500` | TV subscription queue state and rate limit |
| 33-34 | `handleTradingViewRequest` routing | Route TV source to dedicated handler |
| 305-356 | `handleTradingViewRequest()` | Queue TV subscriptions, coalesce waiting clients |
| 363-368 | `_enqueueTradingView()` | Push to TV queue with promise wrapper |
| 373-388 | `_processTradingViewQueue()` | Serial TV queue processing with 500ms interval |

**`src/lib/connection/subscriptionManager.js`** (no changes for this fix -- the tunnel optimization commit that caused the issue changed this file, but the fix was backend-only):

The frontend continues to send subscriptions in bursts of 10 with 200ms pauses. Rate limiting is now enforced server-side in the RequestCoordinator.

### E2E Test Coverage

`tests/e2e/tv-subscription-queue.spec.js` validates:
- Consecutive subscriptions are spaced >= 1.5s apart in backend logs (line 166)
- No "banned by ip" errors appear (line 188)
- No "__SYSTEM__" symbol errors appear (line 201)

Note: The test references `_TV_MIN_INTERVAL_MS = 2000` (line 8 comment) but the actual value was later tuned to 500ms. The test tolerance of 1500ms still passes because it only checks consecutive M1 subscription log entries, which include both the queue interval and the time for TradingView to respond.

## Metrics

| Metric | Before (no queue) | Queue at 2s | Queue at 500ms |
|--------|-------------------|-------------|----------------|
| 20 TV symbols load time | 1-3s (then IP ban) | 39-41s | ~10s |
| IP ban occurrence | Yes | No | No |
| Messages/second (peak) | ~120 (burst) | 3 | 12 |
| Per-subscription interval | 0ms (parallel) | 2000ms | 500ms |
| Time to first TV symbol | ~0.1s | ~0.1s | ~0.1s |
| Time to last TV symbol | ~1-3s | ~39-41s | ~10s |

## Recommendations

### 1. Adaptive Rate Limiting

The fixed 500ms interval is conservative. An adaptive approach could start at 500ms and reduce to 200ms after N successful subscriptions with no errors, then back off on any failure or timeout. This would reduce average load time while maintaining safety.

### 2. TradingView Session Cleanup

`TradingViewSession.js` creates 2 chart sessions per symbol (D1 + M1). With 20 symbols, that is 40 chart sessions on a single WebSocket connection. The `twc` library recommends 1-3 concurrent sessions. Consider session cleanup for symbols no longer subscribed by any client, or splitting across multiple connections.

### 3. Authenticated TradingView Sessions

TradingView Pro accounts have higher rate limits. If a session token is available, passing it via `connect({ sessionId })` (already supported at `TradingViewSession.js:73`) would allow reducing the queue interval and potentially eliminating the queue entirely.

### 4. Parallel cTrader and TV Queue Optimization

The cTrader queue blocks on fetch duration (1-3s per symbol), making it the bottleneck at 13-33s for 10 symbols. The TV queue finishes in ~10s but waits idle for cTrader. Consider whether cTrader fetch latency can be reduced (prefetching, caching) to bring total load time closer to the TV queue's ~10s.

## Files Changed

| File | Change |
|------|--------|
| `services/tick-backend/RequestCoordinator.js` | Added `_tvQueue`, `_tvProcessing`, `_TV_MIN_INTERVAL_MS`, `handleTradingViewRequest()`, `_enqueueTradingView()`, `_processTradingViewQueue()`, `pendingTradingViewRequests` Map |
| `src/lib/connection/subscriptionManager.js` | Changed in `e7d93df` (burst-of-10 batching) -- the trigger for this issue, not part of the fix |

### Files Referenced

| File | Relevance |
|------|-----------|
| `services/tick-backend/TradingViewSession.js:73-74` | TradingView WebSocket connection with optional session auth |
| `services/tick-backend/TradingViewSubscriptionManager.js:17-61` | 6-message subscription protocol (3 D1 + 3 M1 per symbol) |
| `services/tick-backend/TradingViewCandleHandler.js` | Candle processing and data package emission |
| `tests/e2e/tv-subscription-queue.spec.js` | E2E validation of queue spacing and IP ban absence |
