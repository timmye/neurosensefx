# TWAP Implementation Scope Assessment

**Date:** 2026-01-29
**Status:** ✅ Implemented (Simplified per user request)
**Effort:** Completed
**Complexity:** Low-Moderate → Low

---

## Executive Summary

Scope assessment for implementing a **Time-Weighted Average Price (TWAP)** calculation that evolves throughout each trading day and is plotted on the existing Day Range Meter visualization.

**Key Finding:** This is a **low-moderate complexity feature** that leverages existing M1 bar infrastructure with focused additions to backend and frontend.

**Actual Scope:** ~110 lines (TwapService.js final implementation)

**Critical Requirements (User-Defined):**
- Session Start: **22:00 UTC (5pm ET)** - FX market standard
- Price Method: **Close price only** - Simple Σ(Close) / N
- ~~Weekend Handling: **Exclude weekends**~~ → **REMOVED** per user request
- Mid-Session: **Use available history** - Recalculate from session start

**Scope Changes (Simplification):**
- **Weekend handling removed** - All M1 bars now included in TWAP calculation
- **Session reset simplified** - Now matches Day Range behavior (via history reload)
- **Reduced complexity** - No weekend filtering, no complex session boundary logic

---

## 1. Understanding TWAP

### Definition

**TWAP** = Time-Weighted Average Price = Average price where each price point is weighted by the time duration at that price level.

**Formula (M1-based, Close Price):**
```
TWAP = Σ(Close_i) / N
// Each M1 bar = 1 minute weight, so time-weighting is implicit
```

### Trader Requirements (Confirmed)

| Requirement | Value | Rationale |
|-------------|-------|-----------|
| **Session Start** | 22:00 UTC (5pm ET) | FX market standard - Sunday open to Friday close |
| **Price Method** | Close price only | Simple Σ(Close) / N - most common |
| **Weekend Gaps** | ~~Exclude weekends~~ → Include all bars | **CHANGED** - All M1 bars included per user request |
| **Mid-Session Join** | Use available history | Recalculate from session start using historical M1 bars |

### Current System State

| Component | Current State | TWAP Relevance |
|-----------|---------------|----------------|
| **M1 Bar Stream** | cTrader/TradingView → MarketProfileService → WebSocket | ✅ **Data source exists** |
| **M1 History** | `initialMarketProfile` contains historical M1 bars | ✅ **Can recalculate on connection** |
| **Market Profile Service** | Aggregates price levels over time | ⚠️ Similar pattern, different calculation |
| **Day Range Meter** | Shows: Open, High, Low, Current, ADR | ⚠️ Needs new TWAP marker |
| **Price Marker Renderer** | Handles static price markers | ✅ Can be extended for TWAP |
| **M1 Event Infrastructure** | `on('m1Bar')` already wired | ✅ **No new events needed** |

---

## 2. Architecture Analysis

### 2.1 Backend (`services/tick-backend/`)

**Current M1 Flow (already implemented):**
```
cTrader/TradingView → M1 Bar Event
                      ↓
                   MarketProfileService.onM1Bar()
                      ↓
                   DataRouter.routeProfileUpdate()
                      ↓
                 WebSocket → Frontend
```

**TWAP Integration Point:**
```javascript
// WebSocketServer.js:37-39 (EXISTING CODE)
this.cTraderSession.on('m1Bar', (bar) => {
  this.marketProfileService.onM1Bar(bar.symbol, bar);
  // ADD: this.twapService.onM1Bar(bar.symbol, bar);
});
```

### 2.2 Frontend (`src/`)

**Current Rendering:**
```
WebSocket → displayDataProcessor → FloatingDisplay
                                    ↓
                              DisplayCanvas
                                    ↓
                        visualizers.js → dayRangeOrchestrator
                                    ↓
                              priceMarkerRenderer
```

**Entry Point for TWAP Rendering:**
- `src/lib/priceMarkerRenderer.js:8-166` - Render price markers
- `src/lib/dayRangeOrchestrator.js:10-62` - Structural rendering

---

## 3. Trader Requirements Analysis

### 3.1 Session Start Time: 22:00 UTC (5pm ET)

**Why This Matters:**
- FX market opens Sunday 5pm ET (22:00 UTC)
- Market closes Friday 5pm ET (22:00 UTC)
- This is the industry standard for FX "trading day"

**Implementation (Simplified):**
Session reset now occurs via history reload mechanism, matching Day Range behavior. No complex session boundary logic needed.

### 3.2 Price Method: Close Price Only

**Formula:**
```javascript
// Simple running average of M1 close prices
state.sum += bar.close;
state.count += 1;
state.twap = state.sum / state.count;
```

**Why Close Price?**
- Most common implementation
- Simple to understand and implement
- Consistent with industry standard

### 3.3 Weekend Handling: ~~Exclude Weekends~~ → Include All Bars

**What This Means:**
- ~~Saturday and Sunday hours are NOT counted~~ → **All M1 bars are now included**
- ~~Friday close → Monday open gap is NOT part of TWAP~~ → **Gap IS part of TWAP**
- Time weighting includes ALL bars (no filtering)

**Rationale for Change:**
User requested simplification - removing weekend filtering reduces complexity and aligns TWAP calculation with simple moving average behavior.

### 3.4 Mid-Session Join: Use Available History

**What This Means:**
- When client connects mid-session, calculate TWAP from session start
- Use `initialMarketProfile` data (historical M1 bars)
- Recalculate full TWAP, not just from connection

**Implementation:**
```javascript
// On symbol subscription, recalculate TWAP from historical M1 bars
function initializeFromHistory(symbol, initialMarketProfile) {
  if (!initialMarketProfile || initialMarketProfile.length === 0) {
    return; // Start from first incoming M1 bar
  }

  let sum = 0;
  let count = 0;

  // Calculate TWAP from ALL historical M1 bars (no weekend filtering)
  for (const bar of initialMarketProfile) {
    sum += bar.close;
    count += 1;
  }

  // Initialize state
  this.twapState.set(symbol, {
    sum,
    count,
    twap: count > 0 ? sum / count : null,
    sessionStart: initialMarketProfile[0].timestamp
  });

  // Emit initial TWAP
  this.emit('twapUpdate', {
    symbol,
    twapValue: this.twapState.get(symbol).twap,
    timestamp: Date.now(),
    contributions: count,
    isHistorical: true
  });
}
```

---

## 4. Implementation Scope

### Phase 1: Backend TWAP Calculation Service (M1-Based)

| File | Action | Actual Lines | Purpose |
|------|--------|--------------|---------|
| `services/tick-backend/TwapService.js` | **CREATED** | 110 | Core TWAP logic (simplified, no weekend filtering) |
| `services/tick-backend/WebSocketServer.js` | MODIFIED | +12 | Wire TWAP to M1 events + history init |
| `services/tick-backend/DataRouter.js` | MODIFIED | +15 | Route TWAP updates |
| `services/tick-backend/RequestCoordinator.js` | MODIFIED | +10 | Initialize TWAP from history on subscribe |

**TwapService.js (Final Implementation - Simplified):**
```javascript
const EventEmitter = require('events');

class TwapService extends EventEmitter {
  constructor() {
    super();
    this.twapState = new Map(); // symbol -> { sum, count, twap, sessionStart, lastUpdate, source }
    this.symbolSources = new Map(); // symbol -> source (ctrader or tradingview)
  }

  // Initialize TWAP from historical M1 bars (for mid-session joins)
  initializeFromHistory(symbol, initialMarketProfile, source = 'ctrader') {
    if (!initialMarketProfile || initialMarketProfile.length === 0) {
      console.log(`[TwapService] No history for ${symbol}, starting from scratch`);
      return;
    }

    let sum = 0;
    let count = 0;

    // Calculate TWAP from historical M1 bars (no weekend filtering)
    for (const bar of initialMarketProfile) {
      sum += bar.close;
      count += 1;
    }

    const sessionStart = initialMarketProfile[0]?.timestamp || Date.now();

    // Store source for this symbol
    this.symbolSources.set(symbol, source);

    this.twapState.set(symbol, {
      sum,
      count,
      twap: count > 0 ? sum / count : null,
      sessionStart,
      lastUpdate: Date.now(),
      source
    });

    console.log(`[TwapService] Initialized ${symbol} TWAP from ${count} historical bars: ${this.twapState.get(symbol).twap}`);

    const twapData = {
      symbol,
      source, // Include source for routing
      twapValue: this.twapState.get(symbol).twap,
      timestamp: Date.now(),
      contributions: count,
      isHistorical: true
    };
    console.log(`[TwapService] Emitting twapUpdate for ${symbol}:${source}:`, JSON.stringify(twapData));

    // Emit initial TWAP
    this.emit('twapUpdate', twapData);
    console.log(`[TwapService] twapUpdate emitted for ${symbol}`);
  }

  // Process incoming M1 bar
  onM1Bar(symbol, bar, source = 'ctrader') {
    // Validate bar structure
    if (!bar || typeof bar.close !== 'number' || isNaN(bar.close)) {
      console.error(`[TwapService] Invalid bar data for ${symbol}:`, bar);
      this.emit('error', { symbol, error: 'Invalid bar data structure', code: 'INVALID_BAR_DATA', bar });
      return;
    }

    // Initialize if needed
    if (!this.twapState.has(symbol)) {
      this.symbolSources.set(symbol, source);
      this.twapState.set(symbol, {
        sum: 0,
        count: 0,
        twap: null,
        sessionStart: bar.timestamp,
        lastUpdate: null,
        source
      });
    }

    const state = this.twapState.get(symbol);

    // Use bar close as representative price (1-minute time bucket)
    const price = bar.close;

    // Simple running average (each bar = 1 minute weight)
    state.sum += price;
    state.count += 1;
    state.twap = state.sum / state.count;
    state.lastUpdate = bar.timestamp;

    // Emit update
    this.emit('twapUpdate', {
      symbol,
      source: state.source || source, // Include source for routing
      twapValue: state.twap,
      timestamp: bar.timestamp,
      contributions: state.count,
      isHistorical: false
    });
  }

  resetDaily(symbol) {
    this.twapState.delete(symbol);
  }

  getTwap(symbol) {
    return this.twapState.get(symbol)?.twap || null;
  }
}

module.exports = { TwapService };
```

**WebSocketServer.js Integration:**
```javascript
// ADD to constructor (after MarketProfileService initialization)
const { TwapService } = require('./TwapService.js');
this.twapService = new TwapService();

// ADD to m1Bar handler (line 37-39 area)
this.cTraderSession.on('m1Bar', (bar) => {
  this.marketProfileService.onM1Bar(bar.symbol, bar);
  this.twapService.onM1Bar(bar.symbol, bar);  // ← ADD THIS
});

// ADD event forwarding
this.twapService.on('twapUpdate', (data) =>
  this.dataRouter.routeTwapUpdate(data.symbol, data)
);

// ADD to TradingView M1 handler too
this.tradingViewSession.on('m1Bar', (bar) => {
  this.marketProfileService.onM1Bar(bar.symbol, bar);
  this.twapService.onM1Bar(bar.symbol, bar);  // ← ADD THIS
});
```

**RequestCoordinator.js Integration:**
```javascript
// After receiving symbolDataPackage with initialMarketProfile
if (symbolDataPackage.initialMarketProfile) {
  this.wsServer.twapService.initializeFromHistory(
    symbolName,
    symbolDataPackage.initialMarketProfile
  );
}
```

### Phase 2: Frontend Data Processing

| File | Action | Est. Lines | Purpose |
|------|--------|------------|---------|
| `src/lib/displayDataProcessor.js` | MODIFY | +15 | Process TWAP messages |

**Data Flow Addition:**
```javascript
// In displayDataProcessor.js - ADD to processSymbolData()
if (data.type === 'twapUpdate') {
  return {
    type: 'data',
    data: {
      ...lastData,
      twap: data.twapValue,
      twapContributions: data.contributions,
      twapUpdatedAt: data.timestamp
    }
  };
}
```

**Note:** TWAP uses existing component state (like `current`, `high`, `low`) - no new store needed.

### Phase 3: Frontend Rendering

| File | Action | Est. Lines | Purpose |
|------|--------|------------|---------|
| `src/lib/priceMarkerRenderer.js` | MODIFY | +25 | Render TWAP marker |
| `src/lib/dayRangeOrchestrator.js` | MODIFY | +5 | Call TWAP renderer |
| `src/lib/dayRangeConfig.js` | MODIFY | +5 | Add TWAP color config |

**Rendering Logic:**
```javascript
// In priceMarkerRenderer.js - ADD NEW FUNCTION
export function renderTwapMarker(ctx, config, axisX, priceScale, twapPrice, symbolData) {
  if (!twapPrice) return;

  const formattedPrice = formatPriceForDisplay(twapPrice, symbolData);
  const twapY = priceScale(twapPrice);
  const color = config.colors.twapMarker;

  // Render marker line with dashed pattern
  renderMarkerLine(ctx, twapY, axisX, color, 2, 12, {
    text: `TWAP: ${formattedPrice}`,
    textColor: color,
    textFont: config.fonts.priceLabels,
    dashed: true  // Dashed to distinguish from current price
  });
}
```

### Phase 4: Configuration & Colors

**Configuration Addition:**
```javascript
// src/lib/dayRangeConfig.js
colors: {
  // ... existing colors
  twapMarker: '#10b981', // Emerald green for TWAP
  twapLabel: '#10b981'
}

features: {
  // ... existing features
  twapMarker: true // Enable/disable TWAP display
}
```

---

## 5. Data Structure Specifications

### Backend Message Format
```javascript
{
  type: 'twapUpdate',
  symbol: 'EURUSD',
  twapValue: 1.08765,
  timestamp: 1706500800000,
  contributions: 420,  // Number of M1 bars (minutes) processed
  isHistorical: false  // true if calculated from history
}
```

### Frontend Display Data
```javascript
{
  // ... existing fields (current, high, low, open, adrHigh, adrLow, etc.)
  twap: 1.08765,
  twapContributions: 420,
  twapUpdatedAt: 1706500800000
}
```

---

## 6. Crystal Clarity Compliance Analysis

### File Size Assessment

| File | Current | After TWAP | Limit | Compliant? |
|------|---------|------------|-------|------------|
| `TwapService.js` (NEW) | 0 | ~80 | 120 | ✅ YES |
| `WebSocketServer.js` | 206 | 218 (+12) | 120 | ⚠️ Already over |
| `DataRouter.js` | 84 | 99 (+15) | 120 | ⚠️ Approaching |
| `RequestCoordinator.js` | 178 | 188 (+10) | 120 | ⚠️ Already over |
| `displayDataProcessor.js` | 112 | 127 (+15) | 120 | ⚠️ Approaching |
| `priceMarkerRenderer.js` | 170 | 195 (+25) | 120 | ⚠️ Already over |
| `dayRangeOrchestrator.js` | 102 | 107 (+5) | 120 | ✅ Within |
| `dayRangeConfig.js` | 66 | 71 (+5) | 120 | ✅ Within |

### Compliance Summary

| Criterion | Status | Notes |
|-----------|--------|-------|
| **Framework-First** | ✅ COMPLIANT | Uses EventEmitter, Canvas 2D, Svelte |
| **Single Responsibility** | ✅ COMPLIANT | TwapService only calculates TWAP |
| **No Abstractions** | ✅ COMPLIANT | Direct framework usage |
| **File Size** | ⚠️ CONCERN | Existing files already exceed limits |

### Recommendation

**TWAP additions are compliant**, but several existing files already violate Crystal Clarity line limits:
- `WebSocketServer.js`: 206 lines (172% of limit)
- `priceMarkerRenderer.js`: 170 lines (142% of limit)
- `RequestCoordinator.js`: 178 lines (148% of limit)

**Consider refactoring these files separately** before adding TWAP, or accept the technical debt and address it in a dedicated cleanup sprint.

---

## 7. Edge Cases & Considerations

| Scenario | Handling Approach |
|----------|------------------|
| **Session rollover** | Via history reload (matches Day Range behavior) |
| **Weekend bars** | ~~Skip calculation~~ → Included in TWAP |
| **Symbol switch** | Clear per-symbol state, maintain service |
| **Reconnection** | Re-initialize from available historical M1 bars |
| **No M1 history** | Start from first incoming M1 bar of session |
| **Mid-session join** | Recalculate from session start using `initialMarketProfile` |
| **Friday close → Monday open** | ~~Weekend gap excluded~~ → Gap IS part of TWAP |

---

## 8. Implementation Complexity Summary

| Component | Complexity | Actual Lines | Risk Level |
|-----------|------------|--------------|------------|
| Backend TWAP Service | Low | 110 | Low - simple accumulator (no session logic) |
| WebSocket Integration | Low | ~12 | Low - leverage existing m1Bar |
| RequestCoordinator Integration | Low | ~10 | Low - history initialization |
| Data Router Integration | Low | ~15 | Low - standard message routing |
| Frontend Data Processing | Low | ~15 | Low - standard message handling |
| TWAP Marker Rendering | Low | ~25 | Low - follows existing pattern |
| Configuration Updates | Trivial | ~5 | None |
| Testing & Validation | Low | N/A | Low - simplified logic, no weekend handling |

**Total Actual Lines:** ~110 (TwapService.js only)

---

## 9. Recommended Implementation Order

### Day 1 - Backend Foundation (Morning: ~2 hours)
1. Create `TwapService.js` with M1-based calculation logic
2. Implement simple accumulator (no weekend filtering)
3. Add basic validation and error handling
4. Test with live M1 data

### Day 1 - Backend Integration (Afternoon: ~2 hours)
1. Wire into `WebSocketServer.js` m1Bar handlers
2. Add `routeTwapUpdate()` to `DataRouter.js`
3. Add history initialization to `RequestCoordinator.js`
4. Test end-to-end data flow

### Day 2 - Frontend Integration (Morning: ~2 hours)
1. Update `displayDataProcessor.js` to handle TWAP messages
2. Implement `renderTwapMarker()` in `priceMarkerRenderer.js`
3. Add TWAP rendering to `dayRangeOrchestrator.js`
4. Update colors configuration

### Day 2 - Testing & Polish (Afternoon: ~2 hours)
1. Mid-session join testing (history recalculation)
2. Reconnection handling validation
3. E2E testing with Playwright
4. Documentation updates

---

## 10. Dependencies & Prerequisites

| Requirement | Status | Notes |
|-------------|--------|-------|
| M1 bar infrastructure | ✅ Complete | Already handles M1 streaming |
| `initialMarketProfile` data | ✅ Complete | Contains historical M1 bars |
| m1Bar event handlers | ✅ Complete | Wired in WebSocketServer.js |
| Price marker rendering | ✅ Complete | Pattern exists for extension |
| Backend service pattern | ✅ Complete | MarketProfileService as template |
| Display state management | ✅ Complete | FloatingDisplay handles dynamic data |
| Color configuration | ✅ Complete | Easy to add new entries |

---

## 11. Key Files Reference

### Backend Files
| File | Purpose |
|------|---------|
| `services/tick-backend/MarketProfileService.js` | Template for TWAP Service (M1 pattern) |
| `services/tick-backend/WebSocketServer.js` | M1 event wiring, service initialization |
| `services/tick-backend/DataRouter.js` | Message routing (add twapUpdate) |
| `services/tick-backend/RequestCoordinator.js` | History initialization on subscribe |
| `services/tick-backend/CTraderEventHandler.js` | M1 bar event source (cTrader) |
| `services/tick-backend/TradingViewCandleHandler.js` | M1 bar event source (TradingView) |

### Frontend Files
| File | Purpose |
|------|---------|
| `src/lib/displayDataProcessor.js` | WebSocket message processing |
| `src/lib/priceMarkerRenderer.js` | Price marker rendering |
| `src/lib/dayRangeOrchestrator.js` | Day range rendering coordination |
| `src/lib/dayRangeConfig.js` | Configuration and colors |
| `src/lib/dayRangeCalculations.js` | Price calculation utilities |

---

## 12. Conclusion

**Status:** ✅ Implemented and Simplified

**Implementation Summary:**
- TWAP feature successfully implemented with simplified logic
- Weekend filtering removed per user request
- Session reset now matches Day Range behavior (via history reload)
- Reduced from estimated 188 lines to actual 110 lines

**Key Changes from Original Scope:**
- **Removed:** Weekend filtering logic
- **Removed:** Complex session boundary detection
- **Added:** Source tracking (ctrader/tradingview) for routing
- **Simplified:** Session reset via history reload

**Final Trader Requirements:**
- ✅ Session Start: 22:00 UTC (5pm ET) - Via history reload
- ✅ Price Method: Close price only
- ✅ Weekend Handling: All bars included (no filtering)
- ✅ Mid-Session Join: Use available history

**Crystal Clarity Compliance:**
- ✅ TwapService.js: 110 lines (within 120-line limit)
- ✅ Framework-First: Uses EventEmitter
- ✅ Single Responsibility: TWAP calculation only
- ✅ No Abstractions: Direct framework usage

---

**Document Version:** 3.0 (Trader Requirements)
**Last Updated:** 2026-01-29
**Previous Versions:**
- v2.0 (M1-based approach)
- v1.0 (tick-based - deprecated)
