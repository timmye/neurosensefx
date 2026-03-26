# Data Pipeline Architecture

**Date:** 2026-03-26
**Scope:** Canvases, Market Profile, Day Range Meter, PriceTicker
**Purpose:** Centralized reference for understanding data flow and debugging reactivity issues

---

## Overview

The NeuroSense FX frontend receives real-time market data via WebSocket and transforms it through several pipeline stages before rendering to canvas or DOM elements. This document maps each pipeline from entry point to UI output.

### Key Concepts

| Concept | Description |
|---------|-------------|
| **WebSocket** | Single connection managed by `ConnectionManager` receiving all market data |
| **Callbacks** | Functions invoked when data arrives, updating reactive refs/state |
| **Reactivity** | Svelte's reactive statements (`$:`) automatically re-derive values and re-render |
| **Orchestrators** | Coordination functions that delegate to specialized modules for rendering |

---

## Pipeline 1: Canvases (FloatingDisplay)

### Entry Point
```
WebSocket → ConnectionManager → subscriptionManager.dispatch()
```

**File:** `src/lib/connectionManager.js`

The `ConnectionManager` maintains a singleton WebSocket connection. When messages arrive, they're dispatched to registered callbacks via `subscriptionManager`.

### Data Transformation

```
subscriptionManager.dispatch()
    → callback (created by useDataCallback.createCallback)
        → processSymbolData() → lastDataRef.value update
        → processMarketProfileData() → lastMarketProfileDataRef update
```

**Files:**
- `src/composables/useDataCallback.js:9-51` - Callback factory
- `src/lib/displayDataProcessor.js:26-100` - Core data processing (imported as `processSymbolDataCore` in useDataCallback)

**Key Code:**
```javascript
// useDataCallback.js:9-14 (simplified)
// Note: processSymbolDataCore is an import alias for processSymbolData from displayDataProcessor.js
function createCallback(formattedSymbol, lastDataRef, lastMarketProfileDataRef, canvasRef) {
  return (data) => {
    const result = processSymbolDataCore(data, formattedSymbol, lastDataRef.value);
    if (result?.type === 'data') {
      lastDataRef.value = result.data;  // Triggers Svelte reactivity
    }
    // ... market profile processing with processMarketProfileData()
  };
}
```

### Reactivity Flow

```
lastDataRef.value update (Svelte ref)
    → Svelte detects ref change
    → DisplayCanvas.svelte reactive statements re-execute
    → displayCanvasRenderer.renderWithRenderer() called
    → Renderer draws to canvas
```

**Files:**
- `src/components/FloatingDisplay.svelte` - Container component
- `src/lib/displayCanvasRenderer.js:53-100` - Render coordination

### UI Output

```
displayCanvasRenderer.renderWithRenderer()
    → getRenderer(displayType) → renderDayRange | renderDayRangeWithMarketProfile | renderFxBasket
    → renderer(ctx, data, config)
    → Canvas 2D API calls
```

**Render Types:**
| Display Type | Renderer | Description |
|--------------|----------|-------------|
| `dayRange` | `renderDayRange()` | Day Range Meter only |
| `dayRangeWithMarketProfile` | `renderDayRangeWithMarketProfile()` | Combined view |
| `fxBasket` | `renderFxBasketOrchestrator()` | FX currency basket |

### Sequence Diagram

```
┌──────────┐    ┌──────────────┐    ┌───────────────┐    ┌─────────────┐
│WebSocket │───►│ConnectionMgr │───►│useDataCallback│───►│lastDataRef  │
└──────────┘    └──────────────┘    └───────────────┘    └─────────────┘
                                                                │
                                                                ▼
┌──────────┐    ┌──────────────┐    ┌───────────────┐    ┌─────────────┐
│  Canvas  │◄───│renderWith    │◄───│Svelte reactive│◄───│ref.value    │
│  2D API  │    │Renderer()    │    │statements     │    │update       │
└──────────┘    └──────────────┘    └───────────────┘    └─────────────┘
```

---

## Pipeline 2: Market Profile

### Entry Point
```
Backend MarketProfileService.emit('profileUpdate')
    → WebSocket message {type: 'profileUpdate', profile, symbol, seq, source}
```

**File:** `services/tick-backend/MarketProfileService.js:158`

Market profile data is computed server-side from M1 candle data and pushed to clients.

### Data Transformation (Frontend)

```
profileUpdate message
    → useSymbolData.processSymbolData()
        → Transforms levels array to normalized format
        → Returns {lastMarketProfileData, error}
```

**File:** `src/composables/useSymbolData.js`

**Data Structure:**
```javascript
// profileUpdate message
{
  type: 'profileUpdate',
  symbol: 'BTCUSD',
  profile: {
    levels: [{price: 65000.5, tpo: 3}, {price: 65001.0, tpo: 5}, ...],
    bucketSize: 7.0
  },
  seq: 42,
  source: 'tradingview'
}
```

### Rendering Pipeline

```
marketProfileRenderer.js (facade)
    └── marketProfile/orchestrator.js:14-52
            ├── scaling.js (calculateAdaptiveScale, createPriceScale)
            ├── calculations.js (TPO/value area math)
            └── rendering.js (draw functions)
```

**File:** `src/lib/marketProfile/orchestrator.js:14-52`

**Key Code:**
```javascript
// orchestrator.js:14-52 (simplified)
export function renderMarketProfile(ctx, data, config) {
  // 1. Early data validation
  if (!data || data.length === 0) {
    renderStatusMessage(ctx, "No Market Profile Data", { width, height });
    return;
  }

  // 2. Validate market data context
  if (!validateMarketData(config.marketData, ctx, { width, height })) return;

  // 3. Calculate dimensions and scales
  const dimensions = calculateDimensions(width, height, config);
  const adaptiveScale = calculateAdaptiveScale(data, marketData, width, height);
  const priceScale = createPriceScale(baseConfig, adaptiveScale, height);

  // 4. Compute derived values
  const maxTpo = calculateMaxTpo(data);
  const tpoScale = calculateTpoScale(maxTpo, dimensions.marketProfileWidth);
  const poc = computePOC(data);
  const valueArea = calculateValueArea(data);

  // 5. Render layers
  drawValueArea(ctx, valueArea, priceScale, dimensions.marketProfileStartX, dimensions.marketProfileWidth);
  drawBars(ctx, data, priceScale, tpoScale, dimensions.marketProfileStartX);
  drawPOC(ctx, poc, priceScale, dimensions.marketProfileStartX, width);
}
```

### UI Output

Market profile renders as horizontal bars showing price levels with TPO (Time-Price-Opportunity) counts:
- **Bars**: Horizontal bars extending right from price axis
- **POC**: Point of Control line (highest TPO)
- **Value Area**: Shaded region containing 70% of TPOs

### Module Responsibilities

| Module | Responsibility |
|--------|---------------|
| `orchestrator.js` | Pipeline coordination, error handling |
| `scaling.js` | Price-to-Y coordinate mapping, dimensions |
| `calculations.js` | POC, value area, intensity computations |
| `rendering.js` | Canvas drawing (bars, value area, POC) |

---

## Pipeline 3: Day Range Meter

### Entry Point
```
WebSocket → ConnectionManager → subscriptionManager.dispatch()
    → callback → lastDataRef.value update
```

Same WebSocket entry as Canvases pipeline, but data flows to `renderDayRange()`.

### Data Transformation

```
symbolDataPackage message
    → processSymbolData() in displayDataProcessor.js
        → Normalizes: high, low, current, open, adrHigh, adrLow
        → Adds: pipPosition, pipSize, direction
```

**File:** `src/lib/displayDataProcessor.js:26-100`

**Input/Output:**
```javascript
// Input: WebSocket message
{type: 'symbolDataPackage', symbol: 'BTCUSD', current: 65000, high: 65200, ...}

// Output: Processed data
{high: 65200, low: 64800, current: 65000, open: 64900, adrHigh: 65400, adrLow: 64600, pipPosition: 2, ...}
```

### Rendering Pipeline

```
dayRangeOrchestrator.js
    ├── dayRangeCore.js (renderAdrAxis, renderCenterLine, renderAdrBoundaryLines)
    ├── dayRangeRenderingUtils.js (validateMarketData, createDayRangeConfig, createPriceScale)
    ├── dayRangeCalculations.js (calculateAdaptiveScale, calculateDayRangePercentage)
    └── priceMarkerRenderer.js (renderCurrentPrice, renderOpenPrice, etc.)
```

**File:** `src/lib/dayRangeOrchestrator.js:10-62`

**Key Code:**
```javascript
// dayRangeOrchestrator.js:10-62
export function renderDayRange(ctx, d, s, getConfig, options = {}) {
  const { width, height } = s;

  // 1. Validate market data
  if (!validateMarketData(d, ctx, s)) return;

  // 2. Create configuration and scales
  const config = createDayRangeConfig(s, width, height, getConfig);
  const adaptiveScale = calculateAdaptiveScale(d, config);
  const priceScale = createPriceScale(config, adaptiveScale, height);

  // 3. Render background
  renderBackground(ctx, width, height);

  // 4. Render structural elements
  renderStructuralElements(ctx, config, width, height, priceScale, d, adaptiveScale);

  // 5. Render price markers (current price LAST for z-order)
  renderPriceElementsExceptCurrent(ctx, config, priceScale, d, s);
  renderCurrentPrice(ctx, config, axisX, priceScale, d.current, d);
}
```

### UI Output

Day Range Meter renders as a vertical axis with:
- **ADR Axis**: Vertical line on right side
- **Center Line**: Horizontal line at open price
- **Boundary Lines**: ADR high/low boundaries
- **Price Markers**: Current price, open, high/low, previous day OHLC, TWAP

### Module Responsibilities

| Module | Responsibility |
|--------|---------------|
| `dayRangeOrchestrator.js` | Pipeline coordination |
| `dayRangeCore.js` | Core rendering primitives (lines, text) |
| `dayRangeCalculations.js` | Range/percentage calculations, adaptive scaling |
| `dayRangeRenderingUtils.js` | Validation, config creation, price scale |
| `priceMarkerRenderer.js` | Price marker drawing |

---

## Pipeline 4: PriceTicker

### Entry Point
```
WebSocket → ConnectionManager → useWebSocketSub.subscribe()
    → inline callback → lastData = processed.data
```

**File:** `src/components/PriceTicker.svelte:128-141`

PriceTicker uses an inline callback pattern rather than the `useDataCallback` composable.

### Data Transformation

```
useWebSocketSub.subscribe(callback)
    → processSymbolData(data, formattedSymbol, lastData)
        → Returns {type: 'data', data: displayData}
    → lastData = processed.data
    → await tick() (Svelte's tick to ensure reactivity)
```

**Files:**
- `src/composables/useWebSocketSub.js` - Subscription management
- `src/lib/displayDataProcessor.js:26-100` - Data processing

**Key Code:**
```javascript
// PriceTicker.svelte:128-141
webSocketSub.subscribe(formattedSymbol, ticker.source || 'tradingview', async (data) => {
  const processed = processSymbolData(data, formattedSymbol, lastData);

  if (processed?.type === 'data') {
    lastData = processed.data;
    await tick(); // Ensure Svelte detects state change
  }

  // Handle market profile updates
  if (data.type === 'profileUpdate' && data.profile) {
    lastMarketProfileData = data.profile.levels;
    await tick();
  }
}, 14);
```

### Reactivity Flow

```
lastData update
    → Svelte reactive statements ($:) re-execute
        → currentPrice = lastData?.current
        → highPrice = lastData?.high
        → rangePercent = calculateDayRangePercentage(lastData)
        → dailyChangePercent = ...
    → DOM updates via template bindings
    → Canvas re-renders via reactive block
```

**Files:** `src/components/PriceTicker.svelte:37-43` (core reactive statements)

**Reactive Statements:**
```javascript
// PriceTicker.svelte:37-43 (core reactive values)
$: currentPrice = lastData?.current ?? null;
$: highPrice = lastData?.high ?? null;
$: lowPrice = lastData?.low ?? null;
$: openPrice = lastData?.open ?? null;
$: rangePercent = calculateDayRangePercentage(lastData);
$: direction = lastData?.direction ?? 'neutral';
$: pipPosition = lastData?.pipPosition ?? 4;

// Additional derived values (lines 44+)
$: priceParts = splitPriceParts(currentPrice, pipPosition);
$: dailyChangePercent = currentPrice && openPrice
  ? (((currentPrice - openPrice) / openPrice) * 100).toFixed(2)
  : null;
```

### Canvas Rendering

```
Reactive block ($:) detects currentPrice/canvasRef/lastMarketProfileData
    → renderMiniMarketProfile(canvasRef, lastMarketProfileData, {...})
    → Mini profile rendered in chart column
```

**File:** `src/components/PriceTicker.svelte:100-112`

### UI Output

PriceTicker renders as a compact card with:
- **Identity Column**: Symbol label, large price display with pip emphasis
- **Chart Column**: Mini market profile canvas (37.5px × 80px)
- **Stats Column**: High, daily change %, day range %, low

### Sequence Diagram

```
┌──────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
│WebSocket │───►│useWebSocketSub│───►│processSymbol│───►│lastData     │
│          │    │.subscribe()  │    │Data()       │    │update       │
└──────────┘    └──────────────┘    └─────────────┘    └─────────────┘
                                                              │
              ┌───────────────────────────────────────────────┘
              ▼
┌─────────────┐    ┌───────────────┐    ┌─────────────┐
│Reactive ($:)│───►│Derived values │───►│DOM template │
│statements   │    │currentPrice   │    │bindings     │
└─────────────┘    │dailyChange%   │    └─────────────┘
                   │rangePercent   │
                   └───────────────┘
```

---

## Shared Utilities

### Data Processing

| Function | File | Purpose |
|----------|------|---------|
| `processSymbolData()` | `displayDataProcessor.js` | Normalize WebSocket data to display format |
| `calculateDayRangePercentage()` | `dayRangeCalculations.js` | Calculate % of ADR traversed |
| `calculateAdaptiveScale()` | `dayRangeCalculations.js` | Compute price-to-pixel scale |

### Rendering

| Function | File | Purpose |
|----------|------|---------|
| `setupCanvas()` | `dayRangeCore.js` | DPR-aware canvas initialization |
| `validateMarketData()` | `dayRangeRenderingUtils.js` | Ensure data has required fields |
| `createPriceScale()` | `dayRangeRenderingUtils.js` | Create price→Y coordinate function |

### Configuration

| Module | File | Purpose |
|--------|------|---------|
| `getConfig()` | `dayRangeConfig.js` | Default display configuration |
| `createDayRangeConfig()` | `dayRangeRenderingUtils.js` | Merge user config with defaults |

---

## Debugging Guide

### Common Reactivity Issues

| Symptom | Likely Cause | Debug Step |
|---------|--------------|------------|
| Canvas not updating | Ref not updated in callback | Add console.log in callback to verify ref.value changes |
| Stale data displayed | Callback not registered | Check subscriptionManager.hasCallback(symbol) |
| Partial updates | Data missing required fields | Check validateMarketData() output |
| Race conditions | Multiple callbacks for same symbol | Check subscription count per symbol |

### Debug Logging

Each pipeline has debug logging at key points:

```javascript
// Canvases: useDataCallback.js:25-43
console.log('[useDataCallback] profileResult:', {...});

// Market Profile: orchestrator.js:38-39
console.log('[DEBUGGER:orchestrator:34-35] maxTpo=${maxTpo}...');

// Day Range: dayRangeOrchestrator.js:11-23
console.log('[DAY_RANGE_ORCHESTRATOR] renderDayRange called with:', {...});

// PriceTicker: orchestrator.js:76-79 (mini profile)
console.log('[renderMiniMarketProfile] Rendering profile with', ...);
```

### Validation Checklist

When reactivity breaks, verify:

1. **WebSocket connected**: `connectionManager.isConnected()`
2. **Subscription active**: `webSocketSub?.isActive()`
3. **Callback registered**: `subscriptionManager.hasCallback(symbol)`
4. **Data arriving**: Check console for `[useDataCallback]` logs
5. **Ref updating**: Add console.log after ref.value assignment
6. **Reactive statements**: Verify `$:` dependencies include changing values

---

## File Reference

### Canvases Pipeline
```
src/
├── composables/
│   └── useDataCallback.js           # Callback factory (lines 9-51)
├── lib/
│   ├── displayCanvasRenderer.js     # Render coordination (lines 28-100)
│   ├── displayDataProcessor.js      # Data normalization (lines 26-100)
│   └── connectionManager.js         # WebSocket lifecycle
└── components/
    └── FloatingDisplay.svelte       # UI container
```

### Market Profile Pipeline
```
src/lib/
├── marketProfile/
│   ├── orchestrator.js              # Pipeline coordination (lines 14-52)
│   ├── scaling.js                   # Price scale, dimensions
│   ├── calculations.js              # TPO, POC, value area
│   └── rendering.js                 # Canvas drawing
├── marketProfileRenderer.js         # Facade entry point
└── marketProfileProcessor.js        # Data transformation

services/tick-backend/
└── MarketProfileService.js          # Server-side profile computation
```

### Day Range Meter Pipeline
```
src/lib/
├── dayRangeOrchestrator.js          # Pipeline coordination (lines 10-102)
├── dayRangeCore.js                  # Rendering primitives
├── dayRangeCalculations.js          # Scale, percentage calculations
├── dayRangeRenderingUtils.js        # Validation, config
├── dayRangeConfig.js                # Configuration constants
└── priceMarkerRenderer.js           # Price markers
```

### PriceTicker Pipeline
```
src/
├── components/
│   └── PriceTicker.svelte           # UI + inline callback (lines 128-141), reactive statements (37-43)
├── composables/
│   └── useWebSocketSub.js           # Subscription management
└── lib/
    ├── displayDataProcessor.js      # processSymbolData()
    └── dayRangeCalculations.js      # calculateDayRangePercentage()
```

---

## Conclusion

The data pipeline follows a consistent pattern across all components:

1. **WebSocket** receives data from backend
2. **Callback** processes and updates reactive state
3. **Reactivity** automatically triggers re-derivations
4. **Renderer** draws to canvas or updates DOM

Understanding this flow enables faster debugging when reactivity issues occur. The most common failure points are:
- Callbacks not being invoked (subscription issues)
- Refs not being updated (assignment issues)
- Reactive statements not re-executing (dependency issues)
