# FX Basket Alternative Architectures

**Date**: 2026-01-15
**Purpose**: Present robust alternative designs that eliminate the fundamental race condition
**Status**: Design Proposal

---

## Table of Contents

1. [Problem Recap](#problem-recap)
2. [Design 1: Snapshot-Based Initialization](#design-1-snapshot-based-initialization)
3. [Design 2: API-Based Baseline Service](#design-2-api-based-baseline-service)
4. [Comparison Matrix](#comparison-matrix)
5. [Recommendation](#recommendation)

---

## Problem Recap

### Current Implementation Flaw

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CURRENT (FLAWED)                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   WebSocket Messages (Non-deterministic Order)                          │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐             │
│   │ EURUSD  │───>│ USDJPY  │───>│ GBPUSD  │───>│ USDCHF  │             │
│   └─────────┘    └─────────┘    └─────────┘    └─────────┘             │
│        │              │              │              │                   │
│        ▼              ▼              ▼              ▼                   │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  After EACH message: initializeBaselinesFromDailyOpens()        │   │
│   │                                                                  │   │
│   │  if (coverage >= 0.5) {  ←─── 50% THRESHOLD                     │   │
│   │    basket.baselineLog = calculateValue();  ←─── LOCKS HERE!    │   │
│   │    basket.initialized = true;  ←─── PERMANENT LOCK              │   │
│   │  }                                                              │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│   Result: Different refreshes → different baselines (852% variance)     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Root Cause**: Baseline locks on first 50% coverage with whatever pairs have arrived.

---

## Design 1: Snapshot-Based Initialization

### Overview

Decouple data collection from calculation initialization by using a two-phase approach:

1. **Snapshot Phase**: Collect all daily opens into a pending buffer
2. **Initialization Phase**: Calculate baseline once from complete snapshot

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SNAPSHOT-BASED INITIALIZATION                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 1: SNAPSHOT COLLECTION                                                 │
│  ─────────────────────────                                                   │
│                                                                             │
│   WebSocket Messages                                           ┌─────────┐  │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐                   │ PENDING │  │
│   │ EURUSD  │───>│ USDJPY  │───>│ GBPUSD  │───────────────────>│ BUFFER  │  │
│   └─────────┘    └─────────┘    └─────────┘                   │ (Map)   │  │
│         │              │              │                        └─────────┘  │
│         ▼              ▼              ▼                             │        │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │  collectDailyOpen(pair, price, snapshotState)                   │      │
│   │                                                                  │      │
│   │  snapshotState.pendingDailyOpens.set(pair, price)  ←─── STORE  │      │
│   │                                                                  │      │
│   │  coverage = calculateCoverage(snapshotState)                    │      │
│   │  if (coverage >= 0.95) {  ←─── 95% THRESHOLD                   │      │
│   │    triggerInitialization(snapshotState);  ←─── TRIGGER        │      │
│   │  }                                                              │      │
│   │  OR                                                             │      │
│   │  setTimeout(15000) → triggerInitialization()  ←─── TIMEOUT     │      │
│   └─────────────────────────────────────────────────────────────────┘      │
│                                 │                                          │
│                                 ▼                                          │
│                                                                             │
│  PHASE 2: ONE-TIME INITIALIZATION                                            │
│  ────────────────────────────────                                           │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  triggerInitialization(snapshotState)                               │  │
│   │  │                                                                  │  │
│   │  ├─> snapshotState.completed = true  ←─── LOCK SNAPSHOT            │  │
│   │  ├─> clearTimeout(timeoutId)                                        │  │
│   │  │                                                                  │  │
│   │  └─> Return: {                                                       │  │
│   │        dailyOpens: new Map(pendingDailyOpens),  ←─── SNAPSHOT       │  │
│   │        coverage: 0.97,                                              │  │
│   │        isTimeout: false                                             │  │
│   │      }                                                              │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                 │                                          │
│                                 ▼                                          │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  initializeFromSnapshot(state, snapshot)                             │  │
│   │  │                                                                  │  │
│   │  ├─> for (const [pair, price] of snapshot.dailyOpens) {            │  │
│   │  │      state.dailyOpenPrices.set(pair, price);  ←─── COMMIT       │  │
│   │  │    }                                                            │  │
│   │  ├─> state.snapshotComplete = true;                                 │  │
│   │  │                                                                  │  │
│   │  └─> for (const currency of BASKET_CURRENCIES) {                   │  │
│   │        basket.baselineLog = calculateBasketValue(currency);         │  │
│   │        basket.initialized = true;  ←─── ONE-TIME LOCK              │  │
│   │      }                                                              │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   Result: Same snapshot → same baseline (deterministic)                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Flow Diagram

```
                    ┌──────────────────────┐
                    │  Page Refresh Starts │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Create Snapshot State │
                    │  - pendingDailyOpens │
                    │  - startTime = null  │
                    │  - completed = false │
                    └──────────┬───────────┘
                               │
           ┌───────────────────┴───────────────────┐
           │                                       │
           ▼                                       ▼
  ┌─────────────────┐                   ┌─────────────────┐
  │ WebSocket Msg 1 │                   │ 15s Timer Starts │
  │ (EURUSD arrives)│                   └─────────────────┘
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ collectDailyOpen│
  │ Coverage: 13%   │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ WebSocket Msg 2 │
  │ (USDJPY arrives)│
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ collectDailyOpen│
  │ Coverage: 27%   │
  └────────┬────────┘
           │
           │    ... more messages ...
           │
           ▼
  ┌─────────────────┐       ┌─────────────────┐
  │ WebSocket Msg N │       │   Timer Fires   │
  │ Coverage: 97%   │       │   (fallback)    │
  └────────┬────────┘       └────────┬────────┘
           │                         │
           ▼                         ▼
  ┌─────────────────────────────────────────┐
  │      triggerInitialization()            │
  │      (Called by coverage OR timeout)    │
  └──────────────────┬──────────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────────┐
  │    initializeFromSnapshot()             │
  │    - Commit all daily opens             │
  │    - Calculate all baselines            │
  │    - Set initialized = true             │
  └──────────────────┬──────────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────────┐
  │    Basket Updates Continue              │
  │    (Using fixed baseline)               │
  └─────────────────────────────────────────┘
```

### Key Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FILE: src/lib/fxBasket/fxBasketSnapshot.js (NEW - ~85 lines)               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  createSnapshotState()                                                      │
│    Creates: {                                                               │
│      pendingDailyOpens: Map,     // Buffer for collection                  │
│      expectedPairs: [...],       // All 30 pairs we need                   │
│      initializationTimeout: 15000,                                        │
│      initializationThreshold: 0.95,  // 95% coverage                        │
│      fallbackThreshold: 0.80,     // 80% for timeout                       │
│      startTime: null,                                                     │
│      completed: false,                                                    │
│      timeoutId: null                                                       │
│    }                                                                        │
│                                                                             │
│  collectDailyOpen(pair, price, snapshotState)                              │
│    - Adds to pendingDailyOpens buffer                                      │
│    - Starts timer on first collection                                      │
│    - Returns: true if collected, false if complete                         │
│                                                                             │
│  triggerInitialization(snapshotState)                                      │
│    - Calculates coverage from collected pairs                              │
│    - Returns snapshot if coverage >= 95% OR called by timeout              │
│    - Sets completed = true (permanent lock)                                │
│                                                                             │
│  isInitializationComplete(snapshotState)                                   │
│    - Returns: snapshotState.completed                                       │
│                                                                             │
│  getInitializationStatus(snapshotState)                                    │
│    - Returns: { status, coverage, elapsed, timeout } for UI                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Modified Files

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FILE: src/lib/fxBasket/fxBasketData.js (MODIFIED)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  initializeState(anchorTime)                                                │
│    + Add: snapshotComplete: false                                           │
│                                                                             │
│  initializeFromSnapshot(state, snapshot)  ←─── NEW FUNCTION                 │
│    + Commit snapshot to dailyOpenPrices                                     │
│    + Calculate all basket baselines from complete dataset                   │
│    + Set snapshotComplete = true                                            │
│                                                                             │
│  updatePriceInitializing(pair, price, state, snapshotState)  ←─── NEW       │
│    + Route through collectDailyOpen() during initialization                 │
│    + Trigger initialization when coverage reached                           │
│                                                                             │
│  - DELETE: initializeBaselinesFromDailyOpens()  ←─── REMOVED                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  FILE: src/lib/fxBasket/fxBasketDataProcessor.js (MODIFIED)                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  createDataCallback(...)                                                    │
│    + Add: let snapshotState = null                                          │
│                                                                             │
│  symbolDataPackage handler                                                  │
│    + Initialize snapshotState on first message                              │
│    + Route daily opens through collectDailyOpen()                           │
│    + Call triggerInitialization() and initializeFromSnapshot()             │
│    + Skip ticks during initialization phase                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Edge Case Handling

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  EDGE CASE: Missing Pairs (e.g., connection drops)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Detection    │ 15-second timeout fires                                     │
│  Fallback     │ Initialize at 80% coverage (instead of 95%)                 │
│  Warning      │ Console: "Low coverage initialization: 82%"                 │
│  Recovery     │ Next page refresh → fresh snapshot                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  EDGE CASE: Delayed Data (slow WebSocket)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Detection    │ Coverage monitoring on each message                         │
│  Behavior     │ Wait up to 15 seconds for 95% coverage                      │
│  Fallback     │ If 95% not reached in 15s, use current coverage             │
│  UI Display   │ "Initializing... (87% coverage, 3s remaining)"             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  EDGE CASE: WebSocket Disconnection                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Detection    │ ConnectionManager detects disconnect                        │
│  Behavior     │ Fresh initialization on reconnect                           │
│  Prevention   │ snapshotState.completed = true prevents re-init            │
│  Data Freshness│ New snapshot with new data                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  EDGE CASE: Extreme Latency (no pairs arrive)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Detection    │ 15-second timeout with 0% coverage                          │
│  Fallback     │ Initialize at 0% (basket shows error state)                 │
│  UI Display   │ "Initialization failed - Reconnecting..."                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Pros & Cons

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PROS                                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ✓ Eliminates race condition (complete snapshot before calculation)         │
│  ✓ Deterministic results (same snapshot = same baseline)                   │
│  ✓ Graceful degradation (timeout + fallback)                                │
│  ✓ Client-side only (no server changes required)                            │
│  ✓ Clear phase separation (Collect → Initialize → Update)                   │
│  ✓ Framework-First (uses existing WebSocket, Map, setTimeout)               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  CONS                                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ✗ Still depends on WebSocket data quality                                  │
│  ✗ Slower time to display (5-15 seconds vs 2 seconds)                      │
│  ✗ Added client complexity (~85 lines new file)                            │
│  ✗ Timeout is arbitrary (why 15 seconds?)                                  │
│  ✗ Snapshot may still be incomplete (network issues)                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Design 2: API-Based Baseline Service

### Overview

Move baseline calculation entirely to the server where data is complete and reliable.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      API-BASED BASELINE SERVICE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CLIENT SIDE (Browser)                                                      │
│  ─────────────────                                                          │
│                                                                             │
│   On Connection                                                             │
│   │                                                                        │
│   ▼                                                                        │
│   ┌───────────────────────────────────────────────────────────────────┐   │
│   │  fetch('/api/fx-basket/baseline')                                 │   │
│   │    │                                                               │   │
│   │    ├─> Check localStorage cache first                             │   │
│   │    │   if (cached && age < 5 min) return cached;                  │   │
│   │    │                                                               │   │
│   │    └─> GET http://localhost:3000/api/fx-basket/baseline           │   │
│   │          │                                                         │   │
│   │          ▼                                                         │   │
│   │        ┌─────────────────────────────────────────────┐             │   │
│   │        │  Response: {                                │             │   │
│   │        │    CHF: 0.068130,    // baselineLog         │             │   │
│   │        │    EUR: -0.023451,                         │             │   │
│   │        │    GBP: 0.014892,                          │             │   │
│   │        │    JPY: -0.089234,                         │             │   │
│   │        │    USD: 0.000000,   // baseline = 0        │             │   │
│   │        │    timestamp: 1705305600000,               │             │   │
│   │        │    coverage: 1.00  // Always 100%          │             │   │
│   │        │  }                                         │             │   │
│   │        └─────────────────────────────────────────────┘             │   │
│   │          │                                                         │   │
│   │          ▼                                                         │   │
│   │   ┌───────────────────────────────────────────────────────────┐   │   │
│   │   │  initializeBaselinesFromAPI(state, baselines)             │   │   │
│   │   │    │                                                      │   │   │
│   │   │    ├─> for (const [currency, baselineLog] of baselines) { │   │   │
│   │   │    │      const basket = state.baskets[currency];         │   │   │
│   │   │    │      basket.baselineLog = baselineLog;  ←─── SET     │   │   │
│   │   │    │      basket.currentLog = baselineLog;               │   │   │
│   │   │    │      basket.normalized = 100;                       │   │   │
│   │   │    │      basket.initialized = true;  ←─── IMMEDIATE     │   │   │
│   │   │    │      basket.coverage = 1.00;  ←─── ALWAYS 100%      │   │   │
│   │   │    │    }                                                 │   │   │
│   │   │    │                                                      │   │   │
│   │   │    └─> localStorage.setItem('fx-basket-baselines', ...); │   │   │
│   │   └───────────────────────────────────────────────────────────┘   │   │
│   └───────────────────────────────────────────────────────────────────┘   │
│                                 │                                          │
│                                 ▼                                          │
│   ┌───────────────────────────────────────────────────────────────────┐   │
│   │  Basket State Initialized (Immediate, <1 second)                 │   │
│   │                                                                  │   │
│   │  state.baskets.CHF = {                                           │   │
│   │    baselineLog: 0.068130,  ←─── FROM API                         │   │
│   │    currentLog: 0.068130,                                         │   │
│   │    normalized: 100,                                              │   │
│   │    initialized: true,                                            │   │
│   │    coverage: 1.00                                                │   │
│   │  }                                                               │   │
│   └───────────────────────────────────────────────────────────────────┘   │
│                                 │                                          │
│                                 ▼                                          │
│   ┌───────────────────────────────────────────────────────────────────┐   │
│   │  WebSocket Price Updates (Continue Normal Operation)             │   │
│   │                                                                  │   │
│   │  symbolDataPackage arrives → updatePrice() → updateAllBaskets() │   │
│   └───────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SERVER SIDE (Backend)                                                      │
│  ────────────────────                                                       │
│                                                                             │
│   GET /api/fx-basket/baseline                                               │
│   │                                                                        │
│   ▼                                                                        │
│   ┌───────────────────────────────────────────────────────────────────┐   │
│   │  1. Check Redis Cache                                             │   │
│   │     const cached = await redis.get('fx-basket-baselines');        │   │
│   │     if (cached) return JSON.parse(cached);  ←─── CACHE HIT        │   │
│   └───────────────────────────────────────────────────────────────────┘   │
│          │ (cache miss)                                                    │
│          ▼                                                                │
│   ┌───────────────────────────────────────────────────────────────────┐   │
│   │  2. Fetch All Daily Opens from cTrader                            │   │
│   │                                                                  │   │
│   │  const pairs = [                                                  │   │
│   │    'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'EURGBP',            │   │
│   │    'EURJPY', 'EURCHF', 'GBPJPY', 'GBPCHF', 'CHFJPY',            │   │
│   │    'AUDUSD', 'NZDUSD', 'USDCAD', ... (all 30 pairs)             │   │
│   │  ];                                                              │   │
│   │                                                                  │   │
│   │  const dailyOpens = {};                                          │   │
│   │  for (const pair of pairs) {                                    │   │
│   │    const candle = await ctrader.getDailyOpen(pair);             │   │
│   │    dailyOpens[pair] = candle.open;  ←─── COMPLETE DATA          │   │
│   │  }                                                               │   │
│   └───────────────────────────────────────────────────────────────────┘   │
│          │                                                                │
│          ▼                                                                │
│   ┌───────────────────────────────────────────────────────────────────┐   │
│   │  3. Calculate Basket Baselines                                    │   │
│   │                                                                  │   │
│   │  const baselines = {};                                            │   │
│   │  for (const currency of ['CHF', 'EUR', 'GBP', 'JPY', 'USD']) {   │   │
│   │    const result = calculateBasketValue(currency, dailyOpens);    │   │
│   │    baselines[currency] = result.value;  ←─── BASELINE LOG        │   │
│   │  }                                                               │   │
│   └───────────────────────────────────────────────────────────────────┘   │
│          │                                                                │
│          ▼                                                                │
│   ┌───────────────────────────────────────────────────────────────────┐   │
│   │  4. Cache in Redis (60 seconds)                                   │   │
│   │                                                                  │   │
│   │  await redis.set('fx-basket-baselines',                          │   │
│   │    JSON.stringify(baselines), 60);  ←─── CACHE FOR 1 MIN         │   │
│   └───────────────────────────────────────────────────────────────────┘   │
│          │                                                                │
│          ▼                                                                │
│   ┌───────────────────────────────────────────────────────────────────┐   │
│   │  5. Return Response                                               │   │
│   │     return { CHF: 0.06813, EUR: -0.02345, ... }                  │   │
│   └───────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Flow Diagram

```
                    ┌──────────────────────┐
                    │  Page Refresh Starts │
                    └──────────┬───────────┘
                               │
                ┌──────────────┴───────────────┐
                │                              │
                ▼                              ▼
        ┌───────────────┐           ┌─────────────────┐
        │ Check localStorage│         │  Fetch API      │
        │ Cache           │           │  /fx-basket/    │
        └───────┬─────────┘           │  baseline       │
                │                     └───────┬─────────┘
        ┌───────┴───────┐                     │
        │ Fresh?        │─── NO ──────────────┤─── YES ───┐
        │ (< 5 min old) │                               │
        └───────┬───────┘                               │
                │ YES                                   ▼
                ▼                               ┌─────────────────┐
        ┌───────────────┐                       │  Server: Check  │
        │ Use Cached    │                       │  Redis Cache    │
        │ Baselines     │                       └───────┬─────────┘
        └───────┬───────┘                               │
                │                               ┌───────┴───────┐
                │                               │ Cache Hit?     │
                │                               └───────┬───────┘
                │                                       │
                │     ┌─────────────────┬────────────────┘
                │     │                 │
                │   NO │               YES│
                │     ▼                 ▼
                │ ┌─────────────┐  ┌─────────────┐
                │ │ Fetch from  │  │ Return      │
                │ │ cTrader API │  │ Cached      │
                │ │ (All 30     │  │ Baselines   │
                │ │ pairs)      │  └──────┬──────┘
                │ └──────┬──────┘         │
                │        │                │
                │        ▼                │
                │ ┌─────────────┐         │
                │ │ Calculate   │         │
                │ │ All 5       │         │
                │ │ Baselines   │         │
                │ └──────┬──────┘         │
                │        │                │
                │        ▼                │
                │ ┌─────────────┐         │
                │ │ Cache in    │         │
                │ │ Redis 60s   │         │
                │ └──────┬──────┘         │
                │        │                │
                └───┬────┴────────────────┘
                    ▼
          ┌─────────────────────┐
          │ Initialize Baskets  │
          │ (Immediate, <1s)    │
          └──────────┬──────────┘
                     │
                     ▼
          ┌─────────────────────┐
          │ WebSocket Updates   │
          │ (Normal Operation)  │
          └─────────────────────┘
```

### Key Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CLIENT: src/lib/fxBasket/fxBasketBaselineAPI.js (NEW - ~60 lines)          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  async function fetchBaselinesFromAPI()                                     │
│    - Check localStorage cache first (5 min expiry)                         │
│    - Fetch from /api/fx-basket/baseline if cache miss/stale                │
│    - Parse response: { CHF, EUR, GBP, JPY, USD, timestamp, coverage }      │
│    - Store in localStorage                                                  │
│    - Returns: baselines object                                              │
│                                                                             │
│  function isCacheStale(cachedData)                                          │
│    - Returns: true if age > 5 minutes                                       │
│                                                                             │
│  function getBaselinesFromCache()                                           │
│    - Returns: cached baselines or null                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  CLIENT: src/lib/fxBasket/fxBasketData.js (MODIFIED)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  async function initializeBaselinesFromAPI(state)                           │
│    - Calls fetchBaselinesFromAPI()                                          │
│    - Sets basket.baselineLog for all currencies                             │
│    - Sets basket.initialized = true                                         │
│    - Sets basket.coverage = 1.00                                            │
│    - Error handling → fallback to cache or show warning                     │
│                                                                             │
│  - DELETE: initializeBaselinesFromDailyOpens()  ←─── REMOVED                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  CLIENT: src/lib/fxBasket/fxBasketDataProcessor.js (MODIFIED)               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  createDataCallback(...)                                                    │
│    + Add: await initializeBaselinesFromAPI(basketState) on first message    │
│    + Remove: initializeBaselinesFromDailyOpens() calls                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  SERVER: services/fxBasket/fxBasketBaselineService.js (NEW - ~100 lines)    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  async function getBasketBaselines(redis)                                   │
│    - Check Redis cache: 'fx-basket-baselines'                               │
│    - If cache hit: return cached data                                       │
│    - If cache miss:                                                         │
│      1. Fetch all 30 pair daily opens from cTrader                          │
│      2. Calculate baselines for all 5 currencies                            │
│      3. Cache in Redis for 60 seconds                                       │
│      4. Return baselines                                                    │
│                                                                             │
│  async function fetchAllDailyOpens(ctrader)                                 │
│    - Parallel fetch all 30 pairs                                            │
│    - Returns: { EURUSD: 1.0852, GBPUSD: 1.2734, ... }                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  SERVER: routes/fxBasketRoutes.js (NEW - ~30 lines)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  router.get('/baseline', async (req, res) =>                                │
│    - Calls getBasketBaselines(redis)                                       │
│    - Returns JSON: { baselines, timestamp, coverage }                       │
│    - Error handling: 500 if cTrader unavailable                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  DATA STRUCTURES                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  API Response Format:                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  GET /api/fx-basket/baseline                                       │   │
│  │                                                                     │   │
│  │  Response (200 OK):                                                │   │
│  │  {                                                                 │   │
│  │    "baselines": {                                                  │   │
│  │      "CHF": 0.068130,      // baselineLog for CHF basket           │   │
│  │      "EUR": -0.023451,     // baselineLog for EUR basket           │   │
│  │      "GBP": 0.014892,      // baselineLog for GBP basket           │   │
│  │      "JPY": -0.089234,     // baselineLog for JPY basket           │   │
│  │      "USD": 0.000000       // baselineLog for USD basket           │   │
│  │    },                                                             │   │
│  │    "timestamp": 1705305600000,  // Unix timestamp                  │   │
│  │    "coverage": 1.00               // Always 100%                   │   │
│  │  }                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  localStorage Cache Format:                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Key: 'fx-basket-baselines'                                        │   │
│  │  Value: {                                                           │   │
│  │    baselines: { CHF: 0.06813, EUR: -0.02345, ... },               │   │
│  │    timestamp: 1705305600000                                        │   │
│  │  }                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Redis Cache Format:                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Key: 'fx-basket-baselines'                                        │   │
│  │  Value: JSON.stringify({                                           │   │
│  │    baselines: { CHF: 0.06813, EUR: -0.02345, ... },               │   │
│  │    timestamp: 1705305600000                                        │   │
│  │  })                                                                 │   │
│  │  TTL: 60 seconds                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Edge Case Handling

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  EDGE CASE: API Unavailable (server down or error)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Detection    │ fetch() throws error or returns 500                        │
│  Fallback     │ Use localStorage cache if available                         │
│  Warning      │ UI: "Using cached baselines (3 min old)"                   │
│  Recovery     │ Retry on next page refresh                                 │
│                                                                             │
│  Code:                                                                  │
│  try {                                                                     │
│    const baselines = await fetch('/api/fx-basket/baseline');              │
│  } catch (error) {                                                         │
│    const cached = localStorage.getItem('fx-basket-baselines');            │
│    if (cached) {                                                           │
│      console.warn('Using cached baselines due to API error');             │
│      return JSON.parse(cached);                                            │
│    }                                                                       │
│    throw new Error('No baselines available');                              │
│  }                                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  EDGE CASE: cTrader API Unavailable (backend)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Detection    │ fetchAllDailyOpens() throws error                           │
│  Fallback     │ Return stale Redis cache if available                      │
│  Response     │ 500 Internal Server Error with message                     │
│  Recovery     │ Next request after 60s will retry                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  EDGE CASE: Stale Cache (client offline)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Detection    │ isCacheStale() returns true                                 │
│  Behavior     │ Attempt API fetch, fail gracefully to cache                │
│  UI Display   │ "Offline - Using cached baselines (6 min old)"             │
│  Recovery     │ API succeeds when back online                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  EDGE CASE: High Load (many concurrent requests)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Detection    │ Redis cache miss during high traffic                       │
│  Behavior     │ Multiple requests may fetch from cTrader                   │
│  Mitigation   │ Redis cache set for 60s (99%+ cache hit rate)              │
│  Optimization │ Add cache lock if needed (single fetcher)                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Pros & Cons

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PROS                                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ✓ Eliminates root cause completely (no WebSocket dependency)              │
│  ✓ True 100% coverage (server has complete data)                           │
│  ✓ Fast initialization (<1 second vs 5-15 seconds)                         │
│  ✓ Cross-session consistency (built-in via localStorage)                   │
│  ✓ Simple client implementation (~60 lines)                                │
│  ✓ Deterministic and mathematically sound                                  │
│  ✓ Graceful degradation (API → localStorage cache → error)                 │
│  ✓ Server-side caching reduces load (Redis)                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  CONS                                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ✗ New API endpoint (single point of failure)                              │
│  ✗ Server-side changes required (~150 lines)                               │
│  ✗ Adds Redis dependency (optional but recommended)                        │
│  ✗ Network dependency for baseline initialization                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Comparison Matrix

### Feature Comparison

| Feature | Current | Snapshot-Based | API-Based |
|---------|---------|----------------|-----------|
| **Deterministic** | ❌ No (852% variance) | ✅ Yes | ✅ Yes |
| **Coverage** | 50-100% (variable) | 80-100% (timeout) | **100% (always)** |
| **Time to Display** | ~2 seconds | 5-15 seconds | **<1 second** |
| **WebSocket Dependency** | ❌ Yes (problematic) | ⚠️ Yes (mitigated) | **No** |
| **Message Order Dependency** | ❌ Yes (critical flaw) | ✅ No | ✅ No |
| **Client Complexity** | Low (~100 lines) | Medium (~180 lines) | **Low (~60 lines)** |
| **Server Changes Required** | No | No | Yes (~150 lines) |
| **Cross-Session Consistency** | ❌ No | ❌ No | ✅ Yes (cache) |
| **Single Point of Failure** | No | No | ⚠️ API (mitigated) |
| **Graceful Degradation** | ❌ No | ✅ Yes (timeout) | ✅ Yes (cache) |
| **Mathematical Soundness** | ❌ Flawed | ✅ Sound | ✅ Sound |

### Code Impact Comparison

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CODE CHANGES SUMMARY                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SNAPSHOT-BASED                                                             │
│  ────────────────                                                           │
│  Files Created:   1  (fxBasketSnapshot.js)                                  │
│  Files Modified:   2  (fxBasketData.js, fxBasketDataProcessor.js)           │
│  Lines Added:     ~85 (new file) + ~50 (modifications) = ~135 total        │
│  Lines Removed:   ~30 (initializeBaselinesFromDailyOpens)                   │
│  Net Change:      +105 lines                                                │
│  Server Changes:  None                                                      │
│                                                                             │
│  API-BASED                                                                  │
│  ────────────                                                               │
│  Files Created:   2  (fxBasketBaselineAPI.js, fxBasketBaselineService.js)   │
│  Files Modified:   2  (fxBasketData.js, fxBasketDataProcessor.js)           │
│  Lines Added:     ~60 (client) + ~130 (server) = ~190 total                │
│  Lines Removed:   ~30 (initializeBaselinesFromDailyOpens)                   │
│  Net Change:      +160 lines                                                │
│  Server Changes:  Yes (new endpoint + service)                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Risk Assessment

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  RISK COMPARISON                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Risk Factor              │ Snapshot │ API-Based │ Current                 │
│  ──────────────────────────┼──────────┼───────────┼────────────────         │
│  Implementation Risk      │ LOW      │ MEDIUM    │ N/A                     │
│  (complexity, effort)      │          │           │                         │
│                             │          │           │                         │
│  Runtime Failure Risk      │ LOW      │ LOW-MED   │ HIGH                    │
│  (crashes, errors)         │          │           │ (inconsistent results)   │
│                             │          │           │                         │
│  Data Quality Risk         │ MEDIUM   │ LOW       │ HIGH                    │
│  (incomplete baseline)     │          │           │ (variable coverage)      │
│                             │          │           │                         │
│  Dependency Risk           │ LOW      │ MEDIUM    │ LOW                     │
│  (external services)        │          │ (API)     │                         │
│                             │          │           │                         │
│  Performance Risk          │ LOW      │ LOW       │ LOW                     │
│  (slow initialization)      │          │           │                         │
│                             │          │           │                         │
│  Maintenance Risk          │ LOW      │ MEDIUM    │ HIGH                    │
│  (future changes, bugs)     │          │ (server)  │ (hidden race condition)  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Recommendation

### Primary Recommendation: API-Based Baseline Service

**Rationale:**

1. **Eliminates the root cause completely** - No dependency on WebSocket message order or daily open arrival timing

2. **True 100% coverage** - Server has access to all pair data via cTrader API, ensuring complete baseline calculation

3. **Fastest time to display** - <1 second initialization vs 5-15 seconds for snapshot approach

4. **Best user experience** - Immediate basket display, no "Initializing..." delay

5. **Cross-session consistency** - Built-in via localStorage caching

6. **Simplest client implementation** - ~60 lines vs ~180 lines for snapshot

7. **Graceful degradation** - API → localStorage cache → error with clear messaging

**Trade-offs:**

- Requires server-side implementation (~150 lines)
- Introduces API endpoint (single point of failure, but mitigated by caching)

### Secondary Option: Snapshot-Based Initialization

**Use when:**

- Server-side changes are not possible
- Want to keep architecture client-side only
- Can accept 5-15 second initialization delay

**Rationale:**

- Eliminates race condition via phase separation
- More deterministic than current implementation
- Graceful degradation with timeout fallback
- No server changes required

### Against: Current 3-Phase Proposal

**Not recommended because:**

- Phase 1 (Coverage Display) - Doesn't fix the problem, just shows it
- Phase 2 (95% + Timeout) - Still depends on non-deterministic message order
- Phase 3 (Cache) - Adds complexity without fixing root cause

This is a "patch around the edges" approach that addresses symptoms but leaves the fundamental flaw intact.

---

## Implementation Timeline

### API-Based Approach

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: Server Implementation (2-4 hours)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ✓ Create fxBasketBaselineService.js                                        │
│  ✓ Create fxBasketRoutes.js                                                 │
│  ✓ Add Redis caching                                                        │
│  ✓ Test endpoint with curl/Postman                                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 2: Client Implementation (1-2 hours)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ✓ Create fxBasketBaselineAPI.js                                            │
│  ✓ Modify fxBasketData.js                                                   │
│  ✓ Modify fxBasketDataProcessor.js                                          │
│  ✓ Add localStorage caching                                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 3: Testing (1-2 hours)                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  ✓ Unit tests for API client                                                │
│  ✓ Integration tests for API endpoint                                       │
│  ✓ Manual testing: 10x refresh to verify consistency                        │
│  ✓ Test API failure scenarios                                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 4: Deployment & Monitoring (ongoing)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ✓ Deploy to staging environment                                            │
│  ✓ Monitor API response times                                               │
│  ✓ Monitor Redis cache hit rate                                             │
│  ✓ Deploy to production                                                    │
└─────────────────────────────────────────────────────────────────────────────┘

TOTAL ESTIMATE: 4-8 hours
```

### Snapshot-Based Approach

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: Snapshot Manager (1-2 hours)                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ✓ Create fxBasketSnapshot.js                                               │
│  ✓ Implement collectDailyOpen()                                             │
│  ✓ Implement triggerInitialization()                                        │
│  ✓ Unit tests                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 2: Data Manager Refactoring (1 hour)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ✓ Add initializeFromSnapshot() to fxBasketData.js                          │
│  ✓ Remove initializeBaselinesFromDailyOpens()                               │
│  ✓ Add snapshotComplete tracking                                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 3: Data Processor Updates (30 minutes)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  ✓ Add snapshotState to callback                                            │
│  ✓ Route through collectDailyOpen()                                         │
│  ✓ Skip ticks during initialization                                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 4: Testing (1-2 hours)                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  ✓ Integration tests for initialization flow                                │
│  ✓ Test timeout fallback                                                    │
│  ✓ Manual testing: 10x refresh to verify consistency                        │
└─────────────────────────────────────────────────────────────────────────────┘

TOTAL ESTIMATE: 3-5 hours
```

---

## Appendix: Mathematical Proof of Issue

### Why Current Implementation is Fundamentally Flawed

For CHF basket with weights `[30, 35, 16, 8, 5, 4, 2]`:

```
Scenario A (EURUSD, USDCHF arrive first):
baselineLog = (30/100)*ln(EURUSD) + (35/100)*ln(USDCHF)
            = 0.30*ln(1.0850) + 0.35*ln(0.8765)
            = 0.30*(-0.0816) + 0.35*(-0.1314)
            = -0.0245 - 0.0460
            = -0.0705

Scenario B (EURUSD, GBPUSD, USDJPY arrive first):
baselineLog = (30/100)*ln(EURUSD) + (8/100)*ln(GBPUSD) + (35/100)*ln(USDJPY)
            = 0.30*ln(1.0850) + 0.08*ln(1.2734) + 0.35*ln(149.25)
            = 0.30*(-0.0816) + 0.08*(0.2415) + 0.35*(5.005)
            = -0.0245 + 0.0193 + 1.7518
            = 1.7466

DIFFERENCE: 1.7466 - (-0.0705) = 1.8171 (1817% variation!)
```

**Conclusion**: Different subsets of pairs produce mathematically different baselines. Since WebSocket message order is non-deterministic, the baseline is also non-deterministic.

### Why Both Alternatives Fix the Issue

**Snapshot-Based**: Uses complete snapshot (95-100% coverage) before calculation
→ Same subset of pairs always used → Deterministic baseline

**API-Based**: Server fetches ALL pairs before calculation
→ Same complete dataset always used → Deterministic baseline

---

**Document Version**: 1.0
**Last Updated**: 2026-01-15
**Author**: Claude (Architecture Agent + Analysis)
