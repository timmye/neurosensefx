# Market Profile Architectural Forensic Review

**Date:** 2026-01-21
**Status:** Complete - Root Cause Identified (Corrected)
**Reviewer:** Claude Code Forensic Analysis

---

## Executive Summary

This document provides a complete architectural forensic review of the Market Profile implementation in NeuroSense FX. The review identifies **why the profile changes appearance** when ticks arrive versus when manually refreshed.

**Root Cause Identified:** Data representation mismatch - M1 bars generate full price range levels (dense), while ticks only increment bid price levels (sparse).

**IMPORTANT:** The canvas IS re-rendering correctly. The issue is not reactivity failure, but fundamentally different data aggregation methods.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Data Flow Diagrams](#2-data-flow-diagrams)
3. [Processing Pipeline](#3-processing-pipeline)
4. [Display/Rendering Pipeline](#4-displayrendering-pipeline)
5. [Root Cause Analysis](#5-root-cause-analysis)
6. [Hypotheses Evaluation](#6-hypotheses-evaluation)
7. [Files Inventory](#7-files-inventory)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           MARKET PROFILE ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────┐      ┌──────────────┐      ┌─────────────────┐               │
│  │   Backend   │──────│  WebSocket   │──────│  Frontend Svelte│               │
│  │  (cTrader)  │      │   (Native)   │      │   Components    │               │
│  └─────────────┘      └──────────────┘      └─────────────────┘               │
│         │                     │                        │                        │
│         │ M1 Bars + Ticks     │                        │                        │
│         │                     │                        │                        │
│         ▼                     ▼                        ▼                        │
│  ┌─────────────────────────────────────────────────────────────────┐           │
│  │                    DATA LAYER                                    │           │
│  │  • ConnectionManager.js (WebSocket singleton)                    │           │
│  │  • FloatingDisplay.svelte (local state)                         │           │
│  │    - lastMarketProfileData: profile[]                           │           │
│  │    - marketProfileBucketSize: number                            │           │
│  └─────────────────────────────────────────────────────────────────┘           │
│                                    │                                           │
│                                    ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐           │
│  │                    PROCESSING LAYER                              │           │
│  │  • marketProfileProcessor.js (core logic)                       │           │
│  │    - buildInitialProfile()    M1 bars → discrete levels          │           │
│  │    - updateProfileWithTick()  Tick → TPO aggregation             │           │
│  │    - calculateValueArea()     POC + 70% TPO range                │           │
│  │  • displayDataProcessor.js (bucket size, format)                 │           │
│  └─────────────────────────────────────────────────────────────────┘           │
│                                    │                                           │
│                                    ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐           │
│  │                    RENDERING LAYER                               │           │
│  │  • DisplayCanvas.svelte (reactive container)                    │           │
│  │  • marketProfileRenderer.js (Canvas 2D drawing)                 │           │
│  │  • dayRangeCalculations.js (Y-axis scaling)                     │           │
│  └─────────────────────────────────────────────────────────────────┘           │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Flow Diagrams

### 2.1 Initialization Flow (Symbol Load)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          INITIALIZATION DATA FLOW                                │
└─────────────────────────────────────────────────────────────────────────────────┘

  USER ACTION
      │
      ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ FloatingDisplay.svelte:onMount()                            │
  │ Line 47: connectionManager.subscribeAndRequest(symbol)     │
  └─────────────────────────────────────────────────────────────┘
      │
      │ WebSocket message
      │
      ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ Backend: CTraderSession.getSymbolDataPackage()             │
  │ (services/tick-backend/CTraderSession.js:236-303)          │
  │                                                              │
  │ Fetches:                                                     │
  │   • D1 bars (14-19 days) → ADR calculation                  │
  │   • M1 bars (today) → initialMarketProfile                  │
  │   • pipPosition, pipSize, pipetteSize                       │
  └─────────────────────────────────────────────────────────────┘
      │
      │ symbolDataPackage
      │
      ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ FloatingDisplay.dataCallback (Line 50-72)                  │
  │                                                              │
  │ if (data.type === 'symbolDataPackage' && data.initialMarketProfile)
  │                                                              │
  │   1. bucketSize = getBucketSizeForSymbol(formattedSymbol, data)
  │   2. { profile, actualBucketSize } = buildInitialProfile(M1 bars)
  │   3. lastMarketProfileData = profile                        │
  │   4. marketProfileBucketSize = actualBucketSize             │
  └─────────────────────────────────────────────────────────────┘
      │
      │
      ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ DisplayCanvas.svelte (Line 122)                             │
  │                                                              │
  │ $: if (ctx && (data || marketProfileData || ...)) {         │
  │   render()                                                  │
  │ }                                                           │
  │                                                              │
  │ Reactive statement fires → render() called                  │
  └─────────────────────────────────────────────────────────────┘
```

### 2.2 Live Tick Flow (WORKING - Different Data)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       LIVE TICK DATA FLOW (WORKING, DIFFERENT DATA)              │
└─────────────────────────────────────────────────────────────────────────────────┘

  cTrader emits tick
      │
      │ { symbol, bid, ask, pipPosition, ... }
      │
      ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ DataRouter.broadcastToClients()                             │
  └─────────────────────────────────────────────────────────────┘
      │
      ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ ConnectionManager.onmessage (Line 36-72)                   │
  │ Routes to FloatingDisplay.dataCallback                      │
  └─────────────────────────────────────────────────────────────┘
      │
      ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ FloatingDisplay.dataCallback (Line 64-68)                  │
  │                                                              │
  │ if (data.type === 'tick' && lastMarketProfileData && marketProfileBucketSize)
  │                                                              │
  │   ✅ PASS: lastMarketProfileData = updateProfileWithTick(...)│
  │                                                              │
  └─────────────────────────────────────────────────────────────┘
      │
      ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ marketProfileProcessor.updateProfileWithTick() (Line 99-122)│
  │                                                              │
  │ 1. const updatedProfile = [...lastProfile]                  │
  │ 2. tickPrice = tickData.bid  ← ONLY BID PRICE               │
  │ 3. bucketBoundary = Math.floor(tickPrice / bucketSize) * size│
  │ 4. discreteLevel = formatPrice(bucketBoundary, pipPosition) │
  │ 5. existingLevel = updatedProfile.find(level => ...)        │
  │ 6. if (existingLevel) {                                      │
  │      existingLevel.tpo += 1  ← INCREMENTS ONE LEVEL          │
  │    } else {                                                  │
  │      updatedProfile.push({ price, tpo: 1 })                 │
  │      updatedProfile.sort(...)                               │
  │    }                                                         │
  │ 7. return updatedProfile                                     │
  │                                                              │
  │ ⚠️ RESULT: Only ONE price level incremented per tick        │
  └─────────────────────────────────────────────────────────────┘
      │
      ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ DisplayCanvas.svelte (Line 122)                             │
  │                                                              │
  │ $: if (ctx && (data || marketProfileData || ...)) {         │
  │   render()  ← FIRES, profile updates with tick data         │
  │ }                                                           │
  │                                                              │
  │ ✅ WORKING: Canvas re-renders with tick-updated profile     │
  │ ⚠️ ISSUE: Tick profile looks different from M1 profile      │
  └─────────────────────────────────────────────────────────────┘
```

### 2.3 Data Comparison: M1 Bars vs Ticks

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    DATA REPRESENTATION MISMATCH (ROOT CAUSE)                     │
└─────────────────────────────────────────────────────────────────────────────────┘

  M1 BAR PROCESSING (buildInitialProfile):
  ┌─────────────────────────────────────────────────────────────┐
  │ For EACH M1 bar:                                            │
  │                                                              │
  │   generatePriceLevels(bar.low, bar.high, bucketSize)        │
  │                                                              │
  │   Example: bar.low=1.0850, bar.high=1.0860, bucket=0.001    │
  │                                                              │
  │   Generates: 1.0850, 1.0851, 1.0852, 1.0853, 1.0854,        │
  │              1.0855, 1.0856, 1.0857, 1.0858, 1.0859, 1.0860  │
  │                                                              │
  │   Each level gets +1 TPO (represents activity at that price)│
  │                                                              │
  │ Result: DENSE profile with full price range representation   │
  └─────────────────────────────────────────────────────────────┘

  TICK PROCESSING (updateProfileWithTick):
  ┌─────────────────────────────────────────────────────────────┐
  │ For EACH tick:                                               │
  │                                                              │
  │   tickPrice = tickData.bid  ← ONLY THE BID PRICE            │
  │   bucketBoundary = align to bucket                          │
  │                                                              │
  │   Example: tick.bid = 1.0857, bucket=0.001                  │
  │                                                              │
  │   Generates: 1.0857  ← ONLY ONE PRICE LEVEL                 │
  │                                                              │
  │   That level gets +1 TPO                                     │
  │                                                              │
  │ Result: SPARSE profile with only bid prices represented     │
  └─────────────────────────────────────────────────────────────┘

  VISUAL DIFFERENCE:
  ┌─────────────────────────────────────────────────────────────┐
  │                                                              │
  │  M1 Profile:  Tick Profile:                                 │
  │  ██████████  ████████                                        │
  │  ██████████  ████████                                        │
  │  ██████████  ████████                                        │
  │  ██████████  ████  ← Only where bid touched                 │
  │  ██████████  ████████                                        │
  │  ██████████  ████████                                        │
  │                                                              │
  │  Full range  Bid-only                                       │
  │  coverage   coverage                                        │
  │                                                              │
  └─────────────────────────────────────────────────────────────┘
```

---

## 3. Processing Pipeline

### 3.1 Data Structures

**Initial Market Profile (from Backend):**
```javascript
// CTraderSession.js:271-283
const processedM1Bars = m1Bars.map(bar => ({
  open: low + deltaOpen,
  high: low + deltaHigh,
  low: low,
  close: low + deltaClose,
  timestamp: utcTimestampInMinutes * 60 * 1000
}));

// symbolDataPackage:
{
  symbol: "EURUSD",
  initialMarketProfile: processedM1Bars[],
  pipPosition: 4,
  pipSize: 0.0001,
  pipetteSize: 0.00001,
  adr, todaysOpen, todaysHigh, todaysLow, ...
}
```

**Processed Profile (Frontend):**
```javascript
// marketProfileProcessor.js:35-37
const profile = [
  { price: 1.08415, tpo: 12 },
  { price: 1.08416, tpo: 18 },
  { price: 1.08417, tpo: 25 },
  ...
];

// FloatingDisplay.svelte state:
lastMarketProfileData = profile[];      // Profile array
marketProfileBucketSize = actualBucketSize; // e.g., 0.00001
```

### 3.2 Adaptive Bucket Size Algorithm

**Location:** `src/lib/marketProfileProcessor.js:44-70`

**Purpose:** Prevent memory overflow for high-price assets (BTCUSD, etc.)

```
┌─────────────────────────────────────────────────────────────────┐
│              ADAPTIVE BUCKET SIZE CALCULATION                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  INPUT: M1 bars with high/low prices                            │
│                                                                 │
│  1. Find global price range:                                   │
│     globalLow = min(all bar.lows)                              │
│     globalHigh = max(all bar.highs)                            │
│     priceRange = globalHigh - globalLow                        │
│                                                                 │
│  2. Target ~1500 price levels:                                 │
│     adaptiveBucketSize = priceRange / 1500                     │
│                                                                 │
│  3. Use larger of adaptive or pip-based minimum:               │
│     finalBucketSize = max(adaptiveBucketSize, defaultBucketSize)│
│                                                                 │
│  OUTPUT: Bucket size that prevents memory overflow             │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Price Discretization

**Location:** `src/lib/marketProfileProcessor.js:99-122`

**Purpose:** Map continuous tick prices to discrete bucket levels

```javascript
// Align tick to bucket boundary
const bucketBoundary = Math.floor(tickPrice / bucketSize) * bucketSize;

// Format with consistent precision (eliminates floating point errors)
const discreteLevel = parseFloat(formatPrice(bucketBoundary, pipPosition));

// Example:
// tickPrice = 1.0861573
// bucketSize = 0.00001
// bucketBoundary = 1.0861500000000002
// discreteLevel = 1.08615  (formatted to pipPosition=5)
```

---

## 4. Display/Rendering Pipeline

### 4.1 Render Orchestration

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              RENDER ORCHESTRATION                                │
└─────────────────────────────────────────────────────────────────────────────────┘

  DisplayCanvas.svelte:render()
      │
      ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ displayCanvasRenderer.js:getDisplayType()                   │
  │                                                              │
  │ Returns: 'dayRangeWithMarketProfile'                        │
  └─────────────────────────────────────────────────────────────┘
      │
      ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ displayCanvasRenderer.js:getRenderer()                      │
  │                                                              │
  │ Returns: renderDayRangeWithMarketProfile                    │
  └─────────────────────────────────────────────────────────────┘
      │
      ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ visualizers.js:renderDayRangeWithMarketProfile()            │
  │                                                              │
  │ 1. Clear canvas                                             │
  │ 2. Render background (#0a0a0a)                              │
  │ 3. renderMarketProfile() ← Market Profile overlay           │
  │ 4. renderDayRangeOrchestrated() ← Day Range meter           │
  └─────────────────────────────────────────────────────────────┘
```

### 4.2 Market Profile Rendering

**Location:** `src/lib/marketProfileRenderer.js:14-184`

```
┌─────────────────────────────────────────────────────────────────┐
│              MARKET PROFILE CANVAS RENDERING                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Canvas Layout:                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Day Range Meter    │     Market Profile (right 25%)    │   │
│  │     (left 75%)      │                                  │   │
│  │                    │  ┌──────────────────────────────┐  │   │
│  │  ADR axis at 75%    │  │  POC Line (dashed orange)   │  │   │
│  │  │                  │  │  Value Area (blue overlay)  │  │   │
│  │  ├──────────────────┼──│  TPO Bars (by intensity)    │  │   │
│  │  │                  │  │  - Low: #374151 (grey)      │  │   │
│  │  │                  │  │  - Med: #404694ff (blue)    │  │   │
│  │  │                  │  │  - High: #7b5dc0 (purple)   │  │   │
│  │  │                  │  └──────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Rendering Order:                                               │
│  1. Value area background (rgba(74, 158, 255, 0.1))            │
│  2. Profile bars by intensity (low → medium → high)            │
│  3. POC line (dashed #ff8c4a)                                  │
│                                                                 │
│  Intensity Mapping:                                             │
│  intensity = level.tpo / maxTpo                                 │
│  if intensity <= 0.6  → #374151    (grey)                      │
│  if intensity <= 0.8  → #404694ff  (blue)                      │
│  if intensity > 0.8   → #7b5dc0    (purple)                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Y-Axis Scaling

**Location:** `src/lib/dayRangeCalculations.js:64-114`

**Purpose:** Map price range to canvas height with progressive ADR disclosure

```
┌─────────────────────────────────────────────────────────────────┐
│                   Y-AXIS ADAPTIVE SCALING                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Calculate movements as ADR percentages:                     │
│     highMovement = (high - midPrice) / adrValue                │
│     lowMovement = (midPrice - low) / adrValue                  │
│     currentMovement = (current - midPrice) / adrValue          │
│                                                                 │
│  2. Progressive disclosure based on max movement:              │
│     if maxMovement <= 0.4  → maxExpansion = 0.5 (50% ADR)      │
│     if maxMovement <= 0.6  → maxExpansion = 0.75 (75% ADR)     │
│     else                        → maxExpansion = ceil(...)     │
│                                                                 │
│  3. SYMMETRIC scaling (same expansion both sides):             │
│     totalRange = adrValue * maxExpansion * 2                   │
│     min = midPrice - (totalRange / 2)                          │
│     max = midPrice + (totalRange / 2)                          │
│                                                                 │
│  4. Price to Y coordinate:                                      │
│     normalized = (max - price) / (max - min)                   │
│     y = padding + (normalized * (height - 2 * padding))        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Root Cause Analysis

### 5.1 Validated Root Cause (Corrected)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ROOT CAUSE                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  The system exhibits different profile appearances because M1 bar processing   │
│  and tick processing use fundamentally different data aggregation methods.     │
│                                                                                 │
│  M1 BARS: generatePriceLevels(low, high) creates ALL price levels between      │
│  the bar's low and high, producing a DENSE profile representing the full       │
│  trading range during each minute.                                              │
│                                                                                 │
│  TICKS: updateProfileWithTick() only uses tick.bid (a single price), producing  │
│  a SPARSE profile representing only where the bid price touched.               │
│                                                                                 │
│  When ticks accumulate, the profile shows bid-heavy activity (sparse).         │
│  When refresh occurs, the profile resets to M1-based data (dense).             │
│                                                                                 │
│  The canvas IS re-rendering correctly - the issue is data representation,      │
│  not reactivity failure.                                                        │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Causal Chain

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                CAUSAL CHAIN                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

  [buildInitialProfile() processes M1 bars]
            │
            │ generatePriceLevels(bar.low, bar.high, bucketSize)
            │ Creates ALL price levels in range
            │
            ▼
  [M1-based profile contains full price range]
            │
            │ Dense: 10-100+ levels per bar
            │ Represents all prices traded during minute
            │
            ▼
  [User observes "correct" looking profile]

  [Tick arrives: updateProfileWithTick() called]
            │
            │ tickPrice = tickData.bid (ONLY bid price)
            │ ONE price level incremented
            │
            ▼
  [Tick-based profile accumulates bid-only activity]
            │
            │ Sparse: 1 level per tick
            │ Profile shape changes to reflect bid-heavy distribution
            │
            ▼
  [Canvas re-renders with different-looking profile]
            │
            ▼
  [USER OBSERVATION: Profile looks "wrong" after ticks arrive]

  [User clicks refresh]
            │
            │ lastMarketProfileData = null
            │ New symbolDataPackage requested
            │ buildInitialProfile() runs again
            │
            ▼
  [Profile resets to M1-based data (dense)]
            │
            ▼
  [USER OBSERVATION: Profile looks "correct" again after refresh]
```

### 5.3 Evidence

| File | Lines | Evidence |
|------|-------|----------|
| `marketProfileProcessor.js` | 28-32 | `generatePriceLevels(bar.low, bar.high, ...)` - Full range |
| `marketProfileProcessor.js` | 72-93 | Creates ALL levels between low and high (loop) |
| `marketProfileProcessor.js` | 105 | `tickPrice = tickData.bid` - Only bid price |
| `marketProfileProcessor.js` | 113-118 | Increments ONE price level per tick |
| `DisplayCanvas.svelte` | 122 | Reactive statement DOES fire (re-render works) |

---

## 6. Hypotheses Evaluation

### 6.1 Hypothesis: Data Representation Mismatch (SUPPORTED - ROOT CAUSE)

**Mechanism:** M1 bars use `generatePriceLevels(low, high)` which creates multiple price levels spanning the full range, while ticks only use `tickData.bid` which creates a single price level.

**Evidence:**
- `marketProfileProcessor.js:28-32` - M1 processing calls `generatePriceLevels(bar.low, bar.high, ...)`
- `marketProfileProcessor.js:72-93` - Loop creates ALL levels in range
- `marketProfileProcessor.js:105` - Tick processing uses `tickData.bid` only
- Observed behavior: Profile changes appearance, then reverts on refresh

**Status:** SUPPORTED - This is the primary root cause.

### 6.2 Hypothesis: Svelte Reactivity Failure (CONTRADICTED - Previously Incorrect)

**Mechanism:** (Originally hypothesized) Svelte's reactivity fails due to shallow copy and object mutation.

**Evidence:**
- The canvas IS re-rendering (profile changes are visible)
- Profile appears "different" after ticks arrive (not "stale")
- Refresh changes profile back (not "no update")

**Status:** CONTRADICTED - Reactivity works correctly. The issue is data representation.

### 6.3 Hypothesis: Condition Never Met (CONTRADICTED)

**Mechanism:** `lastMarketProfileData` or `marketProfileBucketSize` is undefined when tick arrives.

**Evidence:**
- `FloatingDisplay.svelte:62-63` - Both variables are set in `symbolDataPackage` handler
- `FloatingDisplay.svelte:64` - Condition checks both before calling `updateProfileWithTick()`
- Ticks ARE being processed (profile changes are visible)

**Status:** CONTRADICTED - Variables are properly initialized.

### 6.4 Hypothesis: Bucket Size Mismatch (CONTRADICTED)

**Mechanism:** Adaptive bucket size differs between initialization and tick updates.

**Evidence:**
- `FloatingDisplay.svelte:63` - Stores `actualBucketSize` from `buildInitialProfile()`
- `FloatingDisplay.svelte:67` - Uses same `marketProfileBucketSize` for ticks
- Same bucket size used for both operations

**Status:** CONTRADICTED - Bucket size is correctly passed through.

---

## 7. Files Inventory

### 7.1 Core Processing

| File | Lines | Purpose | Key Functions |
|------|-------|---------|---------------|
| `src/lib/marketProfileProcessor.js` | 210 | Main data processing | `buildInitialProfile()`, `updateProfileWithTick()`, `calculateValueArea()` |
| `src/lib/marketProfileStateless.js` | 301 | Alternative implementation | `createStatelessProfile()` (NOT ACTIVE) |
| `src/lib/displayDataProcessor.js` | 103 | Data transformation | `processSymbolData()`, `getBucketSizeForSymbol()` |

### 7.2 Components

| File | Lines | Purpose | Key Logic |
|------|-------|---------|-----------|
| `src/components/FloatingDisplay.svelte` | 213 | Display container | Data callback (Line 50-72), State management (Line 15-16) |
| `src/components/displays/DisplayCanvas.svelte` | 169 | Canvas container | Reactive render (Line 122), Render coordination (Line 24-88) |

### 7.3 Rendering

| File | Lines | Purpose | Key Functions |
|------|-------|---------|---------------|
| `src/lib/marketProfileRenderer.js` | 188 | Canvas 2D drawing | `renderMarketProfile()` |
| `src/lib/displayCanvasRenderer.js` | 234 | Renderer routing | `getDisplayType()`, `getRenderer()`, `renderWithRenderer()` |
| `src/lib/visualizers.js` | 79 | Visualization registry | `renderDayRangeWithMarketProfile()` |
| `src/lib/dayRangeCalculations.js` | 193 | Y-axis scaling | `calculateAdaptiveScale()` |

### 7.4 Utilities

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/priceFormat.js` | 78 | Price formatting with pipPosition |
| `src/lib/dayRangeCore.js` | 98 | DPR-aware canvas setup |
| `src/lib/connectionManager.js` | 334 | WebSocket lifecycle |
| `src/lib/marketProfileConfig.js` | 45 | Configuration constants |

### 7.5 Backend

| File | Lines | Purpose |
|------|-------|---------|
| `services/tick-backend/CTraderSession.js` | 500+ | cTrader API integration, symbol data package |
| `services/tick-backend/DataRouter.js` | 50 | Tick routing to clients |
| `services/tick-backend/WebSocketServer.js` | 300+ | WebSocket server |

---

## Summary

The Market Profile implementation is architecturally sound with clear separation between data processing, state management, and rendering. However, a **data representation mismatch** causes the profile to appear different after tick accumulation:

**Root Cause:** M1 bar processing creates full price range levels (dense), while tick processing only uses bid price (sparse).

**Why Previous Fixes Failed:**
1. Tick bucket alignment - Correct fix for discretization, but not the root cause
2. Bucket size mismatch - Correct fix for consistency, but not the root cause
3. DisplayCanvas reactivity - Added dependency, but reactivity already works
4. Return type consistency - Correct fix for edge case, but not the root cause

**The Real Issue:**
- M1 bars represent the FULL trading range during each minute
- Ticks only represent where the bid price was at that moment
- These are fundamentally different data representations

**Fix Directions:**
1. **Option A (Tick Accumulation):** Store raw ticks and rebuild profile from tick history (using ask prices for full range)
2. **Option B (M1 Continuation):** Don't use ticks for profile - wait for next M1 bar update
3. **Option C (Hybrid):** Use ticks for real-time bid levels only, clearly label as "tick-based" vs "M1-based"
4. **Option D (Market Profile Definition):** Clarify whether profile should show bid-activity or price-range-activity

**Architectural Decision Required:**
What should the Market Profile represent?
- **Traditional Market Profile:** Price range activity (what M1 bars provide)
- **Tick Activity Profile:** Bid price frequency (what ticks currently provide)

These are different visualizations with different use cases.

---

*Document generated as part of architectural forensic review*
*NeuroSense FX - Crystal Clarity Architecture*
*Root cause corrected after user feedback on observed behavior*
