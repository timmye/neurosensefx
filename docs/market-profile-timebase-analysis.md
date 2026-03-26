# Market Profile Time Base Analysis Report

**Date**: March 25, 2026
**Focus Area**: Time-based data aggregation and bar processing
**Objective**: Scope effort to change market profile time base from 1D (daily) to 1W (weekly) in canvases

---

## Executive Summary

The market profile implementation in NeuroSense FX is currently hardcoded to daily (1D) time base through M1 (1-minute) bar aggregation. The system processes tick data into M1 bars, then aggregates those M1 bars into price levels for the daily market profile. Changing to weekly (1W) time base would require significant changes across the data aggregation pipeline, particularly in how M1 bars are collected and grouped into weekly periods.

---

## Current Architecture Overview

### 1. Data Flow Pipeline

```
Tick Data → M1 Bar Aggregation → Daily Market Profile
    ↓           ↓                    ↓
Real-time    Time-based          Canvas 2D
prices      aggregation          rendering
```

### 2. Key Components Identified

#### Backend Services
- **MarketProfileService.js**: Core market profile aggregation logic
- **TradingViewCandleHandler.js**: M1 bar processing from tick data
- **CTraderDataProcessor.js**: Historical data fetching and processing

#### Frontend Components
- **marketProfileProcessor.js**: Builds initial profile from M1 bars
- **marketProfile/orchestrator.js**: Coordinates rendering
- **marketProfileRenderer.js**: Canvas rendering logic

---

## Time Base Implementation Analysis

### 1. Current Daily Time Base Logic

#### MarketProfileService.js (Lines 285-312)
```javascript
// Daily boundary detection and reset logic
const existingDayStart = this._getUtcDayStart(existingProfile.lastUpdate);
const newDataDayStart = m1Bars && m1Bars.length > 0
  ? this._getUtcDayStart(m1Bars[0].timestamp)
  : this._getUtcDayStart(Date.now());

if (existingDayStart === newDataDayStart) {
  // Same day - safe to skip reinitialization
  console.log(`[MarketProfileService] ${symbol} already initialized for ${newDataDayStart}`);
  return;
} else {
  // Different day - daily boundary crossed, must reset
  console.log(`[MarketProfileService] ${symbol} daily boundary detected: ${existingDayStart} → ${newDataDayStart}, resetting profile`);
  existingProfile.levels.clear();
  // Clear sequence for new day
  this.sequenceNumbers.delete(symbol);
}
```

#### TradingViewCandleHandler.js (Lines 179-225)
```javascript
// M1 bar creation based on minute boundaries
updateM1BarFromTick(symbol, price) {
  const now = Date.now();
  const currentMinute = Math.floor(now / 60000) * 60000; // Round down to minute

  const existing = this.currentM1Bars.get(symbol);

  if (existing) {
    if (existing.minuteTimestamp !== currentMinute) {
      // Minute changed - emit the completed bar
      this.emit('m1Bar', completedBar);

      // Start new bar
      this.currentM1Bars.set(symbol, {
        open: price,
        high: price,
        low: price,
        close: price,
        minuteTimestamp: currentMinute
      });
    }
  }
}
```

### 2. Time Period Hardcoding

The current implementation has several hardcoded time assumptions:

1. **M1 Bar Processing**: Always aggregates ticks into 1-minute bars
2. **Daily Reset**: Market profile resets at UTC midnight daily
3. **Weekly Boundary**: No existing weekly boundary detection
4. **Data Aggregation**: All aggregation assumes daily timeframes

---

## Required Changes for Weekly Time Base

### 1. Backend Service Modifications

#### MarketProfileService.js Changes Needed:

```javascript
// Current: Daily boundary detection
_getUtcDayStart(timestamp) {
  return new Date(timestamp).toISOString().split('T')[0];
}

// Required: Weekly boundary detection
_getUtcWeekStart(timestamp) {
  const date = new Date(timestamp);
  const dayOfWeek = date.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
  const diff = date.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust for Monday as week start
  const weekStart = new Date(date.setUTCDate(diff));
  weekStart.setUTCHours(0, 0, 0, 0);
  return weekStart.toISOString().split('T')[0];
}
```

#### TradingViewCandleHandler.js Changes Needed:

```javascript
// Current: M1 bar aggregation
const currentMinute = Math.floor(now / 60000) * 60000;

// Required: Weekly data collection strategy
// Option 1: Collect all M1 bars for the week
// Option 2: Aggregate M1 bars into daily bars, then into weekly
// Option 3: Implement weekly bar aggregation directly
```

### 2. Data Processing Pipeline Changes

#### Option 1: Weekly M1 Bar Collection
- Collect all M1 bars for the current week
- Reset market profile at week boundary (Monday 00:00 UTC)
- Simple to implement but may have large memory footprint

#### Option 2: Hierarchical Aggregation
- Aggregate M1 → Daily bars first
- Then aggregate Daily bars into weekly profile
- More complex but more efficient

#### Option 3: Time-Configurable Aggregation
- Add configuration parameter for time base (1D/1W)
- Dynamic aggregation based on configuration
- Most flexible but requires more complex logic

### 3. Frontend Canvas Rendering

The canvas rendering logic in `marketProfileRenderer.js` should not require changes since it operates on the aggregated price levels regardless of time base.

---

## Scope Estimate

### Phase 1: Core Backend Changes (High Priority)

#### Files to Modify:
1. **services/tick-backend/MarketProfileService.js**
   - Add weekly boundary detection
   - Modify reset logic for weekly periods
   - Update aggregation logic to handle weekly data

2. **services/tick-backend/TradingViewCandleHandler.js**
   - Implement weekly data collection strategy
   - Modify M1 bar processing to accumulate weekly data

3. **src/lib/marketProfileProcessor.js**
   - Update initial profile building for weekly data
   - Modify bucket size calculation for weekly ranges

**Estimated Effort**: 3-5 days

### Phase 2: Configuration and Flexibility (Medium Priority)

#### Files to Modify:
1. **Add time base configuration**
   - Configuration parameter in marketProfileConfig.js
   - Time period selector in UI

2. **Data processing pipeline updates**
   - Dynamic aggregation based on time base
   - Weekly boundary handling

**Estimated Effort**: 2-3 days

### Phase 3: Testing and Validation (Medium Priority)

#### Activities:
1. **Unit testing** for weekly aggregation logic
2. **Integration testing** for weekly market profile rendering
3. **Performance testing** for weekly data handling
4. **Edge case testing** for week boundaries

**Estimated Effort**: 2-3 days

---

## Risk Assessment

### Technical Risks

1. **Memory Usage**: Weekly data collection could significantly increase memory usage
   - Mitigation: Implement data retention policies for older weeks

2. **Data Volume**: Weekly profiles may have many more price levels
   - Mitigation: Optimize bucket size calculation for weekly ranges

3. **Reset Timing**: Weekly reset timing (Monday 00:00 UTC) may not align with all markets
   - Mitigation: Make reset time configurable per symbol

### Implementation Challenges

1. **Existing Daily Logic**: Current logic assumes daily reset throughout
2. **Test Coverage**: Limited existing tests for weekly scenarios
3. **UI Integration**: Need to add time base selection to user interface

---

## Recommended Approach

### Step 1: Proof of Concept
Implement weekly market profile for a single symbol to validate the approach

### Step 2: Configuration Framework
Add time base configuration parameter to system

### Step 3: Full Implementation
Roll out to all symbols with proper testing

### Step 4: Performance Optimization
Optimize memory usage and rendering performance for weekly data

---

## Success Criteria

1. **Functionality**: Market profile displays weekly price distribution
2. **Performance**: Maintains 60fps rendering with weekly data
3. **Memory**: Memory usage remains reasonable for weekly data collection
4. **Accuracy**: Weekly aggregation correctly captures market activity
5. **UI**: Time base selector available to users

---

## Conclusion

Changing the market profile time base from daily to weekly is feasible but requires significant changes to the data aggregation pipeline. The effort is estimated at 7-11 days total, with the majority of work in the backend services. The key challenge is modifying the time period detection and aggregation logic while maintaining performance and accuracy.

The implementation should be approached in phases, starting with a proof of concept to validate the approach before full-scale implementation.