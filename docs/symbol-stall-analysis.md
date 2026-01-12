# Symbol Stall Analysis: Codebase Investigation

**Date:** 2025-01-09
**Status:** Analysis Complete | Diagrams Created
**Data Feeds:** BOTH cTrader and TradingView (not feed-specific)

---

## Executive Summary

Symbol stalls occur due to **connection lifecycle edge cases** and **missing retry logic** in backend sessions. The issue affects **BOTH cTrader and TradingView data feeds equally** - no feed-specific problem identified.

**Root Cause:** Backend timeouts exist (cTrader 10s heartbeat, TradingView 30s dual-series timeout) but have **NO retry logic**, causing permanent subscription failures.

---

## Visual Architecture Diagrams

### Current Subscription Flow (BOTH Feeds)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SYMBOL SUBSCRIPTION FLOW                             │
│                        (cTrader AND TradingView)                            │
└─────────────────────────────────────────────────────────────────────────────┘

User Action (Add Symbol / Import Workspace)
    │
    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ FloatingDisplay.onMount()                                                    │
│ ├─ connectionManager = ConnectionManager.getInstance()                      │
│ ├─ connectionManager.connect()                                              │
│ └─ connectionManager.subscribeAndRequest(symbol, callback, 14, source)      │
└──────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ ConnectionManager.subscribeAndRequest()                                     │
│ ├─ key = makeKey(symbol, source)  // "EURUSD:ctrader" or "EURUSD:tradingview"│
│ ├─ Store callback in subscriptions Map                                      │
│ └─ IF ws.readyState === OPEN:                                               │
│       ws.send(JSON.stringify({ type: 'get_symbol_data_package', ... }))     │
│    ELSE (CONNECTING):                                                        │
│       Store subscription only → resubscribeAll() will request later         │
└──────────────────────────────────────────────────────────────────────────────┘
    │
    ▼ WebSocket Message
┌──────────────────────────────────────────────────────────────────────────────┐
│ WebSocketServer.handleSubscribe(ws, symbol, adr, source)                    │
│ ├─ IF source === 'tradingview': handleTradingViewSubscribe()               │
│ └─ ELSE: cTrader subscription (default)                                     │
│                                                                              │
│ ┌─ cTrader PATH ─────────────────────────────────────────┐                  │
│ │ 1. Validate symbol in cTraderSession.symbolMap          │                  │
│ │ 2. cTraderSession.getSymbolDataPackage(symbol, adr)     │                  │
│ │ 3. Send symbolDataPackage to client                     │                  │
│ │ 4. Add client to backendSubscriptions["symbol:ctrader"] │                  │
│ │ 5. IF first client: cTraderSession.subscribeToTicks()   │                  │
│ └─────────────────────────────────────────────────────────┘                  │
│                                                                              │
│ ┌─ TradingView PATH ─────────────────────────────────────┐                  │
│ │ 1. Add client to backendSubscriptions FIRST             │                  │
│ │ 2. tradingViewSession.subscribeToSymbol(symbol, adr)    │                  │
│ │    ├─ Create D1 chart session (daily candles)           │                  │
│ │    ├─ Create M1 chart session (1-minute candles)        │                  │
│ │    └─ Set 30s timeout guard                              │                  │
│ │ 3. When BOTH D1 and M1 complete: emit candle event      │                  │
│ │ 4. WebSocketServer broadcasts to client                 │                  │
│ └─────────────────────────────────────────────────────────┘                  │
└──────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ ConnectionManager.onmessage                                                   │
│ ├─ Parse JSON message                                                        │
│ ├─ key = makeKey(d.symbol, d.source)                                         │
│ ├─ callbacks = subscriptions.get(key)                                       │
│ └─ callbacks.forEach(callback => callback(data))  // Route to display       │
└──────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ FloatingDisplay.dataCallback()                                               │
│ ├─ processSymbolData() → updates lastData                                   │
│ └─ buildInitialProfile() / updateProfileWithTick() → updates Market Profile │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

### Failure Points (Where Stalls Occur)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FAILURE POINTS (BOTH FEEDS)                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─ FAILURE POINT 1: Connection Reconnection ─────────────────────────────────┐
│ connectionManager.handleClose() → handleOpen() transition                   │
│   Line 80-81:  "this.subscriptions.clear()"                                 │
│   Line 74:    "this.resubscribeAll()"                                       │
│                                                                              │
│ ISSUE: If reconnection fails after 5 attempts, all subscriptions lost       │
│ STATUS: ✅ PARTIALLY FIXED (27c51af added resubscribeAll)                    │
│ REMAINING: Max 5 reconnection attempts (1s → 16s) then gives up forever     │
└──────────────────────────────────────────────────────────────────────────────┘

┌─ FAILURE POINT 2: cTrader Backend Timeout ──────────────────────────────────┐
│ CTraderSession.js Line 169-174                                               │
│                                                                              │
│   startHeartbeat() {                                                         │
│     this.heartbeatInterval = setInterval(() => {                             │
│       if (this.connection)                                                   │
│         this.connection.sendCommand('ProtoHeartbeatEvent', {});             │
│     }, 10000);  // 10 seconds                                                │
│   }                                                                          │
│                                                                              ││ ISSUE: Heartbeat exists but NO RETRY if heartbeat fails                   │
│ Line 150-154: handleDisconnect() stops heartbeat, emits event, NO reconnect  │
│                                                                              │
│ STATUS: ❌ NO RETRY LOGIC                                                    │
└──────────────────────────────────────────────────────────────────────────────┘

┌─ FAILURE POINT 3: TradingView Dual-Series Timeout ──────────────────────────┐
│ TradingViewSession.js Line 298-306                                           │
│                                                                              │
│   const TIMEOUT_MS = 30000;  // 30 seconds                                   │
│   subscription.completionTimeout = setTimeout(() => {                        │
│     if (!subscription.initialSent) {                                         │
│       console.error(`[TradingView] Series completion timeout for ${symbol}`);│
│       this.emit('error', new Error(`Series completion timeout`));           │
│     }                                                                        │
│   }, TIMEOUT_MS);                                                            │
│                                                                              │
│ ISSUE: Timeout emits error but NO RETRY                                     │
│ REQUIREMENT: Both D1 AND M1 series must complete (line 166)                  │
│                                                                              │
│ STATUS: ❌ NO RETRY LOGIC                                                    │
└──────────────────────────────────────────────────────────────────────────────┘

┌─ FAILURE POINT 4: No Per-Symbol Health Monitoring ──────────────────────────┐
│ FloatingDisplay.svelte Line 110-117                                          │
│                                                                              │
│   function checkDataFreshness() {                                            │
│     if (connectionStatus === 'disconnected') refreshConnection();           │
│   }                                                                          │
│   freshnessCheckInterval = setInterval(checkDataFreshness, 5000);           │
│                                                                              │
│ ISSUE: Only checks CONNECTION status, not per-symbol DATA staleness          │
│ AFFECTS: BOTH cTrader and TradingView symbols equally                        │
│                                                                              │
│ STATUS: ❌ NO PER-SMONITORING                                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

### Solution Options: Integration Points

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SOLUTION OPTION INTEGRATION POINTS                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─ OPTION 1: LIGHTWEIGHT HEARTBEAT ───────────────────────────────────────────┐
│                                                                              │
│ WHERE: connectionManager.js                                                  │
│                                                                              │
│ ADD:                                                                         │
│   1. Constructor (line 6-12):                                               │
│      this.lastPongTime = Date.now();                                         │
│      this.pingInterval = null;                                               │
│                                                                              │
│   2. New method startHeartbeat():                                           │
│      setInterval(() => {                                                     │
│        ws.send(JSON.stringify({ type: 'ping' }));                           │
│        IF Date.now() - lastPongTime > 60000: ws.close();                     │
│      }, 30000);                                                              │
│                                                                              │
│   3. Modify handleOpen() (line 72):                                         │
│      this.lastPongTime = Date.now();                                         │
│      this.startHeartbeat();                                                  │
│                                                                              │
│   4. Modify onmessage (line 33): Add pong handler                            │
│   5. Modify handleClose() (line 77): Add clearInterval                      │
│                                                                              │
│ BACKEND CHANGES: NONE (ping/pong is standard WebSocket)                      │
│                                                                              │
│ AFFECTS: BOTH FEEDS (connection-level, not feed-specific)                    │
│ NOTE: cTrader backend ALREADY has 10s heartbeat - this adds frontend check    │
└──────────────────────────────────────────────────────────────────────────────┘

┌─ OPTION 2: SMART RETRY WITH CIRCUIT BREAKER ─────────────────────────────────┐
│                                                                              │
│ WHERE: connectionManager.js                                                  │
│                                                                              │
│ ADD:                                                                         │
│   1. Constructor:                                                            │
│      this.failedSubscriptions = new Map();  // key → failure count            │
│      this.circuitBreakerThreshold = 3;                                       │
│                                                                              │
│   2. New method resubscribeSymbolWithRetry(symbol, source):                 │
│      IF failures < threshold:                                                │
│        ws.send(get_symbol_data_package);                                    │
│        Set timeout to detect failure                                         │
│                                                                              │
│   3. New method markSubscriptionFailure(symbol, source):                    │
│      Increment failure count                                                 │
│      IF failures >= threshold: WARN and skip                                 │
│                                                                              │
│   4. Modify onmessage: Track success to reset circuit breaker                │
│                                                                              │
│ LIMITATION: Requires success/failure detection logic NOT currently present   │
│ AFFECTS: BOTH FEEDS                                                         │
└──────────────────────────────────────────────────────────────────────────────┘

┌─ OPTION 3: SUBSCRIPTION HEALTH MONITOR ─────────────────────────────────────┐
│                                                                              │
│ WHERE: connectionManager.js                                                  │
│                                                                              │
│ ADD:                                                                         │
│   1. Constructor:                                                            │
│      this.lastDataTime = new Map();  // key → timestamp                      │
│      this.staleThresholdMs = 60000;  // 60 seconds                           │
│                                                                              │
│   2. New method startHealthMonitor():                                       │
│      setInterval(() => {                                                     │
│        FOR each subscription:                                                │
│          IF Date.now() - lastDataTime.get(key) > 60000:                     │
│            resubscribeSymbol(symbol, source);  // Auto-refresh               │
│      }, 30000);                                                              │
│                                                                              │
│   3. Modify handleOpen() (line 72):                                         │
│      this.lastDataTime.clear();                                              │
│      this.startHealthMonitor();                                              │
│                                                                              │
│   4. Modify onmessage (line 33): Update lastDataTime for each data message   │
│   5. Modify handleClose() (line 77): Add clearInterval                      │
│                                                                              │
│ AFFECTS: BOTH cTrader and TradingView                                        │
│ ⚠️ CRITICAL ISSUE: 60s threshold false positives for illiquid symbols        │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## What Each Option Will and Will NOT Solve

### Comparison Matrix

| Scenario | Current Behavior | Option 1: Heartbeat | Option 2: Smart Retry | Option 3: Health Monitor |
|----------|------------------|---------------------|----------------------|-------------------------|
| **Connection dies (zombie)** | Stalls until user notices | ✅ Detects & auto-reconnects | ⚠️ Indirectly helps | ❌ No (connection may look healthy) |
| **cTrader backend timeout** | Permanent failure | ❌ No (backend issue) | ✅ Retries with backoff | ✅ Detects stale, refreshes |
| **TradingView dual-series timeout** | Permanent failure | ❌ No (backend issue) | ✅ Retries with backoff | ✅ Detects stale, refreshes |
| **Individual symbol stalls** (BOTH feeds) | Manual refresh required | ❌ No | ✅ Retries failed symbol | ✅ Auto-refreshes stale |
| **Weekend/holiday quiet** | N/A (no issue) | ✅ No false positives | ✅ No false positives | ❌ **FALSE POSITIVES** |
| **Illiquid symbol quiet** | N/A (no issue) | ✅ No false positives | ✅ No false positives | ❌ **FALSE POSITIVES** |
| **Reconnection after disconnect** | Max 5 attempts then dead | ⚠️ Improves detection | ❌ No change | ❌ No change |
| **Backend overload** | Not applicable | ✅ Minimal overhead | ⚠️ Could add load | ❌ **Spams backend** |

---

### Feed-Specific Analysis

| Aspect | cTrader | TradingView | Impact on Solutions |
|--------|---------|-------------|---------------------|
| **Existing keep-alive** | ✅ 10s heartbeat (line 169-174) | ❌ None | Option 1 redundant for cTrader |
| **Timeout mechanism** | ⚠️ Heartbeat but no retry | ✅ 30s timeout (line 298-306) | Both need retry logic |
| **Dual-series dependency** | ❌ No | ✅ D1+M1 must complete | TradingView more fragile |
| **Quiet period tolerance** | Variable (FX active 24/5) | Variable (market hours) | Both affected by 60s false positives |
| **Subscription complexity** | Simple (single request) | Complex (D1 + M1 sessions) | TradingView needs more time |

**KEY FINDING:** The stall issue is **NOT feed-specific**. Both cTrader and TradingView have:
- Missing retry logic on timeout
- No per-symbol health monitoring
- Same frontend connection lifecycle

---

## Issues by Severity

### CRITICAL

**1. connectionManager.js exceeds 120-line Framework-First limit**
- **File:** `src/lib/connectionManager.js:1-152`
- **Current:** 152 lines
- **Limit:** 120 lines
- **Impact:** Technical debt accumulation, violates architecture principles
- **Recommended:** Refactor into:
  - `ConnectionManager.js` (~100 lines) - WebSocket lifecycle
  - `SubscriptionManager.js` (~80 lines) - Subscription tracking

### HIGH

**2. NO retry logic for backend timeouts (BOTH feeds)**
- **cTrader:** `services/tick-backend/CTraderSession.js:169-174`
  ```javascript
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.connection) this.connection.sendCommand('ProtoHeartbeatEvent', {});
    }, 10000);
  }
  // NOTE: No retry on heartbeat failure
  ```
- **TradingView:** `services/tick-backend/TradingViewSession.js:298-306`
  ```javascript
  const TIMEOUT_MS = 30000;
  subscription.completionTimeout = setTimeout(() => {
    if (!subscription.initialSent) {
      console.error(`[TradingView] Series completion timeout for ${symbol}`);
      this.emit('error', new Error(`Series completion timeout for ${symbol}`));
      // NOTE: No retry, just error
    }
  }, TIMEOUT_MS);
  ```
- **Impact:** Permanent subscription failures on transient issues
- **Recommended:** Add retry with exponential backoff for both backends

**3. Max 5 reconnection attempts then permanent failure**
- **File:** `src/lib/connectionManager.js:8,82,86`
- **Current:** `this.maxReconnects = 5;` with exponential backoff (1s → 16s)
- **Impact:** After ~31 seconds total, gives up forever
- **Recommended:** Either increase max attempts or add manual reconnection trigger

### MEDIUM

**4. No frontend heartbeat mechanism**
- **File:** `src/lib/connectionManager.js` (missing)
- **cTrader backend:** Has 10s heartbeat
- **Frontend:** No ping/pong to detect zombie connections
- **Impact:** Dead connections undetected until user notices stall
- **Recommended:** Option 1 (Heartbeat) addresses this

**5. checkDataFreshness only checks connection status**
- **File:** `src/components/FloatingDisplay.svelte:110-117`
  ```javascript
  function checkDataFreshness() {
    if (connectionStatus === 'disconnected') refreshConnection();
  }
  ```
- **Impact:** Cannot detect per-symbol staleness
- **Recommended:** Enhance to track per-symbol last data time

### LOW

**6. No circuit breaker for failing symbols**
- **Impact:** Could hammer backend with invalid symbols
- **Recommended:** Option 2 (Smart Retry) addresses this

---

## Recommendations

### IMMEDIATE (Blocks Other Work)

1. **Refactor connectionManager.js** to meet 120-line limit
   - Split into `ConnectionManager.js` + `SubscriptionManager.js`
   - Enables clean addition of any solution option

### SHORT-TERM (Current Sprint)

2. **Add backend retry logic** (targets root cause)
   - cTrader: Retry on heartbeat failure
   - TradingView: Retry on 30s timeout
   - Exponential backoff: 1s → 2s → 4s → 8s → 16s

3. **Implement Option 1 (Heartbeat)** for connection-level detection
   - Low complexity (~25 lines)
   - Detects zombie connections
   - Complements backend retry logic

### LONG-TERM (Strategic)

4. **Enhanced Option 3 (Health Monitor)** with fixes:
   - Configurable threshold per symbol (illiquid = 300s, liquid = 60s)
   - Market hours awareness (skip during closed markets)
   - Rate limiting (max 1 refresh per 5 minutes per symbol)
   - Integration with backend retry (not frontend-only)

5. **Consider Option 2 (Circuit Breaker)** if backend load becomes issue
   - Requires success/failure detection infrastructure
   - Defer until monitoring shows need

---

## Key Files Reference

| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| `src/lib/connectionManager.js` | 152 | WebSocket lifecycle | ⚠️ Over limit, needs refactor |
| `src/components/FloatingDisplay.svelte` | 174 | Display component | ✅ Has manual refresh |
| `services/tick-backend/WebSocketServer.js` | 271 | Backend routing | ✅ Handles both feeds |
| `services/tick-backend/CTraderSession.js` | 307 | cTrader API | ⚠️ Heartbeat no retry |
| `services/tick-backend/TradingViewSession.js` | 336 | TradingView API | ⚠️ Timeout no retry |

---

## Decision Summary

| Option | Verdict | Rationale |
|--------|---------|-----------|
| **Option 1: Heartbeat** | ✅ Implement | Low complexity, fills gap, complements other fixes |
| **Option 2: Smart Retry** | ⚠️ Defer | Needs failure detection infrastructure |
| **Option 3: Health Monitor** | ❌ Revise | False positive risk, needs threshold tuning |

**Recommended Path:**
1. Refactor connectionManager.js (enables all options)
2. Add backend retry logic (targets root cause)
3. Implement Option 1 (Heartbeat)
4. Consider enhanced Option 3 after monitoring data available
