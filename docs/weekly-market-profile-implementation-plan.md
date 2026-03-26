# Weekly Market Profile Implementation Plan

## Overview

This document outlines the implementation plan for changing the market profile time base from daily (1D) to weekly (1W). The current implementation uses daily candles to generate market profiles, but we want to switch to weekly timeframes for longer-term analysis.

## Current Architecture Overview

The market profile system works as follows:
1. **Backend**: TradingView provides D1 (daily) and M1 (1-minute) candles
2. **Market Profile Service**: Processes M1 bars and builds price levels using daily boundary detection
3. **Frontend**: Receives profile updates via WebSocket and renders market profile visualizations

## Implementation Plan

### Phase 1: Backend Changes

#### 1.1 Update TradingViewSubscriptionManager.js

**File**: `/workspaces/neurosensefx/services/tick-backend/TradingViewSubscriptionManager.js`

**Changes needed**:
- Change D1 timeframe from `'1D'` to `'1W'` (weekly)
- Adjust lookback period for weekly candles (currently `lookbackDays + 5` → `lookbackWeeks + 2`)
- Update log messages to reflect weekly timeframe

```javascript
// Line 32: Change from '1D' to '1W'
'1W'  // Was '1D'

// Line 18: Adjust amount for weekly lookback
const amount = lookbackWeeks + 2;  // Was lookbackDays + 5

// Line 19: Update log message
console.log(`[TradingView] Subscribing to ${symbol} W1 candles (${amount} weeks)...`);  // Was D1
```

#### 1.2 Update TradingViewSession.js

**File**: `/workspaces/neurosensefx/services/tick-backend/TradingViewSession.js`

**Changes needed**:
- Update variable names from D1/M1 to W1/M1 for clarity
- Adjust subscription data structure

```javascript
// Lines 115-123: Update event handling
if (data.w1ChartSession === chartSession) {
    this.candleHandler.handleW1Candles(chartSession, seriesData['sds_1']?.['s'], symbol, data);
    break;
}
if (data.m1ChartSession === chartSession) {
    this.candleHandler.handleM1Candles(chartSession, seriesData['sds_2']?.['s'], symbol, data);
    break;
}

// Line 167-168: Update session names
const w1ChartSession = `cs_w1_${randomstring.generate(12)}`;
const m1ChartSession = `cs_m1_${randomstring.generate(12)}`;
```

#### 1.3 Update TradingViewCandleHandler.js

**File**: `/workspaces/neurosensefx/services/tick-backend/TradingViewCandleHandler.js`

**Changes needed**:
- Rename `handleD1Candles` to `handleW1Candles`
- Update weekly candle processing logic
- Adjust ADR calculation to use weekly range instead of daily

```javascript
// Line 22: Rename method
handleW1Candles(chartSession, w1Candles, symbol, data) {
    if (!w1Candles || w1Candles.length === 0) return;

    const parsedW1 = w1Candles.map(c => ({
        time: c.v[0],
        open: c.v[1],
        high: c.v[2],
        low: c.v[3],
        close: c.v[4],
        volume: c.v[5]
    }));

    // ... rest of the method logic
}

// Line 123: Update ADR calculation for weekly
calculateAdr(candles, lookbackWeeks = 8) {  // Was 14 days
    if (candles.length < lookbackWeeks + 1) return 0;

    const startIndex = Math.max(0, candles.length - 1 - lookbackWeeks);
    const adrCandles = candles.slice(startIndex, candles.length - 1);

    if (adrCandles.length === 0) return 0;

    const ranges = adrCandles.map(c => c.high - c.low);
    return ranges.reduce((a, b) => a + b, 0) / ranges.length;
}
```

#### 1.4 Update MarketProfileService.js

**File**: `/workspaces/neurosensefx/services/tick-backend/MarketProfileService.js`

**Changes needed**:
- Remove daily boundary detection
- Add weekly boundary detection
- Update reset logic for weekly periods
- Adjust max levels for weekly ranges

```javascript
// Line 415-420: Replace _getUtcDayStart with _getUtcWeekStart
_getUtcWeekStart(timestamp) {
    if (!timestamp || typeof timestamp !== 'number') {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString().split('T')[0];
    }
    const date = new Date(timestamp);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay()).toISOString().split('T')[0];
}

// Line 286-312: Update boundary detection logic
// Check if new data is from a different UTC week (weekly boundary detection)
const existingWeekStart = this._getUtcWeekStart(existingProfile.lastUpdate);
const newDataWeekStart = m1Bars && m1Bars.length > 0
    ? this._getUtcWeekStart(m1Bars[0].timestamp)
    : this._getUtcWeekStart(Date.now());

if (existingWeekStart === newDataWeekStart) {
    // Same week - safe to skip reinitialization
    console.log(`[MarketProfileService] ${symbol} already initialized for ${newDataWeekStart}, skipping reinitialization`);
    // ...
} else {
    // Different week - weekly boundary crossed, must reset
    console.log(`[MarketProfileService] ${symbol} weekly boundary detected: ${existingWeekStart} → ${newDataWeekStart}, resetting profile`);
    existingProfile.levels.clear();
    this.sequenceNumbers.delete(symbol);
    // Clear deduplication state for new week
    this.lastBarTimestamps.delete(`${symbol}:ctrader`);
    this.lastBarTimestamps.delete(`${symbol}:tradingview`);
}
```

#### 1.5 Update Market Profile Config

**File**: `/workspaces/neurosensefx/src/lib/marketProfileConfig.js`

**Changes needed**:
- Update session hours to match typical trading week
- Adjust max history to weeks instead of days
- Update value area percentage for weekly profiles

```javascript
export const marketProfileConfig = {
  bucketMode: 'pipette',
  sessionHours: { start: 0, end: 24 },  // Keep 24/7 for forex
  maxHistoryWeeks: 4,  // Was maxHistoryDays: 1
  valueAreaPercentage: 0.65,  // Slightly lower for weekly profiles
  // ... rest of config
};
```

### Phase 2: Frontend Changes

#### 2.1 Update Market Profile Renderer

**File**: `/workspaces/neurosensefx/src/lib/marketProfile/orchestrator.js`

**Changes needed**:
- Update rendering configuration for weekly profiles
- Adjust scaling for larger price ranges
- Update value area calculations for weekly data

```javascript
// In renderMarketProfile function
const baseConfig = createDayRangeConfig({ marketData }, width, height, getConfig);
// Adjust for weekly profiles
baseConfig.lookbackPeriod = 4;  // 4 weeks instead of days
```

#### 2.2 Update Display Data Processor

**File**: `/workspaces/neurosensefx/src/lib/displayDataProcessor.js`

**Changes needed**:
- Update bucket size calculation for weekly ranges
- Adjust ADR calculations for weekly periods

```javascript
// Update ADR calculation for weekly
export function calculateWeeklyADR(symbolData, lookbackWeeks = 8) {
    // Implementation for weekly ADR calculation
    // Weekly ranges are typically larger than daily
}
```

#### 2.3 Update UseSymbolData Composable

**File**: `/workspaces/neurosensefx/src/composables/useSymbolData.js`

**Changes needed**:
- Update processing logic for weekly profile updates
- Adjust buildInitialProfile for weekly data

```javascript
// In buildProfile function
function buildProfile(initialData, bucketSize, symbolData) {
    if (!initialData || initialData.length === 0) {
        return { profile: [], actualBucketSize: bucketSize };
    }
    // Adjust for weekly data - larger price ranges
    const adjustedBucketSize = adjustBucketSizeForWeekly(initialData, bucketSize);
    return buildInitialProfile(initialData, adjustedBucketSize, symbolData);
}
```

### Phase 3: Testing and Validation

#### 3.1 Backend Testing

**Test Cases**:
1. Verify TradingView subscription with `'1W'` timeframe
2. Test weekly boundary detection and profile reset
3. Validate weekly ADR calculations
4. Test market profile processing with weekly data

**Test Files to Update**:
- `/workspaces/neurosensefx/services/tick-backend/test-timeframe.js` - Add weekly timeframe tests
- Update existing E2E tests for weekly profiles

#### 3.2 Frontend Testing

**Test Cases**:
1. Verify weekly market profile rendering
2. Test value area calculations for weekly data
3. Validate price scale adjustments
4. Test mini market profile with weekly data

**Test Files to Update**:
- `/workspaces/neurosensefx/tests/e2e/market-profile-*.spec.cjs` - Update for weekly tests

### Phase 4: Documentation and Migration

#### 4.1 Update Documentation

- Update API documentation for weekly timeframe support
- Update README with weekly profile configuration
- Create migration guide for existing users

#### 4.2 Configuration Migration

- Add weekly timeframe option to workspace configuration
- Update default settings to use weekly profiles
- Provide migration script for existing setups

## Implementation Timeline

### Week 1: Backend Changes
- Days 1-2: Update TradingViewSubscriptionManager and TradingViewSession
- Days 3-4: Update TradingViewCandleHandler and MarketProfileService
- Day 5: Backend testing and validation

### Week 2: Frontend Changes
- Days 1-2: Update market profile components
- Days 3-4: Update data processing and rendering
- Day 5: Frontend testing

### Week 3: Integration Testing
- Days 1-2: End-to-end testing
- Days 3-4: Performance testing with weekly data
- Day 5: Bug fixes and optimization

### Week 4: Documentation and Release
- Days 1-2: Update documentation
- Days 3-4: Migration script and configuration
- Day 5: Release preparation

## Risk Assessment

### High Risk Items
1. **TradingView API Compatibility**: Ensure `'1W'` timeframe is supported for all symbols
2. **Performance Impact**: Weekly profiles may have more price levels, monitor performance
3. **Data Volume**: Weekly candles may return different data volumes

### Mitigation Strategies
1. Test with multiple symbols before deployment
2. Implement max levels check in MarketProfileService
3. Monitor memory usage during weekly profile generation

## Success Criteria

1. Market profile uses weekly timeframe (1W) instead of daily (1D)
2. Weekly boundary detection works correctly
3. Weekly ADR calculations are accurate
4. Frontend renders weekly profiles correctly
5. Performance meets requirements
6. All tests pass

## Rollout Plan

1. **Beta Testing**: Deploy to staging environment with weekly profiles
2. **Canary Release**: Roll out to 10% of users
3. **Gradual Rollout**: Increase to 50%, then 100% of users
4. **Monitoring**: Monitor performance and user feedback closely

## Post-Implementation

1. Collect user feedback on weekly profiles
2. Monitor performance metrics
3. Address any issues discovered post-launch
4. Update documentation based on user feedback