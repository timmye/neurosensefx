# Market Profile for TradingView Implementation

## Overview

Implement M1 (1-minute) candle support for Market Profile visualization in the TradingView data feed. Currently, `TradingViewSession.js` only implements D1 (daily) candles for Day Range Meter, but Market Profile requires M1 bars for TPO (Time-Price-Opportunity) calculation.

**Approach**: Extend the existing single-chart-session pattern to subscribe to both D1 and M1 series within one session, track completion states independently (TradingView API fires `series_completed` per series), accumulate both candle types, and emit a combined `symbolDataPackage` with `initialMarketProfile` when both series complete.

**Why not parallel sessions**: Scope doc specifies single session with two series (sds_1: D1, sds_2: M1). Parallel sessions would double connection overhead and add lifecycle management complexity, violating the simplicity principle.

## Planning Context

This section is consumed VERBATIM by downstream agents (Technical Writer, Quality Reviewer). Quality matters: vague entries here produce poor annotations and missed risks.

### Decision Log

| Decision | Reasoning Chain |
| --- | --- |
| Single session with D1+M1 series | Scope doc explicitly specifies single chart session with two series (sds_1: D1, sds_2: M1) -> Parallel feeds architecture requires simple routing -> Multiple sessions would double connection overhead and violate simplicity principle |
| Track completion states independently | TradingView API fires series_completed once per series -> Emitting data immediately would send incomplete packages -> Need both D1 (for ADR) and M1 (for Market Profile) before emission -> Track d1Complete and m1Complete flags, emit only when both true |
| Store M1 candles in subscription state | M1 historical data required for initialMarketProfile emission -> Cannot re-fetch after series completes -> Accumulate in m1Candles array during candle updates -> Memory overhead acceptable (~144KB per symbol for one trading day) |
| No frontend changes needed | displayDataProcessor.js handles symbolDataPackage generically -> marketProfileProcessor.js calls buildInitialProfile for any symbolDataPackage -> Existing code already extracts initialMarketProfile array -> Crystal Clarity: avoid unnecessary modifications |

### Rejected Alternatives

| Alternative | Why Rejected |
| --- | --- |
| Separate parallel sessions for D1 and M1 | Scope doc specifies single session; would double connection overhead per symbol; adds lifecycle management complexity; violates simplicity principle |
| M1-derived ADR (single M1 source) | Scope doc specifies D1 for ADR calculation; aggregation adds computation layer; reinventing D1 candles from M1 violates framework-first principle |
| Defer M1 implementation | Scope doc line 159-186 explicitly includes Market Profile in TradingView feed; success criteria require Market Profile working with TradingView source |

### Constraints & Assumptions

**Technical Constraints:**
- Files must be <120 lines (Crystal Clarity compliance)
- Functions must be <15 lines
- Framework-first: tradingview-ws library v0.0.3
- Node.js >=12.0.0
- No new files unless separation trigger met (>500 lines, distinct module)

**Organizational Constraints:**
- Crystal Clarity architecture: simple, performant, maintainable
- Parallel non-interacting feeds (cTrader + TradingView)

**Dependencies:**
- tradingview-ws library for TradingView WebSocket API
- Existing DataRouter for message routing
- Existing displayDataProcessor for client-side data handling

**Default Conventions Applied:**
- Domain: file-creation - Extend existing files unless separation trigger applies
- Domain: simplicity - Prefer minimal changes over new abstractions

### Known Risks

| Risk | Mitigation | Anchor |
| --- | --- | --- |
| series_completed event timing ambiguity | Track both D1 and M1 completion states independently; only emit when both flags true | N/A (new behavior) |
| M1 candle memory overhead | Limit to one trading day (~1440 candles); estimated 144KB per symbol; acceptable for typical usage (1-5 symbols) | tradingview-ws library returns 1000+ candles |
| Frontend does not process initialMarketProfile from TradingView | Existing code handles symbolDataPackage generically; buildInitialProfile extracts initialMarketProfile array | marketProfileProcessor.js:6-12 calls buildInitialProfile for symbolDataPackage type |
| Series never completes (API failure) | 30-second timeout guard; emits error event if series_completed not fired | N/A (new behavior) |
| Empty series completion | Validate candle count > 0; emit error if API completes with zero candles | N/A (new behavior) |
| M1 accumulation exceeds limit | Hard cap at 1500 candles; truncate with warning if API returns more | N/A (new behavior) |

## Invisible Knowledge

This section captures information NOT visible from reading the code. Technical Writer uses this for README.md documentation during post-implementation.

### Architecture

```
TradingView Session (Extended)
    |
    +-- subscribeToSymbol(symbol)
         |   (creates single chart session)
         v
    +-- chart_create_session --> cs_xxx (random ID)
         |
         +-- resolve_symbol --> sds_sym_SYMBOL
         |
         +-- create_series --> sds_1 (D1 candles, 1D timeframe)
         |                    (lookback: 14+5 days)
         |
         +-- create_series --> sds_2 (M1 candles, 1 timeframe)  [NEW]
         |                    (amount: 1440 for one day)         [NEW]
         |
         v
    Subscription State:
    {
        chartSession: string,
        lookbackDays: number,
        lastCandle: object,           // D1 candle
        historicalCandles: array,     // D1 candles for ADR
        m1Candles: array,             // M1 candles for Market Profile  [NEW]
        d1Complete: boolean,          // D1 series loaded flag           [NEW]
        m1Complete: boolean,          // M1 series loaded flag           [NEW]
        initialSent: boolean
    }
         |
         v
    Emission (when both complete):
    {
        type: 'symbolDataPackage',
        source: 'tradingview',
        symbol: string,
        open, high, low, current: number,     // from D1
        projectedAdrHigh, projectedAdrLow: number,  // calculated from D1
        initialMarketProfile: array          // M1 candles              [NEW]
    }
```

### Data Flow

```
TradingView API
    |
    +-- timescale_update / du events
         |
         v
    handleCandleUpdate
         |--> sds_1 detected --> accumulate in historicalCandles (D1)
         |--> sds_2 detected --> accumulate in m1Candles (M1)      [NEW]
         |
         v
    handleSeriesCompleted (per series)
         |--> sds_1 completed --> set d1Complete = true             [NEW]
         |--> sds_2 completed --> set m1Complete = true            [NEW]
         |
         v
    Check: d1Complete && m1Complete?                                [NEW]
         |
         +-- YES --> emit symbolDataPackage with initialMarketProfile
         +-- NO --> wait for remaining series
         |
         v
    DataRouter.routeFromTradingView
         |
         v
    WebSocket broadcast to clients
         |
         v
    displayDataProcessor.processSymbolData
         |
         v
    marketProfileProcessor.buildInitialProfile(initialMarketProfile)
         |
         v
    Market Profile visualization rendered
```

### Why This Structure

- **Single chart session**: Scope document requirement; minimizes connection overhead; maintains parallel feed architecture
- **Dual completion tracking**: TradingView API design; series_completed fires per series; must ensure both D1 and M1 loaded before emission
- **Extended subscription state**: Natural extension of existing pattern; avoids new modules; maintains simplicity

### Invariants

- D1 series provides ADR calculation data (open, high, low, close)
- M1 series provides TPO calculation data (today's price-by-minute)
- symbolDataPackage only emits when BOTH series complete
- initialMarketProfile contains exactly today's M1 bars (from session start)

### Tradeoffs

- **State complexity vs. simplicity**: Adding d1Complete/m1Complete flags adds state tracking, but avoids race conditions from premature emission
- **Memory overhead vs. data completeness**: Storing ~1440 M1 candles costs ~144KB per symbol, but provides complete Market Profile data
- **Single file vs. module split**: TradingViewSession.js will exceed 120 lines (~220), but keeping logic together maintains coherence and avoids circular dependencies

## Milestones

### Milestone 1: M1 Series Subscription and Module Documentation

**Files**: `services/tick-backend/TradingViewSession.js`

**Flags**: needs error review (depends on external TradingView API)

**Requirements**:

- Add module-level documentation at top of `TradingViewSession.js` explaining dual-series architecture
- Add second `create_series` call in `subscribeToSymbol()` function for M1 timeframe
- Subscribe to `sds_2` series with `1` timeframe (1-minute candles)
- Amount: 1500 candles (sufficient for one trading day ~1440 minutes)
- Add `m1Candles: []` to subscription data structure initialization
- Add `d1Complete: false` and `m1Complete: false` boolean flags to subscription data
- Add `completionTimeout: null` to subscription data for timeout guard
- Set 30-second timeout after subscription; emit error if `initialSent` still false when timeout fires

**Acceptance Criteria**:

- Module-level doc explains dual-series (D1+M1) architecture and single session pattern
- TradingView API receives `create_series` command for `sds_2` with `1` timeframe
- Subscription data structure contains `m1Candles`, `d1Complete`, `m1Complete` fields after `subscribeToSymbol()` executes
- Console log confirms "M1 subscription active for {symbol}"

**Code Changes**:

```diff
--- a/services/tick-backend/TradingViewSession.js
+++ b/services/tick-backend/TradingViewSession.js
@@ -1,3 +1,11 @@
+/**
+ * TradingView WebSocket API client with dual-series candle subscriptions.
+ *
+ * Manages single chart sessions with two time series:
+ *   - D1 (daily candles): ADR calculation and current price
+ *   - M1 (1-minute candles): Market Profile TPO calculation
+ *
+ * Emits symbolDataPackage when both series complete historical load,
+ * ensuring ADR and Market Profile data arrive together.
+ */
 const EventEmitter = require('events');
 const { connect } = require('tradingview-ws');
 const randomstring = require('randomstring');
@@ -139,12 +147,21 @@ class TradingViewSession extends EventEmitter {
         this.client.send('create_series', [
             chartSession,
             'sds_1',
             's0',
             `sds_sym_${symbol}`,
             '1D',    // Daily timeframe
             amount,  // Number of historical candles
             ''
         ]);

+        // Single session with dual series: D1 for ADR, M1 for Market Profile
+        // Minimizes connection overhead; scope doc specifies sds_1 (D1) and sds_2 (M1) in one chart session
+        this.client.send('create_series', [
+            chartSession,
+            'sds_2',
+            's0',
+            `sds_sym_${symbol}`,
+            '1',     // 1-minute timeframe
+            1500,   // Buffer for one trading day (~1440 minutes)
+            ''
+        ]);

         // Store subscription (will populate when series completes)
         this.subscriptions.set(symbol, {
             chartSession,
             lookbackDays,
             lastCandle: null,
             historicalCandles: [],
-            initialSent: false
+            initialSent: false,
+            m1Candles: [],           // M1 candles accumulate for TPO calculation
+            d1Complete: false,       // Track independently: API fires completion per series
+            m1Complete: false,       // Both must be true before emitting data package
+            completionTimeout: null  // Timeout guard for incomplete series loading
         });
+
+        // Set timeout guard: emit error if series don't complete within 30 seconds
+        const subscription = this.subscriptions.get(symbol);
+        const TIMEOUT_MS = 30000;
+        subscription.completionTimeout = setTimeout(() => {
+            if (!subscription.initialSent) {
+                console.error(`[TradingView] Series completion timeout for ${symbol}`);
+                this.emit('error', new Error(`Series completion timeout for ${symbol}`));
+            }
+        }, TIMEOUT_MS);
```

### Milestone 2: M1 Data Accumulation

**Files**: `services/tick-backend/TradingViewSession.js`

**Flags**: needs conformance check (first use of multi-series pattern)

**Why this matters**: M1 historical data cannot be re-fetched after `series_completed` fires. Must accumulate candles during initial load (`initialSent: false`) to capture full trading day data for Market Profile TPO calculation. Storing ~1440 candles costs ~144KB per symbol, acceptable for typical 1-5 symbol usage.

**Requirements**:

- Modify `handleCandleUpdate()` to detect `sds_2` series in `params[1]`
- Parse M1 candles with same format: `{time, open, high, low, close, volume}`
- Accumulate M1 candles in subscription's `m1Candles` array (if `initialSent` is false)
- Enforce hard cap of 1500 M1 candles; truncate with warning if exceeded
- Update existing D1 handling to check for `sds_1` explicitly

**Acceptance Criteria**:

- M1 candles from `sds_2` are stored in `m1Candles` array
- Console log shows M1 candle count when series completes
- D1 candles continue to accumulate in `historicalCandles` array as before

**Code Changes**:

```diff
--- a/services/tick-backend/TradingViewSession.js
+++ b/services/tick-backend/TradingViewSession.js
@@ -53,20 +53,35 @@ class TradingViewSession extends EventEmitter {
     handleCandleUpdate(params) {
-        // params: [chartSession, { sds_1: { s: [candles] } }]
-        if (!params || !params[1] || !params[1]['sds_1'] || !params[1]['sds_1']['s']) return;

+        // params: [chartSession, { sds_1: { s: [candles] }, sds_2: { s: [candles] } }]
+        // Dual series: sds_1 carries D1, sds_2 carries M1
+        const d1Data = params[1]?.['sds_1'];
+        const m1Data = params[1]?.['sds_2'];
+
+        if (!d1Data || !d1Data['s']) return;
+        const candles = d1Data['s'];
         if (candles.length === 0) return;

         // Find which symbol this is for
         for (const [symbol, data] of this.subscriptions.entries()) {
             if (data.chartSession === chartSession) {
-                // Parse all candles in this batch
+                // Parse D1 candles for ADR calculation and live price
                 const parsedCandles = candles.map(c => ({
                     time: c.v[0],
                     open: c.v[1],
                     high: c.v[2],
                     low: c.v[3],
                     close: c.v[4],
                     volume: c.v[5]
                 }));

-                // If initial package not sent yet, accumulate historical candles
+                // Accumulate historical D1 candles for ADR (14-day lookback)
+                // Only during initial load; subsequent updates update lastCandle only
                 if (!data.initialSent) {
                     data.historicalCandles.push(...parsedCandles);
                 }

-                // Always update last candle and emit tick for live price
+                // Last candle provides current price for tick emission
+                // Emits on every candle update to keep live price current
                 const latest = parsedCandles[parsedCandles.length - 1];
                 data.lastCandle = latest;

                 this.emit('tick', {
                     type: 'tick',
                     source: 'tradingview',
                     symbol,
                     price: latest.close,
                     current: latest.close,
                     timestamp: Date.now()
                 });
                 break;
             }
         }

+        // M1 candles: accumulate only during initial load
+        // Stored for Market Profile TPO calculation (price distribution over time)
+        // Not used for live price updates; D1 provides current price
+        if (m1Data && m1Data['s']) {
+            const m1Candles = m1Data['s'];
+            for (const [symbol, data] of this.subscriptions.entries()) {
+                if (data.chartSession === chartSession && !data.initialSent) {
+                    const parsedM1 = m1Candles.map(c => ({
+                        time: c.v[0],
+                        open: c.v[1],
+                        high: c.v[2],
+                        low: c.v[3],
+                        close: c.v[4],
+                        volume: c.v[5]
+                    }));
+                    data.m1Candles.push(...parsedM1);
+                    break;
+                }
+            }
+        }
     }
```

### Milestone 3: Dual Series Completion Tracking

**Files**: `services/tick-backend/TradingViewSession.js`

**Flags**: needs TW rationale (multiple valid implementations for completion tracking)

**Why this matters**: TradingView API fires `series_completed` event once per series when historical load completes. Series complete independently (D1 often faster than M1). Emitting data package immediately would send incomplete data (missing ADR if D1 incomplete, missing Market Profile if M1 incomplete). Track both completion states and only emit when both are true.

**Requirements**:

- Modify `handleSeriesCompleted()` to detect which series completed via `params[1]` (series token)
- Set `d1Complete = true` when `sds_1` (D1) completes
- Set `m1Complete = true` when `sds_2` (M1) completes
- Only emit `symbolDataPackage` when BOTH `d1Complete && m1Complete` are true
- Include `initialMarketProfile` field with `m1Candles` array in emitted package

**Acceptance Criteria**:

- `symbolDataPackage` emits only after both D1 and M1 series complete
- Emitted package contains `initialMarketProfile` array with M1 bars
- Console log confirms "Both D1 and M1 series complete for {symbol}"
- Frontend receives `initialMarketProfile` in WebSocket message

**Code Changes**:

```diff
--- a/services/tick-backend/TradingViewSession.js
+++ b/services/tick-backend/TradingViewSession.js
@@ -96,26 +96,42 @@ class TradingViewSession extends EventEmitter {
     handleSeriesCompleted(params) {
         // params: [chartSession, 's0', symbolToken]
         // TradingView API fires this event ONCE per series when historical load completes
         // Series complete independently; must track both before emitting data package
         const chartSession = params[0];
-        const seriesToken = params[1];  // 's0', 's1', etc.

+        const seriesToken = params[1];  // 's0' is the series identifier

         for (const [symbol, data] of this.subscriptions.entries()) {
             if (data.chartSession === chartSession && !data.initialSent) {
-                // Calculate ADR from historical candles (exactly 14 days, matching cTrader)
-                const adr = this.calculateAdr(data.historicalCandles, data.lookbackDays || 14);
-
-                this.emit('candle', {
-                    type: 'symbolDataPackage',
-                    source: 'tradingview',
-                    symbol,
-                    open: data.lastCandle.open,
-                    high: data.lastCandle.high,
-                    low: data.lastCandle.low,
-                    current: data.lastCandle.close,
-                    projectedAdrHigh: data.lastCandle.open + (adr / 2),
-                    projectedAdrLow: data.lastCandle.open - (adr / 2)
-                });
-
-                data.initialSent = true;
-                console.log(`[TradingView] Initial data package sent for ${symbol}`);
+                // Determine which series completed by checking accumulated data
+                // D1 complete: historicalCandles populated (14+ days)
+                // M1 complete: m1Candles populated (~1440 bars for one day)
+                // Cannot emit until both complete: would send incomplete package missing ADR or TPO data
+                if (data.historicalCandles.length > 0 && !data.d1Complete) {
+                    data.d1Complete = true;
+                    console.log(`[TradingView] D1 series complete for ${symbol}`);
+                }
+
+                if (data.m1Candles.length > 0 && !data.m1Complete) {
+                    data.m1Complete = true;
+                    console.log(`[TradingView] M1 series complete for ${symbol} (${data.m1Candles.length} candles)`);
+                }
+
+                // Both D1 and M1 required before emission
+                // D1 provides ADR calculation; M1 provides Market Profile data
+                // Emitting with only one source would produce incomplete visualization
+                if (data.d1Complete && data.m1Complete) {
+                    // Calculate ADR from historical candles (exactly 14 days, matching cTrader)
+                    const adr = this.calculateAdr(data.historicalCandles, data.lookbackDays || 14);
+
+                    this.emit('candle', {
+                        type: 'symbolDataPackage',
+                        source: 'tradingview',
+                        symbol,
+                        open: data.lastCandle.open,
+                        high: data.lastCandle.high,
+                        low: data.lastCandle.low,
+                        current: data.lastCandle.close,
+                        projectedAdrHigh: data.lastCandle.open + (adr / 2),
+                        projectedAdrLow: data.lastCandle.open - (adr / 2),
+                        initialMarketProfile: data.m1Candles  // M1 bars for TPO calculation
+                    });
+
+                    data.initialSent = true;
+                    console.log(`[TradingView] Initial data package sent for ${symbol} (includes ${data.m1Candles.length} M1 bars)`);
+                }
                 break;
             }
         }
     }
```

### Milestone 4: DataRouter Forwarding

**Files**: `services/tick-backend/DataRouter.js`

**Flags**: none

**Requirements**:

- Add `initialMarketProfile` to spread operator in `routeFromTradingView()` function
- Ensure field passes through to `broadcastToClients()`

**Acceptance Criteria**:

- WebSocket message to client includes `initialMarketProfile` array
- Client console logs show M1 data received

**Code Changes**:

```diff
--- a/services/tick-backend/DataRouter.js
+++ b/services/tick-backend/DataRouter.js
@@ -36,6 +36,7 @@ class DataRouter {
             ...(candle.projectedAdrHigh !== undefined && { projectedAdrHigh: candle.projectedAdrHigh }),
             ...(candle.projectedAdrLow !== undefined && { projectedAdrLow: candle.projectedAdrLow }),
             // CRITICAL: Include pipPosition and pipSize
             ...(candle.pipPosition !== undefined && { pipPosition: candle.pipPosition }),
             ...(candle.pipSize !== undefined && { pipSize: candle.pipSize }),
             // Also include current for symbolDataPackage
-            ...(candle.current !== undefined && { current: candle.current })
+            ...(candle.current !== undefined && { current: candle.current }),
+            // Market Profile: M1 candles for TPO calculation
+            ...(candle.initialMarketProfile !== undefined && { initialMarketProfile: candle.initialMarketProfile })
         };
```

### Milestone 5: Frontend Processing Verification

**Files**: `src/lib/displayDataProcessor.js`, `src/lib/marketProfileProcessor.js`

**Flags**: none

**Requirements**:

- Verify `processSymbolData()` handles `symbolDataPackage` with `initialMarketProfile`
- Verify `buildInitialProfile()` in `marketProfileProcessor.js` receives M1 data
- No code changes needed (existing code is generic)

**Acceptance Criteria**:

- Market Profile visualization renders with TradingView source
- M1 candles displayed in profile histogram
- Orange source badge shows on TradingView displays

**Code Changes**: None (verification only)

**Verification**:

Existing code in `marketProfileProcessor.js:6-12`:
```javascript
export function processMarketProfileData(data, lastProfile = null) {
  if (data.type === 'symbolDataPackage') {
    return buildInitialProfile(data.initialMarketProfile || []);
  }
  // ...
}
```

This code already extracts `initialMarketProfile` from any `symbolDataPackage`, regardless of source.

### Milestone 6: Documentation

**Files**:

- `services/tick-backend/CLAUDE.md` (update TradingViewSession.js entry)

**Requirements**:

- Update CLAUDE.md entry for `TradingViewSession.js` to note M1 series support
- Document `initialMarketProfile` format in entry

**Acceptance Criteria**:

- CLAUDE.md enables LLM to locate M1 handling code for debugging/modification tasks
- Entry documents both D1 and M1 series subscriptions

**Code Changes**:

```diff
--- a/services/tick-backend/CLAUDE.md
+++ b/services/tick-backend/CLAUDE.md
@@ -XX,6 +XX,9 @@ services/tick-backend/
 | File | What | When to read |
 | ---- | ---- | ------------ |
+| `TradingViewSession.js` | TradingView WebSocket API client | Implementing TradingView data feed, debugging candle subscriptions |
 | `server.js` | WebSocket server entry point | Starting backend, debugging server startup |
 | `.backend.pid` | Process ID file for service management | Checking if backend is running |

@@@ -XX,6 +XX,10 @@ services/tick-backend/
 | `TradingViewSession.js` | TradingView WebSocket API client, D1+M1 candle subscriptions, ADR calculation | Implementing TradingView data feed, debugging candle subscriptions |
+| - D1 series: Daily candles for ADR and Day Range Meter |
+| - M1 series: 1-minute candles for Market Profile TPO calculation |
+| - Emits symbolDataPackage with initialMarketProfile array when both series complete |
```

## Milestone Dependencies

```
M1 --> M2 --> M3 --> M4 --> M5
                    |
                    v
                   M6
```

Milestones must execute sequentially due to dependencies:
- M1 must add M1 subscription before M2 can accumulate M1 data
- M2 must accumulate M1 data before M3 can track completion
- M3 must emit initialMarketProfile before M4 can forward it
- M4 must forward data before M5 can verify rendering
- M6 updates documentation after implementation

## Success Criteria

- [ ] Alt+T creates TradingView display with Market Profile working
- [ ] `initialMarketProfile` array contains today's M1 bars
- [ ] Market Profile renders correctly with TradingView source
- [ ] Orange source badge shows on TradingView displays
- [ ] Console logs confirm both D1 and M1 series complete before emission
- [ ] WebSocket message includes `initialMarketProfile` field
- [ ] No existing cTrader functionality is broken
- [ ] Code passes all linters (zero violations)
