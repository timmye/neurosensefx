# Market Profile Design Specification

## Executive Summary

Market Profile visualization provides real-time volume distribution analysis across price levels. Currently implements 3 volume-based rendering modes with foundation-first architecture delivering 60fps performance. Adding 3 delta-based modes to expand analysis capabilities for buy/sell pressure visualization.

**Core Achievement**: Production-ready visualization with foundation patterns, worker integration, and comprehensive configuration management.

---

## 1. Display Mode Framework

### Volume Distribution Modes (Existing)

1. **`separate`** - Traditional market profile presentation
   - Sell volume extends left from ADR axis
   - Buy volume extends right from ADR axis

2. **`combinedLeft`** - Compact left-side presentation
   - Both buy+sell volumes extend left from ADR axis
   - Sell volume closest to axis, buy volume outer

3. **`combinedRight`** - Compact right-side presentation (default)
   - Both buy+sell volumes extend right from ADR axis
   - Buy volume closest to axis, sell volume outer

### Delta Analysis Modes (New)

1. **`deltaBoth`** - Bidirectional delta visualization
   - Positive delta (buy > sell) extends right from ADR axis
   - Negative delta (sell > buy) extends left from ADR axis

2. **`deltaLeft`** - Left-aggregated delta visualization
   - Both positive and negative delta extend left from ADR axis

3. **`deltaRight`** - Right-aggregated delta visualization
   - Both positive and negative delta extend right from ADR axis

### Delta Visualization Logic

- **Delta Calculation**: `delta = buyVolume - sellVolume` per price level
- **Positive Delta** (buy > sell): Green bars
- **Negative Delta** (sell > buy): Red bars
- **Direction Application**: Positioning applied after delta calculation
- **Technical Reference**: Leverage existing `drawProfileBars()` in `src/lib/viz/marketProfile.js`

---

## 2. Configuration Framework

### Mode Selection

```javascript
// Technical Reference: src/stores/displayStore.js
marketProfileView: [
  'separate', 'combinedLeft', 'combinedRight',  // Volume modes
  'deltaBoth', 'deltaLeft', 'deltaRight'         // Delta modes
]
```

### Essential Configuration Parameters

```javascript
// Technical Reference: src/stores/displayStore.js
{
  // Display Control
  showMarketProfile: true,
  marketProfileView: 'combinedRight',
  
  // Visual Properties
  marketProfileWidthRatio: 15,        // Max bar width as % of canvas
  marketProfileOpacity: 0.7,          // Decimal opacity (0.1-1.0)
  marketProfileXOffset: 0,            // Horizontal offset % from ADR axis
  
  // Width Management
  marketProfileWidthMode: 'responsive', // 'responsive' | 'fixed'
  marketProfileMinWidth: 5,           // Minimum bar width constraint
  
  // Visual Enhancements
  showMaxMarker: true,                // Point of control marker
  marketProfileOutline: false,        // Bar outline toggle
  marketProfileOutlineStrokeWidth: 1,
  
  // Color Scheme
  marketProfileUpColor: '#10B981',    // Green for positive/buy
  marketProfileDownColor: '#EF4444',  // Red for negative/sell
  
  // Data Filtering
  distributionDepthMode: 'percentage',
  distributionPercentage: 50           // Show top X% of volume levels
}
```

### Width Management System

**Responsive Mode (Default)**:
- **combinedRight**: Extends from ADR axis to right canvas edge
- **combinedLeft**: Extends from ADR axis to canvas edge to 
- **separate**: Uses smaller adr axis distance to edge on both sides
- **Delta Modes**: Same responsive behavior based on direction setting

**Fixed Mode**: Uses `marketProfileWidthRatio` as percentage of canvas width for consistent sizing regardless of canvas dimensions.

---

## 3. Data Structure & Processing

### Worker Data Format

```javascript
// Technical Reference: src/workers/dataProcessor.js
state.marketProfile.levels = [
  { price: 1.2345, volume: 100, buy: 60, sell: 40 },
  { price: 1.2350, volume: 150, buy: 90, sell: 60 },
  // ... more levels
]
```

### Processing Requirements

- **Direct Worker Integration**: Use `state.marketProfile.levels` directly, no redundant bucketing
- **Delta Calculation**: Compute `delta = buy - sell` for delta modes
- **Volume Mode**: Use `buy` and `sell` separately for volume modes
- **Performance**: Early exit for empty levels, pre-calculate positions

### Rendering Pipeline Integration

```javascript
// Technical Reference: src/components/FloatingDisplay.svelte
drawDayRangeMeter(ctx, renderingContext, config, state, y);
drawMarketProfile(ctx, renderingContext, config, state, y); // This component
drawVolatilityOrb(ctx, renderingContext, config, state, y);
drawPriceFloat(ctx, renderingContext, config, state, y);
drawPriceDisplay(ctx, renderingContext, config, state, y);
```

---

## 4. Technical Execution Framework

### Foundation Pattern Integration

**Required Foundation Patterns** (reference existing implementations):
- **DPR-Aware Rendering**: `ctx.translate(0.5, 0.5)` and `ctx.imageSmoothingEnabled = false`
- **RenderingContext Integration**: Use `{ contentArea, adrAxisX }` from unified system
- **Bounds Checking**: Apply `boundsUtils.isYInBounds()` for performance optimization
- **Error Handling**: Multi-level validation with graceful fallbacks

**Code References**:
- **DPR/Rendering Context**: `src/lib/viz/dayRangeMeter.js`
- **Bounds Checking**: `src/lib/viz/priceDisplay.js`
- **Configuration Management**: `src/stores/displayStore.js`
- **Current Implementation**: `src/lib/viz/marketProfile.js`

### Rendering Requirements

**Function Signature**:
```javascript
export function drawMarketProfile(ctx, renderingContext, config, state, y) {
  // ctx: Canvas 2D context
  // renderingContext: { contentArea, adrAxisX } - unified coordinate system
  // config: Configuration parameters
  // state: Market data with marketProfile.levels
  // y: D3 scale function for price positioning
}
```

**Mode-Specific Rendering**:
- **Volume Modes**: Render buy/sell bars separately or combined based on mode
- **Delta Modes**: Calculate delta first, then apply directional positioning
- **Enhancements**: Apply bounds checking to markers, outlines (not core bars)

---

## 5. Performance & Quality Requirements

### Performance Criteria
- **Frame Rate**: 60fps with 20+ simultaneous displays
- **Latency**: <100ms from data to visual update
- **Memory**: <500MB increase vs current implementation
- **Efficiency**: Single-pass processing, early exits for empty levels

### Quality Standards
- **Rendering**: Crisp across all DPI settings with DPR awareness
- **Visual**: Zero artifacts, professional trading interface appearance
- **Responsive**: Automatic width adjustment on canvas resize
- **Consistent**: Edge-fitting behavior, no awkward gaps

### Multi-Display Performance
- **Stable Performance**: Maintain 60fps during rapid market updates
- **Memory Efficiency**: Shared patterns across multiple displays
- **Scalability**: Linear performance scaling with display count

---

## 6. Implementation Requirements

### Delta Mode Integration

**Configuration Update**:
```javascript
// Update dropdown options in UI components
marketProfileView: [
  'separate', 'combinedLeft', 'combinedRight',
  'deltaBoth', 'deltaLeft', 'deltaRight'
]
```

**Rendering Logic Extensions**:
- Add delta calculation: `delta = buy - sell` for each price level
- Implement directional positioning based on delta mode
- Apply color coding: green for positive, red for negative delta
- Reuse existing bar rendering methods with delta-based parameters

**Mode Selection Logic**:
```javascript
// Enhanced configureProfileMode() extension
const configureProfileMode = (config, contentArea, adrAxisX, mode) => {
  const availableWidth = calculateResponsiveWidth(config, contentArea, adrAxisX, mode);
  
  // Handle delta modes
  if (mode.startsWith('delta')) {
    return configureDeltaMode(mode, availableWidth, adrAxisX);
  }
  
  // Existing volume mode logic
  // ... existing implementation
};
```

### Technical Dependencies

**Required Code References**:
- `src/lib/viz/marketProfile.js` - Current implementation foundation
- `src/stores/displayStore.js` - Configuration management
- `src/workers/dataProcessor.js` - Data processing pipeline
- `src/components/FloatingDisplay.svelte` - Rendering pipeline integration

**Foundation Pattern Integration**:
- Copy DPR setup from `src/lib/viz/dayRangeMeter.js`
- Copy bounds checking from `src/lib/viz/priceDisplay.js`
- Maintain existing error handling patterns
- Use existing responsive width calculations

---

## Document Maintenance

This specification provides the framework for technical execution. For implementation details, reference the existing code files listed above. The design establishes:

- **Mode Framework**: 6 distinct visualization approaches (3 volume + 3 delta)
- **Configuration Boundaries**: Clear parameter definitions and constraints
- **Integration Requirements**: How the component fits into existing rendering pipeline
- **Performance Standards**: User-facing quality requirements

Implementation should follow established foundation patterns and leverage existing code architecture for consistency and maintainability.
