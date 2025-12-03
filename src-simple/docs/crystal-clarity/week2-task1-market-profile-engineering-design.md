# Market Profile Engineering Design

## Status
Design Complete - 2025-12-03

## Context
Current visualization system needs market profile capability using M1 OHLC data from backend `symbolDataPackage` response. Must follow Crystal Clarity principles: Simple, Performant, Maintainable.

## Backend Reality Check
**Available Data:**
```json
{
  "type": "symbolDataPackage",
  "symbol": "EURUSD",
  "initialMarketProfile": [
    {
      "open": 1.08500,
      "high": 1.08580,
      "low": 1.08490,
      "close": 1.08560,
      "timestamp": 1701234560000
    }
  ]
}
```

**Data Processing Strategy:**
- Convert M1 OHLC to TPO (Time Price Opportunity) levels
- Group price levels into configurable buckets (0.1 pip increments)
- Count time occurrences at each price level
- Update profile with live tick data after initial load

## Decision
Implement market profile using existing Canvas 2D patterns with M1 OHLC → TPO conversion.

## Engineering Design

### 1. Data Processing Pipeline

**Simple Approach:**
```javascript
// marketProfileProcessor.js
export function processMarketProfileData(data, lastProfile = null) {
  if (data.type === 'symbolDataPackage') {
    return buildInitialProfile(data.initialMarketProfile || []);
  } else if (data.type === 'tick' && lastProfile) {
    return updateProfileWithTick(lastProfile, data);
  }
  return lastProfile;
}

function buildInitialProfile(m1Bars) {
  const priceMap = new Map();

  m1Bars.forEach(bar => {
    const range = generatePriceLevels(bar.low, bar.high);
    range.forEach(price => {
      priceMap.set(price, (priceMap.get(price) || 0) + 1);
    });
  });

  return Array.from(priceMap.entries())
    .map(([price, tpo]) => ({ price, tpo }))
    .sort((a, b) => a.price - b.price);
}
```

**Configuration:**
- Price bucket size: 0.1 pip (configurable per symbol)
- Session hours: 00:00-23:59 (configurable)
- Maximum history: 30 days (configurable)

### 2. Rendering Implementation

**Canvas 2D Pattern (Following existing visualizers):**
```javascript
// marketProfileRenderer.js
export function renderMarketProfile(ctx, data, config) {
  if (!data || data.length === 0) {
    renderStatusMessage(ctx, "No Market Profile Data");
    return;
  }

  const { width, height } = config;
  const padding = 40;
  const profileWidth = width - (padding * 2);
  const profileHeight = height - (padding * 2);

  // Calculate scaling
  const prices = data.map(d => d.price);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const maxTpo = Math.max(...data.map(d => d.tpo));

  const priceScale = profileHeight / (maxPrice - minPrice);
  const tpoScale = profileWidth / maxTpo;

  // Render profile
  data.forEach(level => {
    const x = padding;
    const y = padding + (maxPrice - level.price) * priceScale;
    const barWidth = level.tpo * tpoScale;

    ctx.fillStyle = level.tpo > maxTpo * 0.7 ? '#4a9eff' : '#666';
    ctx.fillRect(x, y, barWidth, 2);

    // Price labels for key levels
    if (level.tpo > maxTpo * 0.8) {
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.fillText(level.price.toFixed(5), x + barWidth + 5, y + 3);
    }
  });

  // POC and value area
  const poc = data.reduce((max, level) =>
    level.tpo > max.tpo ? level : max
  );
  renderPocLine(ctx, poc, config);
}
```

### 3. Integration Strategy

**Follow Existing Pattern:**
```javascript
// Add to visualizers.js
import { renderMarketProfile } from './marketProfileRenderer.js';
export { renderMarketProfile };

// Register the visualization
register('marketProfile', renderMarketProfile);
```

**Display Integration:**
- Update `processSymbolData()` to handle `initialMarketProfile` array
- Add market profile to display types in workspace
- Reuse existing WebSocket connection and data flow

### 4. Performance Plan

**Targets:**
- **Rendering**: 60fps with 500+ price levels
- **Memory**: <10MB per market profile display
- **Data Processing**: <5ms for 30-day profile reconstruction
- **Update Latency**: <50ms from tick to visual update

**Optimizations:**
1. **Lazy Updates**: Only re-render on significant price changes
2. **Level Batching**: Process price levels in chunks for large profiles
3. **Canvas Caching**: Cache static elements (price axis, grid)
4. **Data Throttling**: Update profile every 100ms max during high activity

### 5. Implementation Phases

**Phase 1: Core Data Processing (2-3 hours)**
1. Create `marketProfileProcessor.js`
2. Implement M1 OHLC → TPO conversion
3. Add configuration for bucket size and session hours
4. Test with sample data

**Phase 2: Basic Rendering (2-3 hours)**
1. Create `marketProfileRenderer.js`
2. Implement simple horizontal bar visualization
3. Add price axis and basic styling
4. Integrate with existing canvas system

**Phase 3: Display Integration (1-2 hours)**
1. Update `processSymbolData()` to handle market profile data
2. Register visualization in `visualizers.js`
3. Add market profile option to display creation
4. Test end-to-end workflow

**Phase 4: Enhanced Features (2-3 hours)**
1. Add POC (Point of Control) highlighting
2. Implement value area calculation (70% volume)
3. Add session time indicators
4. Performance optimization and testing

**Phase 5: Live Data Integration (1-2 hours)**
1. Implement real-time profile updates with tick data
2. Add visual indicators for developing session
3. Test with live market data
4. Performance validation

### 6. Configuration System

**Default Configuration:**
```javascript
export const marketProfileConfig = {
  bucketSize: 0.00001, // 0.1 pip for EURUSD
  sessionHours: { start: 0, end: 24 },
  maxHistoryDays: 30,
  colors: {
    profile: '#666',
    poc: '#4a9eff',
    valueArea: 'rgba(74, 158, 255, 0.1)',
    text: '#fff'
  }
};
```

## Consequences

**Benefits:**
- Uses existing Canvas 2D infrastructure (no new dependencies)
- Follows established patterns for maintainability
- Simple data model (price + TPO count)
- Reuses existing WebSocket connection management

**Tradeoffs:**
- Limited to historical M1 data from backend
- No volume data (TPO-based profile only)
- Simple visualization vs traditional market profile graphics

**Integration Points:**
- `displayDataProcessor.js` - add market profile data handling
- `visualizers.js` - register new visualization type
- Existing canvas rendering pipeline
- Current configuration inheritance system

## Testing Strategy

**Unit Tests:**
- TPO calculation accuracy with known M1 data
- Profile scaling and price level generation
- Configuration parameter validation

**Integration Tests:**
- End-to-end data flow from WebSocket to canvas
- Display creation and positioning
- Live data updates during market activity

**Performance Tests:**
- Rendering with 500+ price levels
- Memory usage with multiple market profile displays
- Update latency during high-frequency tick updates

## Files to Create/Modify

**New Files:**
- `lib/marketProfileProcessor.js` - Data processing logic
- `lib/marketProfileRenderer.js` - Canvas rendering
- `lib/marketProfileConfig.js` - Configuration management

**Modified Files:**
- `lib/displayDataProcessor.js` - Handle market profile data
- `lib/visualizers.js` - Register new visualization
- `stores/workspace.js` - Add market profile display type

**Total Estimated Lines:** ~300 lines (well within Crystal Clarity limits)