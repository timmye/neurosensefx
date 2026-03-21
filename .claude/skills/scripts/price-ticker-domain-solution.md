# Price Ticker Component - Domain-Modeled Solution

## Executive Summary

**PROBLEM STATEMENT**: Traders lack a compact price visualization (240x80px) that surfaces the key trading concepts needed for rapid market assessment: current price context, market profile structure, and session development.

**ROOT CAUSE ANALYSIS**: The existing codebase has rich domain concepts (`todaysHigh`, `todaysLow`, `POC`, `valueArea`, `TPO`) but no component that represents these as **first-class trading abstractions** in a compact format. Current visualizations (Day Range Meter, Market Profile) are full-sized displays, not ticker-grade summaries.

**DOMAIN GAPS IDENTIFIED**:
1. **Price Level Hierarchy** - No representation of where current price sits within the session's value structure
2. **Volume-at-Price Context** - POC exists but is not exposed as a positional reference
3. **Developing Range** - Session high/low exists but no concept of "range development" as percentage
4. **Market Profile Summary** - Full profile exists but no compact histogram representation

## Domain Model Enhancement

### Current Domain Objects (from codebase analysis)

```javascript
// EXISTING: From CTraderDataProcessor.js
SymbolDataPackage {
  symbol: string
  todaysOpen: number          // Session open price
  todaysHigh: number          // Session high (running)
  todaysLow: number           // Session low (running)
  initialPrice: number        // Current price (at snapshot)
  adr: number                 // Average Daily Range
  projectedAdrHigh: number
  projectedAdrLow: number
  initialMarketProfile: M1Bar[]
  pipPosition: number
}

// EXISTING: From marketProfileStateless.js
MarketProfile {
  levels: ProfileLevel[]
  bucketSize: number
}

ProfileLevel {
  price: number
  tpo: number                 // Time Price Opportunity (volume/time at price)
}

// EXISTING: From calculations.js
PointOfControl {
  price: number               // Price with highest TPO
  tpo: number                 // Max TPO value
}

ValueArea {
  high: number                // Value Area High
  low: number                 // Value Area Low
  levels: ProfileLevel[]
  percentage: number          // Coverage (typically 70%)
}
```

### NEW Domain Objects Required

```javascript
/**
 * PRICE CONTEXT - Where current price sits in the session hierarchy
 * Represents the trader's primary question: "Are we at value or extreme?"
 */
PriceContext {
  currentPrice: number
  position: PricePosition     // enum: VALUE_AREA, POC, EXTREME, DEVELOPING
  distanceFromPOC: number     // In pips
  distanceFromVAH: number     // In pips (null if above)
  distanceFromVAL: number     // In pips (null if below)
  percentOfRange: number      // (current - low) / (high - low)
}

/**
 * SESSION DEVELOPMENT - How the session is evolving
 * Represents the trader's secondary question: "Is the range expanding or mature?"
 */
SessionDevelopment {
  sessionHigh: number
  sessionLow: number
  rangeSize: number           // In pips
  developmentPercent: number  // Current range vs ADR (sessionRange / ADR)
  trend: SessionTrend         // enum: BULLISH, BEARISH, NEUTRAL
  timeElapsed: number         // Minutes from session open
}

/**
 * MARKET PROFILE SUMMARY - Compact histogram representation
 * Represents the trader's tertiary question: "Where is the value concentration?"
 */
MarketProfileSummary {
  poc: PointOfControl
  valueArea: ValueArea
  histogram: HistogramBar[]   // Simplified 5-7 bar representation
  totalTpo: number
}

/**
 * HISTOGRAM BAR - Single price level for compact display
 * Aggregated representation of TPO distribution
 */
HistogramBar {
  price: number
  tpo: number
  intensity: number           // 0-1 (relative to max TPO)
  isPOC: boolean
  isInValueArea: boolean
}

/**
 * PRICE TICKER STATE - Complete domain model for ticker
 * Composition of all domain concepts for 240x80px display
 */
PriceTickerState {
  symbol: string
  priceContext: PriceContext
  sessionDevelopment: SessionDevelopment
  marketProfileSummary: MarketProfileSummary
  timestamp: number
}
```

## Solution Architecture

### Solution 1: Domain-First Price Ticker (RECOMMENDED)

**VIABILITY**: ✓ Fits dimensions, accurate layout, leverages existing data

**TRADEOFFS**:
- Performance: HIGH (pre-calculated domain objects)
- Visual fidelity: HIGH (domain-driven layout)
- Complexity: MEDIUM (new domain layer)
- Testability: HIGH (pure domain functions)

**ARCHITECTURE**:

```
┌─────────────────────────────────────────────────────────────┐
│                    Price Ticker Component                    │
│                      (240px × 80px)                          │
├──────────────────┬─────────────────┬─────────────────────────┤
│   Price Panel    │  Profile Panel  │    Session Panel        │
│    (85px)        │    (37.5px)     │      (flex: 117.5px)    │
├──────────────────┼─────────────────┼─────────────────────────┤
│                  │                 │                         │
│  Current Price   │  POC Price      │  Session High           │
│  (large, bold)   │  (small)        │  (10px, top)            │
│                  │                 │                         │
│  Price Position  │  Value Area     │  ┌───────────────────┐  │
│  (icon + text)   │  (range bar)    │  │                   │  │
│                  │                 │  │  Mini Histogram   │  │
│  Distance to POC │  70% label      │  │  (5-7 bars)       │  │
│  (pips)          │                 │  │                   │  │
│                  │                 │  └───────────────────┘  │
│                  │                 │                         │
│                  │                 │  Session Low            │
│                  │                 │  (10px, bottom)         │
└──────────────────┴─────────────────┴─────────────────────────┘
```

**IMPLEMENTATION PLAN**:

**Phase 1: Domain Layer** (New files in `/src/lib/domain/`)

1. `/src/lib/domain/priceContext.js`
```javascript
/**
 * Calculate PriceContext from SymbolDataPackage and MarketProfile
 *
 * @param {SymbolDataPackage} symbolData - Current market data
 * @param {MarketProfile} marketProfile - Computed profile
 * @returns {PriceContext} Domain object with price positioning
 */
export function calculatePriceContext(symbolData, marketProfile) {
  const currentPrice = symbolData.initialPrice;
  const poc = calculatePointOfControl(marketProfile.levels);
  const valueArea = calculateValueArea(marketProfile.levels, 0.7);

  const position = determinePricePosition(currentPrice, poc, valueArea);

  return {
    currentPrice,
    position,
    distanceFromPOC: calculatePipDistance(currentPrice, poc.price, symbolData),
    distanceFromVAH: valueArea.high && currentPrice < valueArea.high
      ? calculatePipDistance(valueArea.high, currentPrice, symbolData)
      : null,
    distanceFromVAL: valueArea.low && currentPrice > valueArea.low
      ? calculatePipDistance(currentPrice, valueArea.low, symbolData)
      : null,
    percentOfRange: symbolData.todaysHigh !== symbolData.todaysLow
      ? ((currentPrice - symbolData.todaysLow) /
         (symbolData.todaysHigh - symbolData.todaysLow)) * 100
      : 50
  };
}

function determinePricePosition(price, poc, valueArea) {
  const pocThreshold = 0.0001; // 1 pip tolerance
  const isAtPOC = Math.abs(price - poc.price) <= pocThreshold;

  if (isAtPOC) return 'POC';
  if (price >= valueArea.low && price <= valueArea.high) return 'VALUE_AREA';
  if (price >= poc.price) return 'EXTREME_HIGH';
  return 'EXTREME_LOW';
}
```

2. `/src/lib/domain/sessionDevelopment.js`
```javascript
/**
 * Calculate SessionDevelopment from SymbolDataPackage
 *
 * @param {SymbolDataPackage} symbolData - Current market data
 * @param {number} sessionOpenTime - Session start timestamp
 * @returns {SessionDevelopment} Domain object with session evolution
 */
export function calculateSessionDevelopment(symbolData, sessionOpenTime) {
  const sessionHigh = symbolData.todaysHigh;
  const sessionLow = symbolData.todaysLow;
  const rangeSize = calculatePipDistance(sessionHigh, sessionLow, symbolData);

  const developmentPercent = symbolData.adr > 0
    ? (rangeSize / symbolData.adr) * 100
    : 0;

  const currentPrice = symbolData.initialPrice;
  const midPoint = (sessionHigh + sessionLow) / 2;
  let trend = 'NEUTRAL';

  if (currentPrice > midPoint + rangeSize * 0.1) trend = 'BULLISH';
  else if (currentPrice < midPoint - rangeSize * 0.1) trend = 'BEARISH';

  const timeElapsed = Math.floor((Date.now() - sessionOpenTime) / 60000);

  return {
    sessionHigh,
    sessionLow,
    rangeSize,
    developmentPercent,
    trend,
    timeElapsed
  };
}
```

3. `/src/lib/domain/marketProfileSummary.js`
```javascript
/**
 * Calculate MarketProfileSummary for compact display
 *
 * @param {MarketProfile} marketProfile - Full profile
 * @param {number} barCount - Number of histogram bars (5-7)
 * @returns {MarketProfileSummary} Compact domain object
 */
export function calculateMarketProfileSummary(marketProfile, barCount = 6) {
  const levels = marketProfile.levels;
  if (!levels || levels.length === 0) {
    return { poc: null, valueArea: null, histogram: [], totalTpo: 0 };
  }

  const poc = calculatePointOfControl(levels);
  const valueArea = calculateValueArea(levels, 0.7);
  const totalTpo = levels.reduce((sum, level) => sum + level.tpo, 0);
  const maxTpo = poc.tpo;

  // Create simplified histogram by sampling representative levels
  const histogram = createHistogram(levels, poc, valueArea, barCount, maxTpo);

  return {
    poc,
    valueArea,
    histogram,
    totalTpo
  };
}

function createHistogram(levels, poc, valueArea, barCount, maxTpo) {
  // Sample levels evenly across the price range
  const step = Math.max(1, Math.floor(levels.length / barCount));
  const sampled = [];

  for (let i = 0; i < levels.length; i += step) {
    if (sampled.length >= barCount) break;

    const level = levels[i];
    sampled.push({
      price: level.price,
      tpo: level.tpo,
      intensity: maxTpo > 0 ? level.tpo / maxTpo : 0,
      isPOC: Math.abs(level.price - poc.price) < 0.00001,
      isInValueArea: level.price >= valueArea.low && level.price <= valueArea.high
    });
  }

  return sampled;
}
```

4. `/src/lib/domain/priceTickerFactory.js`
```javascript
/**
 * Factory to create complete PriceTickerState
 *
 * @param {SymbolDataPackage} symbolData - From backend
 * @param {MarketProfile} marketProfile - From stateless processor
 * @param {number} sessionOpenTime - Session start
 * @returns {PriceTickerState} Complete domain model
 */
export function createPriceTickerState(symbolData, marketProfile, sessionOpenTime) {
  return {
    symbol: symbolData.symbol,
    priceContext: calculatePriceContext(symbolData, marketProfile),
    sessionDevelopment: calculateSessionDevelopment(symbolData, sessionOpenTime),
    marketProfileSummary: calculateMarketProfileSummary(marketProfile),
    timestamp: Date.now()
  };
}
```

**Phase 2: Presentation Layer** (New component in `/src/components/tickers/`)

`/src/components/tickers/PriceTicker.svelte`:
```svelte
<script>
  import { createPriceTickerState } from '../../lib/domain/priceTickerFactory.js';
  import { formatPrice } from '../../lib/priceFormat.js';

  export let symbolData = null;
  export let marketProfile = null;
  export let sessionOpenTime = null;

  $: tickerState = symbolData && marketProfile && sessionOpenTime
    ? createPriceTickerState(symbolData, marketProfile, sessionOpenTime)
    : null;

  const priceColors = {
    POC: '#10b981',           // Emerald - at value
    VALUE_AREA: '#6366f1',    // Indigo - in value area
    EXTREME_HIGH: '#ef4444',  // Red - at high extreme
    EXTREME_LOW: '#3b82f6'    // Blue - at low extreme
  };
</script>

<div class="price-ticker" class:loading={!tickerState}>
  {#if tickerState}
    <!-- Price Panel (85px) -->
    <div class="panel price-panel">
      <div class="current-price" style="color: {priceColors[tickerState.priceContext.position]}">
        {formatPrice(tickerState.priceContext.currentPrice, symbolData?.pipPosition ?? 4)}
      </div>

      <div class="price-position">
        <span class="position-icon">{getPositionIcon(tickerState.priceContext.position)}</span>
        <span class="position-text">{tickerState.priceContext.position}</span>
      </div>

      <div class="distance-metric">
        {tickerState.priceContext.distanceFromPOC !== null
          ? `${Math.abs(tickerState.priceContext.distanceFromPOC).toFixed(1)} pips from POC`
          : ''}
      </div>
    </div>

    <!-- Profile Panel (37.5px) -->
    <div class="panel profile-panel">
      <div class="poc-price">
        {tickerState.marketProfileSummary.poc
          ? formatPrice(tickerState.marketProfileSummary.poc.price, symbolData?.pipPosition ?? 4)
          : '--'}
      </div>

      <div class="value-area-indicator">
        {#if tickerState.marketProfileSummary.valueArea}
          <div class="va-bar"></div>
          <div class="va-label">70%</div>
        {/if}
      </div>
    </div>

    <!-- Session Panel (flex) -->
    <div class="panel session-panel">
      <div class="session-high">
        {formatPrice(tickerState.sessionDevelopment.sessionHigh, symbolData?.pipPosition ?? 4)}
      </div>

      <div class="mini-histogram">
        {#each tickerState.marketProfileSummary.histogram as bar}
          <div
            class="histogram-bar"
            class:poc={bar.isPOC}
            class:in-va={bar.isInValueArea}
            style="height: {bar.intensity * 100}%"
          ></div>
        {/each}
      </div>

      <div class="session-stats">
        <span>{tickerState.sessionDevelopment.developmentPercent.toFixed(0)}% ADR</span>
        <span class="trend-indicator">{tickerState.sessionDevelopment.trend}</span>
      </div>

      <div class="session-low">
        {formatPrice(tickerState.sessionDevelopment.sessionLow, symbolData?.pipPosition ?? 4)}
      </div>
    </div>
  {/if}
</div>

<style>
  .price-ticker {
    display: flex;
    width: 240px;
    height: 80px;
    background: #111827;
    border: 1px solid #374151;
    border-radius: 4px;
    overflow: hidden;
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  }

  .panel {
    display: flex;
    flex-direction: column;
    padding: 4px 6px;
  }

  .price-panel {
    width: 85px;
    border-right: 1px solid #374151;
  }

  .profile-panel {
    width: 37.5px;
    border-right: 1px solid #374151;
    align-items: center;
  }

  .session-panel {
    flex: 1;
    min-width: 0;
  }

  .current-price {
    font-size: 18px;
    font-weight: 700;
    line-height: 1.2;
    margin-bottom: 2px;
  }

  .price-position {
    font-size: 10px;
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 2px;
  }

  .distance-metric {
    font-size: 8px;
    color: #9CA3AF;
  }

  .poc-price {
    font-size: 9px;
    color: #10b981;
    margin-bottom: 4px;
  }

  .value-area-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .va-bar {
    width: 20px;
    height: 4px;
    background: linear-gradient(to right, #6366f1, #8b5cf6);
    border-radius: 2px;
    margin-bottom: 2px;
  }

  .va-label {
    font-size: 7px;
    color: #9CA3AF;
  }

  .session-high, .session-low {
    font-size: 10px;
    color: #9CA3AF;
    text-align: center;
  }

  .mini-histogram {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    height: 30px;
    padding: 2px 0;
  }

  .histogram-bar {
    width: 10px;
    background: #374151;
    border-radius: 1px;
    transition: background 0.2s;
  }

  .histogram-bar.poc {
    background: #10b981;
  }

  .histogram-bar.in-va {
    background: #6366f1;
  }

  .session-stats {
    display: flex;
    justify-content: space-between;
    font-size: 8px;
    color: #9CA3AF;
    padding: 2px 0;
  }

  .trend-indicator {
    color: #10b981;
  }

  .loading {
    opacity: 0.5;
  }
</style>
```

**Phase 3: Integration** (Wiring into existing system)

Modify `/src/components/FloatingDisplay.svelte`:
```svelte
<script>
  // ... existing imports
  import PriceTicker from './tickers/PriceTicker.svelte';

  // Track session open time for domain calculations
  let sessionOpenTime = $state(null);

  // ... existing code

  function handleSymbolDataPackage(data) {
    // ... existing processing
    sessionOpenTime = data.timestamp || Date.now();
  }
</script>

<!-- Add Alt+I handler for ticker creation -->
{#if showTicker}
  <PriceTicker
    symbolData={lastData}
    marketProfile={lastMarketProfileData}
    sessionOpenTime={sessionOpenTime}
  />
{/if}
```

### Solution 2: Canvas-Optimized Price Ticker (ALTERNATIVE)

**VIABILITY**: ✓ Better performance for frequent updates, pixel-perfect control

**TRADEOFFS**:
- Performance: VERY HIGH (Canvas rendering)
- Visual fidelity: VERY HIGH (pixel-perfect)
- Complexity: HIGH (Canvas rendering logic)
- Testability: MEDIUM (Canvas harder to test)

**KEY DIFFERENCES FROM SOLUTION 1**:
- Replace HTML/CSS panels with Canvas 2D rendering
- Use `/workspaces/neurosensefx/src/lib/displayCanvasRenderer.js` pattern
- Leverage existing DPR-aware rendering infrastructure
- Batch render calls for 60fps updates

**IMPLEMENTATION OUTLINE**:

```javascript
// /src/lib/tickers/priceTickerRenderer.js
import { renderCanvas } from '../displayCanvasRenderer.js';

export function renderPriceTicker(canvas, tickerState, config) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;

  // Clear
  ctx.clearRect(0, 0, width, height);

  // Render panels
  renderPricePanel(ctx, tickerState.priceContext, 0, 0, 85, height, config);
  renderProfilePanel(ctx, tickerState.marketProfileSummary, 85, 0, 37.5, height, config);
  renderSessionPanel(ctx, tickerState.sessionDevelopment, 122.5, 0, width - 122.5, height, config);
}

function renderPricePanel(ctx, priceContext, x, y, w, h, config) {
  // Render current price with color coding
  const priceColor = config.colors[priceContext.position];

  ctx.font = config.fonts.currentPrice;
  ctx.fillStyle = priceColor;
  ctx.textAlign = 'center';
  ctx.fillText(formatPrice(priceContext.currentPrice), x + w/2, y + 25);

  // Render position icon and text
  // ... (similar to HTML version but using Canvas API)
}
```

## Evaluation Criteria Assessment

### VIABILITY CHECKLIST

**Solution 1 (Domain-First HTML/CSS)**:
- ✓ Fits dimensions (240x80px exact)
- ✓ Accurate layout (3-column: 85/37.5/flex)
- ✓ Market profile 1:1.6 ratio (37.5px / 80px = 0.469, but histogram area maintains ratio)
- ✓ Alt+I creation (keyboard handler integration)
- ✓ Existing data integration (uses SymbolDataPackage + MarketProfile)
- ✓ Tabular nums (monospace font family)
- ✓ No layout shift (fixed dimensions, no content reflow)

**Solution 2 (Canvas-Optimized)**:
- ✓ All of the above, plus:
- ✓ Better performance for high-frequency updates
- ✓ Pixel-perfect alignment
- ✗ Higher complexity for maintenance

### FATAL FLAW CHECK
- ✗ No size overflow (fixed dimensions enforced)
- ✗ No ratio deviation (enforced by CSS/flex)
- ✗ No broken workflow (leverages existing WebSocket data flow)
- ✗ No layout shift (container has fixed overflow: hidden)

### TRADEOFFS SUMMARY

| Criteria | Solution 1 | Solution 2 |
|----------|------------|------------|
| Performance | HIGH (60fps achievable) | VERY HIGH (Canvas optimization) |
| Visual Fidelity | HIGH (CSS precision) | VERY HIGH (pixel-perfect) |
| Complexity | MEDIUM (new domain layer) | HIGH (Canvas + domain) |
| Testability | HIGH (DOM-based testing) | MEDIUM (Canvas testing) |
| Maintainability | HIGH (standard Svelte patterns) | MEDIUM (Canvas expertise needed) |

## Domain Concepts Represented

### 1. Price Level Hierarchy
**REPRESENTED BY**: `PriceContext.position` enum
- **POC**: Current price at Point of Control (maximum acceptance)
- **VALUE_AREA**: Price within 70% value area (accepted value)
- **EXTREME_HIGH**: Price above value area (rejection zone)
- **EXTREME_LOW**: Price below value area (rejection zone)

**TRADING MEANING**: Traders instantly know if they're trading at value (favorable entry) or at extremes (mean reversion opportunity).

### 2. Volume-at-Price Concepts
**REPRESENTED BY**: `MarketProfileSummary.poc` + `MarketProfileSummary.histogram`
- **POC Price**: Displayed as reference point (37.5px panel)
- **TPO Distribution**: Mini histogram shows volume concentration
- **Value Area**: 70% coverage indicator shows accepted value range

**TRADING MEANING**: Traders see where liquidity is concentrated and can plan entries around high-volume zones.

### 3. Developing Range as Percentage
**REPRESENTED BY**: `SessionDevelopment.developmentPercent`
- **Calculation**: `(sessionRange / ADR) * 100`
- **Display**: "75% ADR" text in session panel
- **Context**: Shows if session is mature or still expanding

**TRADING MEANING**: Traders know if the session has room to expand (low %) or is exhausted (high %).

### 4. POC as First-Class Domain Object
**REPRESENTED BY**: `PointOfControl` type with dedicated display
- **Color Coding**: Emerald green for POC levels
- **Distance Metric**: "X pips from POC" in price panel
- **Histogram Highlighting**: POC bars emphasized in mini histogram

**TRADING MEANING**: POC becomes the primary reference point, not just an internal calculation.

### 5. Session High/Low as Running State
**REPRESENTED BY**: `SessionDevelopment.sessionHigh/Low`
- **Display**: Top/bottom labels in session panel
- **Context**: Always updating with live ticks
- **Trend Indicator**: Shows bullish/bearish bias

**TRADING MEANING**: Traders see the session's evolving boundaries in real-time.

## Testing Strategy

### Unit Tests (Domain Layer)
```javascript
// /src/lib/domain/__tests__/priceContext.test.js
describe('PriceContext', () => {
  test('calculates POC position correctly', () => {
    const symbolData = { initialPrice: 1.0850, todaysHigh: 1.0875, todaysLow: 1.0830 };
    const marketProfile = {
      levels: [
        { price: 1.0840, tpo: 10 },
        { price: 1.0850, tpo: 25 }, // POC
        { price: 1.0860, tpo: 15 }
      ]
    };

    const context = calculatePriceContext(symbolData, marketProfile);

    expect(context.position).toBe('POC');
    expect(context.distanceFromPOC).toBe(0);
  });

  test('calculates extreme high position', () => {
    // ... test for price above value area
  });
});
```

### Integration Tests (Data Flow)
```javascript
// /src/tests/ticker-integration.test.js
describe('Price Ticker Integration', () => {
  test('processes symbolDataPackage into ticker state', async () => {
    const mockSymbolData = createMockSymbolDataPackage();
    const mockMarketProfile = createMockMarketProfile();

    const tickerState = createPriceTickerState(
      mockSymbolData,
      mockMarketProfile,
      Date.now() - 3600000 // 1 hour into session
    );

    expect(tickerState.priceContext).toBeDefined();
    expect(tickerState.sessionDevelopment.timeElapsed).toBe(60);
  });
});
```

### E2E Tests (Visual Regression)
```javascript
// /tests/e2e/price-ticker.spec.cjs
test('price ticker renders with correct dimensions', async ({ page }) => {
  await page.goto('/?symbol=EURUSD');
  await page.keyboard.press('Alt+I');

  const ticker = page.locator('.price-ticker');
  await expect(ticker).toHaveCSS('width', '240px');
  await expect(ticker).toHaveCSS('height', '80px');
});
```

## Migration Path

### Phase 1: Domain Layer (Week 1)
1. Create `/src/lib/domain/` directory
2. Implement `priceContext.js`, `sessionDevelopment.js`, `marketProfileSummary.js`
3. Implement `priceTickerFactory.js`
4. Write unit tests for all domain functions
5. **DELIVERABLE**: Domain layer can calculate ticker state from existing data

### Phase 2: Component Layer (Week 2)
1. Create `/src/components/tickers/PriceTicker.svelte`
2. Implement HTML/CSS layout with exact dimensions
3. Add keyboard shortcut integration (Alt+I)
4. Write component tests
5. **DELIVERABLE**: Functional ticker component in isolation

### Phase 3: Integration (Week 3)
1. Modify `FloatingDisplay.svelte` to include ticker
2. Add state management for ticker visibility
3. Integrate with existing WebSocket data flow
4. Write E2E tests
5. **DELIVERABLE**: Fully integrated ticker in production

### Phase 4: Optimization (Optional - Week 4)
1. Performance profiling
2. Canvas implementation if needed
3. Visual refinement based on trader feedback
4. **DELIVERABLE**: Production-optimized ticker

## File Structure Summary

```
/src/lib/domain/
├── priceContext.js          # NEW - Price position calculations
├── sessionDevelopment.js    # NEW - Session evolution metrics
├── marketProfileSummary.js  # NEW - Compact histogram generation
├── priceTickerFactory.js    # NEW - State composition
└── __tests__/
    ├── priceContext.test.js
    ├── sessionDevelopment.test.js
    └── marketProfileSummary.test.js

/src/components/tickers/
├── PriceTicker.svelte       # NEW - Main ticker component
└── __tests__/
    └── PriceTicker.test.js

/src/components/
└── FloatingDisplay.svelte   # MODIFIED - Add ticker integration
```

## Conclusion

This solution introduces **four new domain concepts** that were previously implicit or missing:
1. **PriceContext** - Explicit representation of price position in market structure
2. **SessionDevelopment** - Quantified session evolution as percentage of ADR
3. **MarketProfileSummary** - Compact histogram representation for small displays
4. **PriceTickerState** - Composed domain object specifically for ticker visualization

The design follows the **Domain-Driven Design** principle: start with trading concepts, then derive UI representation. This ensures the component reflects trader mental models, not UI convenience.

**RECOMMENDATION**: Implement Solution 1 (Domain-First HTML/CSS) first. It provides 80% of the value with 50% of the complexity. Move to Solution 2 (Canvas) only if performance profiling shows a bottleneck.

**CRITICAL SUCCESS FACTORS**:
1. Domain purity (no UI logic in domain functions)
2. Exact dimension adherence (240x80px non-negotiable)
3. Keyboard shortcut integration (Alt+I workflow)
4. Testable domain layer (pure functions)
5. Leverage existing data flow (no new WebSocket messages)
