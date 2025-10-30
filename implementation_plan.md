# Implementation Plan

## Overview
Resolve the remaining display rendering issues in NeuroSense FX by fixing the visualization pipeline to ensure canvas elements actually draw visual content, leveraging the existing solid architecture.

## Scope and Context
The NeuroSense FX system has excellent architecture with working data flow, but displays are not showing visual content despite proper canvas sizing and render triggers. The issue is in the visualization rendering pipeline where drawing functions may not be executing properly or canvas context may have configuration issues. This implementation focuses on the critical gaps between data availability and visual output.

## Types
### Canvas Rendering Pipeline Type
```javascript
interface RenderPipeline {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  state: DisplayState;
  config: DisplayConfig;
  yScale: d3.ScaleLinear<number, number>;
  renderFrame: number;
  isRendering: boolean;
}

interface DisplayState {
  ready: boolean;
  currentPrice: number;
  visualLow: number;
  visualHigh: number;
  lastTick: TickData;
  bid: number;
  ask: number;
  volatility: number;
}

interface DisplayConfig {
  visualizationsContentWidth: number;
  meterHeight: number;
  showMarketProfile: boolean;
  showPriceFloat: boolean;
  showVolatilityOrb: boolean;
  // ... other display parameters
}
```

### Visualization Function Type
```javascript
interface VisualizationFunction {
  (ctx: CanvasRenderingContext2D, config: DisplayConfig, state: DisplayState, yScale: d3.ScaleLinear<number, number>): void;
}
```

## Files
### Files to Modify
1. **src/components/FloatingDisplay.svelte** - Fix render function execution and canvas context setup
2. **src/components/viz/Container.svelte** - Ensure drawing functions are called with proper parameters
3. **src/lib/viz/marketProfile.js** - Verify drawing function implementation
4. **src/lib/viz/priceFloat.js** - Verify drawing function implementation
5. **src/lib/viz/volatilityOrb.js** - Verify drawing function implementation

### Files to Test
1. **test_visual_display.html** - Create comprehensive test page for visual validation
2. **src/utils/canvasDebug.js** - Create debugging utilities for canvas rendering

## Functions
### Functions to Modify
1. **render()** in FloatingDisplay.svelte - Fix execution and add comprehensive debugging
2. **draw()** in Container.svelte - Ensure proper parameter passing to visualization functions
3. **onMount()** in FloatingDisplay.svelte - Verify canvas context initialization
4. **scaleLinear()** reactive statement - Fix timing dependencies

### Functions to Add
1. **debugCanvasState()** - Utility to verify canvas context and dimensions
2. **testDrawingFunctions()** - Utility to verify individual visualization functions work
3. **validateRenderPipeline()** - Utility to verify complete render pipeline

## Classes
### No New Classes Required
The implementation will use existing architecture patterns and leverage existing component structures. No new classes are needed as the current component hierarchy is well-designed.

## Dependencies
### Existing Dependencies to Leverage
1. **d3-scale** - Already imported for yScale calculation
2. **floatingStore.js** - Already provides state management and GEOMETRY foundation
3. **canvasSizing.js** - Already provides unified canvas sizing utilities
4. **ConnectionManager.js** - Already provides data subscription management

### No New Dependencies Required
The implementation uses only existing dependencies to maintain architectural consistency and avoid scope creep.

## Testing
### Visual Testing Approach
1. **Static Content Test** - Draw simple shapes to verify canvas rendering works
2. **Data-Driven Test** - Verify visualization functions render with actual market data
3. **Interactive Test** - Test hover, click, and resize functionality
4. **Performance Test** - Verify 60fps rendering with multiple displays

### Test Files Required
1. **test_visual_validation.html** - Simple test page for canvas rendering validation
2. **debug_render_pipeline.js** - Script to test render pipeline components

## Implementation Order

### Step 1: Diagnose Render Pipeline (30 minutes)
1. Add comprehensive debug logging to FloatingDisplay.svelte render function
2. Create canvas state validation utility
3. Test individual visualization functions with static data
4. Verify canvas context configuration and dimensions

### Step 2: Fix Canvas Context Setup (30 minutes)
1. Ensure proper canvas context initialization in onMount
2. Verify canvas clearing and background rendering
3. Fix any coordinate system or scaling issues
4. Test with simple shapes to verify basic rendering

### Step 3: Fix Visualization Function Calls (30 minutes)
1. Verify drawing functions are being called from render loop
2. Check parameter passing to visualization functions
3. Fix any issues with scaledConfig or yScale
4. Test each visualization function individually

### Step 4: Implement Static Content Test (30 minutes)
1. Create simple test shapes to verify canvas works
2. Add fallback rendering for missing data
3. Implement progressive loading states
4. Test with basic rectangles and text

### Step 5: Validate Complete Pipeline (30 minutes)
1. Test end-to-end rendering with actual market data
2. Verify interactive features (hover, click)
3. Test resize functionality
4. Validate performance with multiple displays

### Step 6: Clean Up and Document (30 minutes)
1. Remove debug logging once rendering works
2. Update documentation with successful resolution
3. Archive test files
4. Update memory bank with final status
