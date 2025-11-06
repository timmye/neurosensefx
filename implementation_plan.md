# Implementation Plan

## Overview
Re-design volatility orb visualization using foundation patterns from marketProfile.js and priceDisplay.js to deliver high-performance, cognitive-aware volatility indication aligned with NeuroSense FX design principles.

The implementation will transform the legacy volatilityOrb.js (150+ lines with foundation gaps) into a production-ready component that integrates seamlessly with existing infrastructure while maintaining its role as a background perceptual element supporting trader decision-making through intuitive volatility visualization.

---

## Types  
Foundation-first integration patterns with cognitive-aware design principles.

**Core Data Structures**:
- **RenderContext**: `{ contentArea: {width, height}, adrAxisX: number }` - unified coordinate system
- **OrbData**: `{ volatility: number, priceY: number, direction: 'up'|'down', isValid: boolean }` - processed worker data
- **RenderData**: `{ shouldRender: boolean, orbBaseWidth: number, orbX: number, sizeMultiplier: number }` - calculated render parameters
- **ValidationConfig**: `{ showVolatilityOrb: boolean, volatilityColorMode: string, volatilityOrbBaseWidth: number, volatilitySizeMultiplier: number }` - validated configuration

**Configuration Modes**:
- **volatilityColorMode**: `'directional'` | `'static'` | `'intensity'` - visualization approach selection
- **Enhancement Flags**: `showVolatilityMetric`, `showOrbFlash` - optional feature control
- **Performance Parameters**: `orbFlashThreshold`, `orbFlashIntensity` - alert system integration

**Function Signatures**:
- **drawVolatilityOrb(ctx: CanvasRenderingContext2D, renderingContext: object, config: object, state: object, y: function): void** - main orchestration
- **validateRenderData(contentArea: object, adrAxisX: number, config: object): RenderData** - safety and conversion
- **processVolatilityData(volatility: number, currentPrice: number, lastTickDirection: string, y: function): OrbData** - worker data processing
- **drawVolatilityOrbCore(ctx: CanvasRenderingContext2D, renderData: RenderData, orbData: OrbData, config: object): void** - core rendering
- **addEnhancements(ctx: CanvasRenderingContext2D, renderData: RenderData, config: object, state: object, contentArea: object): void** - bounds-checked features

---

## Files  
Foundation-based re-architecture of volatility orb with cognitive-aware design.

**New Files to be Created**:
- **docs/DESIGN_VOLATILITYORB.md** - Complete design specification with foundation patterns and cognitive requirements (✅ COMPLETED)

**Existing Files to be Modified**:
- **src/lib/viz/volatilityOrb.js** - Complete foundation-first re-implementation with:
  - Foundation integration (renderingContext, DPR, bounds checking)
  - Cognitive-aware background positioning
  - Multi-mode volatility visualization
  - Performance optimization (pre-calculation, early exits)
  - Comprehensive error handling with guard clauses
  - Alert system integration

**Configuration Integration**:
- **src/stores/displayStore.js** - Ensure volatility parameters are properly integrated (already complete)

**Files to Reference for Patterns**:
- **src/lib/viz/marketProfile.js** - Foundation patterns for validation, error handling, percentage conversion
- **src/lib/viz/priceDisplay.js** - Foundation patterns for cognitive design and performance optimization
- **src/utils/canvasSizing.js** - boundsUtils for performance optimization

---

## Functions  
Modular foundation-first architecture with cognitive-aware rendering.

**New Functions to be Created**:
- **drawVolatilityOrb(ctx, renderingContext, config, state, y)** - Main orchestration with foundation-first pattern
  - Guard clauses for safety (FOUNDATION PATTERN)
  - Early exit for performance when disabled
  - Extract renderingContext from unified infrastructure
  - Orchestrate validation, configuration, rendering, and enhancement phases

- **validateRenderData(contentArea, adrAxisX, config)** - Safety checks and percentage conversion
  - Percentage-to-decimal conversion for all parameters
  - Type-safe validation with NaN checks
  - Content-relative calculations for responsive behavior
  - Error reporting with graceful fallbacks

- **configureRenderContext(ctx)** - DPR-aware setup for crisp rendering
  - `ctx.save()` for state management
  - `ctx.translate(0.5, 0.5)` for sub-pixel alignment
  - `ctx.imageSmoothingEnabled = false` for crisp 1px lines

- **processVolatilityData(volatility, currentPrice, lastTickDirection, y)** - Worker data processing
  - Data validation with safe defaults
  - Pre-calculate Y position for performance
  - Direction validation and normalization
  - Early invalid data detection

- **drawVolatilityOrbCore(ctx, renderData, orbData, config)** - Background-aware orb rendering
  - Cognitive-aware positioning relative to ADR axis
  - Multi-mode color calculation (directional/static/intensity)
  - Gradient creation with proper opacity
  - Glow effects with environmental adaptation

- **calculateOrbDimensions(contentArea, adrAxisX, volatility, config)** - Content-relative sizing
  - Base width calculation from content area
  - Orb radius scaling with volatility multiplier
  - Position calculation aligned with ADR axis
  - Performance-optimized single calculation

- **addEnhancements(ctx, renderData, config, state, contentArea)** - Bounds-checked enhancements
  - Optional volatility metric display with bounds checking
  - Flash effects for significant market events
  - Selective rendering only when in bounds
  - Alert system integration

- **applyVolatilityFlash(ctx, renderData, config)** - Alert system integration
  - Flash overlay without disrupting base rendering
  - Configurable intensity and threshold
  - Performance-aware temporary effects

- **validateVolatilityConfig(config)** - Configuration validation
  - Boolean conversion for feature flags
  - Range validation for numeric parameters
  - Mode validation against allowed values
  - Safe fallbacks for invalid parameters

**Modified Functions**:
- **Existing drawVolatilityOrb function** - Complete re-implementation using foundation patterns
  - Replace legacy mixed-responsibility function with modular architecture
  - Add comprehensive error handling and validation
  - Integrate with renderingContext coordinate system
  - Implement performance optimizations

---

## Classes  
No new classes required - function-based modular architecture following foundation patterns.

**Foundation Pattern Classes (Reuse)**:
- **boundsUtils** - Use existing bounds checking from canvasSizing.js
- **coordinateUtils** - Use existing coordinate transformation utilities
- **configUtils** - Use existing configuration normalization utilities

---

## Dependencies  
Leverage existing infrastructure with minimal new dependencies.

**New Dependencies Required**:
- None - all required utilities and patterns already exist in codebase

**Existing Dependencies to Integrate**:
- **src/utils/canvasSizing.js** - boundsUtils.isYInBounds() for performance optimization
- **src/utils/canvasSizing.js** - coordinateUtils for coordinate transformation
- **src/utils/canvasSizing.js** - configUtils.normalizeConfig() for percentage conversion
- **Foundation patterns from marketProfile.js** - error handling, validation, DPR setup
- **Foundation patterns from priceDisplay.js** - cognitive design, performance optimization

**Configuration Dependencies**:
- **displayStore.js** - volatility parameters already integrated and available
- **Worker data** - state.volatility, state.currentPrice, state.lastTickDirection available

---

## Testing  
Comprehensive validation of foundation integration and cognitive-aware behavior.

**Test File Requirements**:
- **src/lib/viz/__tests__/volatilityOrb.test.js** - Unit tests for foundation patterns
  - Parameter validation and error handling
  - Percentage-to-decimal conversion accuracy
  - Bounds checking functionality
  - Performance optimization verification

**Existing Test Modifications**:
- **FloatingDisplay.svelte integration tests** - Verify volatility orb renders correctly in pipeline
- **Performance tests** - Validate 60fps with 20+ displays
- **Visual regression tests** - Ensure cognitive-aware background positioning

**Validation Strategies**:
- **Foundation Integration Tests**: Verify renderingContext usage, DPR awareness, bounds checking
- **Cognitive Design Tests**: Confirm background element positioning, reduced attention competition
- **Performance Tests**: Measure render times, memory usage, frame rate stability
- **Configuration Tests**: Validate percentage conversion, mode switching, feature flags
- **Integration Tests**: Verify worker data processing, alert system integration

---

## Implementation Order  
Sequential implementation to minimize conflicts and ensure successful integration.

**Step 1: Foundation Infrastructure Integration**
- Update src/lib/viz/volatilityOrb.js with renderingContext parameter support
- Implement configureRenderContext() with DPR-aware setup
- Add boundsUtils integration for performance optimization
- Implement comprehensive guard clauses and error handling

**Step 2: Data Processing and Validation**
- Implement processVolatilityData() with worker data validation
- Add validateRenderData() with percentage-to-decimal conversion
- Create validateVolatilityConfig() for type-safe parameter handling
- Implement early exit patterns for performance

**Step 3: Core Rendering Implementation**
- Implement drawVolatilityOrbCore() with cognitive-aware background positioning
- Add calculateOrbDimensions() for content-relative sizing
- Implement multi-mode color calculation (directional/static/intensity)
- Create gradient and glow effects with environmental adaptation

**Step 4: Enhancement System Integration**
- Implement addEnhancements() with bounds checking for optional features
- Add applyVolatilityFlash() for alert system integration
- Implement selective rendering pattern (core always, enhancements bounds-checked)
- Add volatility metric display with positioning logic

**Step 5: Performance Optimization and Testing**
- Implement pre-calculation patterns for all positions and dimensions
- Add memory efficiency optimizations (no object creation in render loops)
- Implement performance monitoring and logging
- Validate 60fps performance with 20+ displays

**Step 6: Integration Validation**
- Test integration with FloatingDisplay.svelte rendering pipeline
- Verify compatibility with existing worker data structure
- Validate displayStore configuration integration
- Test alert system integration with global flash mechanisms

**Step 7: Documentation and Final Validation**
- Update inline documentation with foundation pattern references
- Add comprehensive error logging and debugging support
- Perform end-to-end testing with all visualization modes
- Validate cognitive-aware design requirements from design document
