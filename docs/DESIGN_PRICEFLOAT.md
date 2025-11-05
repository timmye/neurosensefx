# PriceFloat Optimization Design Specification

## Executive Summary

Optimize existing `priceFloat.js` visualization by rebuilding it on the solid foundation established by `dayRangeMeter.js`. This approach ensures perfect visual alignment, DPR-aware crisp rendering, and 60fps performance with 20+ simultaneous displays.

**Core Principle**: Visual accuracy and performance first - priceFloat appears as part of dayRangeMeter to users, requiring perfect coordinate alignment.

---

## 1. Foundation Strategy: Leverage Proven Patterns

### dayRangeMeter.js Foundation Analysis

**Proven Foundation Patterns to Leverage**:
- **DPR-Aware Rendering**: `ctx.translate(0.5, 0.5)` and `ctx.imageSmoothingEnabled = false`
- **RenderingContext Integration**: Uses `{ contentArea, adrAxisX }` from unified system
- **Content-Relative Positioning**: All calculations based on contentArea dimensions
- **Bounds Checking**: `boundsUtils.isYInBounds()` for safety and performance
- **Modular Architecture**: Clean separation with focused functions
- **Performance Optimization**: Minimal operations, efficient rendering pipeline

**Foundation Function Extraction Template**:
```javascript
// Standard rendering context usage
const { contentArea, adrAxisX } = renderingContext;

// Standard bounds checking
const inBounds = boundsUtils.isYInBounds(priceY, config, { canvasArea: contentArea });

// Standard DPR configuration
ctx.save();
ctx.translate(0.5, 0.5);
ctx.imageSmoothingEnabled = false;
```

### New Foundation Pattern: Percentage-to-Decimal Conversion

**Critical Discovery**: Configuration stores percentages as whole numbers (0.1 = 0.1%), but rendering requires decimal conversion (0.001 = 0.1%).

**Standard Conversion Pattern**:
```javascript
// Convert percentage config values to decimals for rendering
const widthPercentage = (config.parameterName || defaultValue) / 100;
const heightPercentage = (config.parameterName || defaultValue) / 100;

// Apply to content-relative dimensions
const calculatedValue = contentArea.dimension * percentageDecimal;
```

**Debug-Driven Development Pattern**:
```javascript
// Built-in debug logging for rapid troubleshooting
console.log('[DEBUG_PREFIX] Config values:', { configValue, calculation, result });
```

---

## 2. Implementation Architecture

### Foundation-First File Structure

```
src/lib/viz/priceFloat.js (rebuilt on dayRangeMeter foundation)
├── drawPriceFloat()           // Main orchestration function
├── validateRenderData()        // Safety checks, bounds, percentage conversion
├── configureRenderContext()     // DPR and context setup
└── drawPriceLine()            // Core line rendering
```

### Standard Function Signature Pattern

```javascript
export function drawPriceFloat(ctx, renderingContext, config, state, y) {
  // Consistent with dayRangeMeter pattern
  // ctx: Canvas 2D context
  // renderingContext: { contentArea, adrAxisX }
  // config: Existing configuration parameters
  // state: Market data with currentPrice
  // y: D3 scale function for price positioning
}
```

### Core 1px Line Implementation

```javascript
function drawPriceLine(ctx, renderData, config, state) {
  const { axisX, priceY, floatWidth, floatHeight, startX } = renderData;
  
  // DPR-aware crisp line rendering (foundation pattern)
  ctx.strokeStyle = color;
  ctx.lineWidth = floatHeight; // Configurable height
  ctx.lineCap = 'round'; // Smooth end caps
  
  ctx.beginPath();
  ctx.moveTo(startX, priceY);
  ctx.lineTo(startX + floatWidth, priceY);
  ctx.stroke();
}
```

---

## 3. Configuration Architecture

### Percentage-to-Decimal Conversion Pattern

**Critical Implementation Requirement**:
```javascript
function validateRenderData(contentArea, adrAxisX, config, state, y) {
  // Convert percentage config to decimal (NEW FOUNDATION PATTERN)
  const widthPercentage = (config.priceFloatWidth || 15) / 100;
  const heightPercentage = (config.priceFloatHeight || 2) / 100;
  
  // Apply to content-relative dimensions
  const floatWidth = contentArea.width * widthPercentage;
  const floatHeight = Math.max(1, contentArea.height * heightPercentage);
  
  // Calculate positioning centered on ADR axis
  const startX = adrAxisX - (floatWidth / 2);
  
  return { shouldRender: inBounds, axisX: adrAxisX, priceY, floatWidth, floatHeight, startX };
}
```

### Realistic Configuration Ranges

**Updated Ranges Based on Foundation Testing**:
- `priceFloatWidth`: 0.1-100% (0.1% to 100% of canvas width)
- `priceFloatHeight`: 0.1-10% (0.1% to 10% of canvas height)
- `priceFloatXOffset`: -25% to 25% (percentage of canvas width)

**Optimized Default Values**:
- `priceFloatWidth`: 15% (professional appearance on 220px canvas = 33px)
- `priceFloatHeight`: 2% (professional appearance on 120px canvas = 2.4px)

---

## 4. Performance Optimization Patterns

### Foundation Performance Strategies

**Minimal Rendering Operations**:
- Single draw call per frame when possible
- Early exit for out-of-bounds elements
- Efficient path operations with no unnecessary state changes

**Memory Management Foundation**:
- No object creation in render loop
- Reuse configuration objects
- Proper cleanup on component destruction

**Performance Monitoring Pattern**:
```javascript
// Built-in performance tracking (development mode)
const renderStart = performance.now();
drawPriceFloat(ctx, renderingContext, config, state, y);
const renderTime = performance.now() - renderStart;

if (renderTime > 16.67) { // > 60fps threshold
  console.warn(`[PriceFloat] Slow render: ${renderTime.toFixed(2)}ms`);
}
```

---

## 5. Visual Quality Standards

### Foundation Rendering Requirements

**DPR-Aware Crisp Rendering**:
- **Sub-pixel Alignment**: `ctx.translate(0.5, 0.5)` for perfect 1px lines
- **Anti-aliasing Control**: `ctx.imageSmoothingEnabled = false` for sharpness
- **Color Consistency**: Unified color scheme with dayRangeMeter

**Visual Integration Foundation**:
- **Coordinate Alignment**: Perfect positioning relative to dayRangeMeter axis
- **Content-Relative Scaling**: All dimensions based on contentArea percentages
- **Professional Appearance**: Trading-grade visual quality and precision

---

## 6. Integration Architecture

### Rendering Pipeline Integration

**Standard Integration Pattern**:
```javascript
// FloatingDisplay.svelte rendering pipeline
drawDayRangeMeter(ctx, renderingContext, config, state, y);
drawPriceFloat(ctx, renderingContext, config, state, y); // After dayRangeMeter
// Other visualizations...
```

### Data Flow Foundation

**Unified Data Architecture**:
```javascript
// WebSocket → Data Processor → Rendering Context
state.currentPrice // From backend tick data
state.lastTickDirection // For directional coloring
renderingContext // Unified coordinate system and dimensions
```

---

## 7. Implementation Roadmap (Foundation-Based)

### Step 1: Foundation Extraction
1. **Extract dayRangeMeter patterns** for DPR, renderingContext, and content-relative positioning
2. **Create modular architecture** with validateRenderData(), configureRenderContext(), drawPriceLine()
3. **Implement percentage-to-decimal conversion** as new foundation pattern

### Step 2: Core Implementation
1. **Implement 1px line rendering** with DPR-aware crisp rendering
2. **Add content-relative positioning** using dayRangeMeter coordinate system
3. **Integrate bounds checking** for performance optimization

### Step 3: Visual Enhancement
1. **Add configurable dimensions** with percentage-to-decimal conversion
2. **Implement glow effects** with proper shadow rendering
3. **Add directional coloring** with fallback logic

### Step 4: Integration & Validation
1. **Integrate with rendering pipeline** using standard signature pattern
2. **Validate visual alignment** with dayRangeMeter axis
3. **Test 60fps performance** with 20+ displays
4. **Debug-driven refinement** using built-in logging patterns

---

## 8. Success Criteria (Foundation-Based)

### Functional Requirements
- ✅ Perfect visual alignment with dayRangeMeter foundation
- ✅ 60fps performance with 20+ displays
- ✅ Crisp 1px line rendering across all DPI settings
- ✅ Content-relative positioning with percentage-to-decimal conversion

### Quality Requirements
- ✅ Professional trading interface appearance
- ✅ Consistent visual quality across browsers
- ✅ Zero visual artifacts or rendering issues
- ✅ Responsive behavior during rapid price updates

### Performance Requirements
- ✅ <100ms data-to-visual latency
- ✅ <500MB total system memory usage
- ✅ Stable performance during extended operation
- ✅ Smooth rendering during market volatility

---

## 9. New Foundation Patterns for Future Visualizations

### 1. Foundation Reuse Pattern
**Standard Approach**: Always extract and leverage proven patterns from existing working visualizations before creating new implementations.

**Pattern Template**:
```javascript
// Foundation reuse checklist
- [ ] DPR-aware rendering patterns
- [ ] RenderingContext integration
- [ ] Content-relative positioning
- [ ] Bounds checking integration
- [ ] Modular function separation
```

### 2. Percentage-to-Decimal Conversion Pattern
**Critical Requirement**: All content-relative percentage parameters must convert to decimals before rendering.

**Standard Implementation**:
```javascript
// Universal conversion pattern for any percentage parameter
const percentageDecimal = (config.percentageParam || defaultValue) / 100;
const calculatedPixels = contentArea.dimension * percentageDecimal;
```

### 3. Debug-Driven Development Pattern
**Built-in Debugging**: Include debug logging in all visualization functions for rapid troubleshooting.

**Debug Pattern Template**:
```javascript
// Standard debug logging for visualization functions
console.log('[VISUALIZATION_DEBUG] Process:', { 
  configValue: config.parameter,
  calculation: intermediateStep,
  result: finalValue 
});
```

### 4. Modular Architecture Pattern
**Standard Function Separation**:
- `validateRenderData()` - Safety checks and data preparation
- `configureRenderContext()` - Canvas setup and DPR handling
- `draw[Element]()` - Core rendering logic

### 5. Performance-First Pattern
**Performance Optimization Checklist**:
- Early exit conditions for out-of-bounds elements
- Minimal render operations with efficient path usage
- No object creation in render loops
- Built-in performance monitoring

---

## Conclusion

This optimization establishes priceFloat as a model for foundation-first visualization development. By leveraging proven dayRangeMeter patterns and establishing new foundation patterns (percentage-to-decimal conversion, debug-driven development, modular architecture), we create a robust template for all future visualization work.

The implementation demonstrates that foundation reuse is not just efficient but essential for maintaining system consistency, visual quality, and performance standards across the NeuroSense FX visualization ecosystem.

**Key Foundation Achievement**: priceFloat now perfectly complements dayRangeMeter while providing the visual quality and performance required for professional trading applications, establishing patterns that can be applied to all future visualization development.

---

## Document Maintenance

This specification serves as a foundation template for future visualization development and should be referenced when:
- Building new visualizations (use foundation patterns)
- Implementing percentage-based parameters (use conversion pattern)
- Debugging visualization issues (use debug logging pattern)
- Optimizing performance (use performance-first pattern)
- Maintaining system consistency (use integration patterns)

All new visualizations should follow these foundation patterns to ensure system-wide consistency and quality.
