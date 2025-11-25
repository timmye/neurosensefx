# Canvas Sizing and Visualization Awareness Implementation

## Mission Context

You are implementing critical fixes for canvas sizing and visualization awareness in NeuroSense FX, a financial trading visualization platform. FX traders rely on precise visual representations of market data for rapid decision-making during active trading sessions.

**Current Critical Issues:**
- Visualizations only cover partial y-axis (incomplete vertical rendering)
- Some visualizations not showing at all
- Some visualizations are visible but broken/misaligned
- Canvas and visualization bounds are not properly synchronized

## PHILOSOPHY COMPLIANCE MANDATES

**SIMPLE - Clear mental models and predictable behavior:**
- Canvas sizing must be deterministic and predictable
- Visualization bounds should align intuitively with container dimensions
- No magic numbers or hardcoded offsets - use proportional calculations

**PERFORMANT - 60fps rendering, sub-100ms latency, DPR-aware crisp rendering:**
- Canvas resizing MUST NOT drop frames during market data updates
- Bounds calculations MUST complete in under 5ms to maintain sub-100ms latency
- All rendering MUST be DPR-aware for crisp numerical displays
- Support 20+ concurrent displays without performance degradation

**MAINTAINABLE - Single responsibility, loose coupling, extensible design:**
- Canvas sizing logic MUST be centralized and reusable
- Visualization components MUST independently handle their bounds
- No cross-component dependencies for sizing calculations

**Framework-First Development:**
- CHECK existing utilities in `src/lib/viz/DPR_RENDERING_SYSTEM.md` BEFORE creating new solutions
- USE Svelte's reactive patterns for dimension updates
- LEVERAGE existing configuration system from `src/config/CONFIGURATION_ARCHITECTURE.md`

## Task Requirements

### Phase 1: Analysis and Assessment (20 points)

**Original Requirement:** "We have implemented better handling of container and canvas rendering awareness and states. Now we need to resolve the visualization awareness of canvas sizing."

**Success Definition:** All visualization components properly detect and render within canvas bounds, with full y-axis coverage and no broken visualizations.

**Completion Criteria:**
✅ Document current canvas sizing behavior across all visualization types
✅ Identify specific root causes of partial y-axis coverage
✅ Map visualization-to-canvas coordinate transformation flow
✅ Analyze existing DPR rendering system integration

**Evidence Format:**
- Before: Screenshots/log output showing partial y-axis coverage and broken visualizations
- After: Analysis report documenting root causes with specific component references
- Proof: Detailed technical findings with code locations and failure patterns

### Phase 2: Canvas Sizing Infrastructure (30 points)

**Original Requirement:** "We need to implement canvas/visualization size methods to ensure all visualizations render to canvas size successfully"

**Success Definition:** Robust canvas sizing system that automatically synchronizes canvas dimensions with container bounds and provides real-time size awareness to visualizations.

**Completion Criteria:**
✅ Implement centralized canvas sizing utilities in `src/lib/viz/canvasSizing.js`
✅ Create real-time canvas bounds monitoring system
✅ Add container-to-canvas dimension synchronization
✅ Integrate with existing DPR rendering system
✅ Add canvas resize event handling with debouncing

**Evidence Format:**
- Before: No centralized canvas sizing, visualizations unaware of actual canvas dimensions
- After: Working canvas sizing system with real-time bounds monitoring
- Proof: Console logs showing canvas dimensions updating correctly, visualizations responding to size changes

**Implementation Requirements:**

**CRITICAL: Read CLAUDE.md BEFORE writing any code - THIS IS NOT OPTIONAL**

```javascript
// REQUIRED: Create src/lib/viz/canvasSizing.js with these core methods:

export class CanvasSizing {
  // MUST: Initialize canvas with proper DPR scaling
  static initializeCanvas(canvas, container) {
    // Implementation following DPR_RENDERING_SYSTEM.md patterns
  }

  // MUST: Get actual canvas bounds in CSS pixels
  static getCanvasBounds(canvas) {
    // Returns { width, height, dpr, scaledWidth, scaledHeight }
  }

  // MUST: Synchronize canvas size with container
  static synchronizeCanvas(canvas, container) {
    // Handles resize events with proper debouncing
  }

  // MUST: Monitor canvas bounds changes
  static createBoundsMonitor(canvas, callback) {
    // Calls callback when canvas bounds change
  }
}
```

### Phase 3: Visualization Integration (30 points)

**Original Requirement:** "including logs from visualizations and canvas to monitor and check rendering content and canvas bounds"

**Success Definition:** All visualization components (Market Profile, Volatility Orb, Day Range Meter) properly integrate with canvas sizing system and render within bounds.

**Completion Criteria:**
✅ Update Market Profile to use canvas sizing system
✅ Update Volatility Orb to use canvas sizing system
✅ Update Day Range Meter to use canvas sizing system
✅ Add comprehensive logging for rendering bounds
✅ Fix partial y-axis coverage issues
✅ Ensure all visualizations visible and properly aligned

**Evidence Format:**
- Before: Visualizations partially rendered, console logs showing bounds mismatches
- After: All visualizations render fully within canvas bounds, logs confirm proper sizing
- Proof: Screenshots showing complete y-axis coverage, console logs showing synchronized bounds

**Integration Requirements:**

**CHECK EXISTING VISUALIZATION CODE FIRST:**
- Market Profile implementation location
- Volatility Orb implementation location
- Day Range Meter implementation location

**REQUIRED Integration Pattern:**

```javascript
// EACH visualization component MUST implement this pattern:

export class VisualizationComponent {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.sizing = CanvasSizing.createBoundsMonitor(canvas, this.onBoundsChange.bind(this));
    this.logger = new VisualizationLogger(this.constructor.name);
  }

  // MUST: Handle canvas bounds changes
  onBoundsChange(bounds) {
    this.logger.info('Canvas bounds changed', bounds);
    this.updateRendering(bounds);
  }

  // MUST: Render within provided bounds
  render(bounds) {
    // Use bounds.width and bounds.height for rendering
    // Log rendering coordinates for debugging
  }
}
```

### Phase 4: Logging and Monitoring System (20 points)

**Original Requirement:** "We have also implemented comprehensive testing infrastructure methods including logging browser console messages to track system state"

**Success Definition:** Comprehensive logging system that tracks canvas bounds, rendering coordinates, and visualization state for debugging and monitoring.

**Completion Criteria:**
✅ Create VisualizationLogger utility for component-specific logging
✅ Add canvas bounds change logging
✅ Add rendering coordinate logging
✅ Integrate with existing testing infrastructure
✅ Create performance monitoring for canvas operations

**Evidence Format:**
- Before: No visibility into canvas sizing or visualization bounds
- After: Detailed console logs showing all canvas and visualization operations
- Proof: Console output demonstrating bounds tracking, rendering coordinates, and performance metrics

**Logging Requirements:**

```javascript
// REQUIRED: Create src/lib/viz/VisualizationLogger.js

export class VisualizationLogger {
  constructor(componentName) {
    this.component = componentName;
  }

  // MUST: Log canvas bounds changes
  logBoundsChange(oldBounds, newBounds) {
    console.log(`[${this.component}] Bounds:`, {
      from: oldBounds,
      to: newBounds,
      delta: {
        width: newBounds.width - oldBounds.width,
        height: newBounds.height - oldBounds.height
      }
    });
  }

  // MUST: Log rendering operations
  logRender(operation, coordinates) {
    console.log(`[${this.component}] Render:`, { operation, coordinates });
  }
}
```

## Anti-Patterns - NEVER DO THESE

❌ **NEVER** hardcode canvas dimensions or use magic numbers
❌ **NEVER** bypass the DPR rendering system - use existing patterns from `src/lib/viz/DPR_RENDERING_SYSTEM.md`
❌ **NEVER** create duplicate sizing logic - centralize in `CanvasSizing` class
❌ **NEVER** ignore container bounds - always synchronize with parent dimensions
❌ **NEVER** skip logging - comprehensive logging is REQUIRED for debugging
❌ **NEVER** use setTimeout for resize handling - use proper ResizeObserver or requestAnimationFrame
❌ **NEVER** assume canvas dimensions - always validate with actual measurements

## Required Reading - MANDATORY PRE-WORK

**YOU MUST READ THESE FILES BEFORE IMPLEMENTATION:**

1. **`src/lib/viz/DPR_RENDERING_SYSTEM.md`** - DPR rendering patterns and utilities
2. **`src/lib/viz/DPR_EXAMPLES.md`** - Implementation examples and best practices
3. **`src/config/CONFIGURATION_ARCHITECTURE.md`** - Configuration system patterns
4. **`docs/WEB_WORKER_COMMUNICATION_PROTOCOL.md`** - Performance optimization patterns

## Performance Requirements - NON-NEGOTIABLE

**CRITICAL Performance Standards:**
- Canvas resizing operations: < 5ms execution time
- Bounds calculation: < 1ms per visualization component
- Memory allocation: Minimal object creation during resize operations
- Frame rate: MUST maintain 60fps during resize operations
- Concurrent displays: System MUST scale to 20+ displays without degradation

## Validation and Testing

**Completion Verification Questions:**

Before completing each phase, answer:
1. **What specific canvas sizing issue was fixed?** [Quote the original issue]
2. **What is the evidence that visualizations now render within bounds?** [Provide logs/screenshots]
3. **How does the solution maintain 60fps performance?** [Show performance metrics]
4. **Does this follow the DPR rendering system patterns?** [Reference specific patterns used]
5. **Are all visualizations showing with complete y-axis coverage?** [Confirm with evidence]

**Final Acceptance Criteria:**
- All visualizations render completely within canvas bounds
- No partial y-axis coverage issues remain
- Console logs confirm proper bounds synchronization
- Performance maintained at 60fps during resize operations
- Code follows centralized utility patterns
- Solution is maintainable and extensible

## Success Evidence Requirements

**You MUST provide:**
1. **Before/After screenshots** showing complete y-axis coverage
2. **Console logs** demonstrating canvas bounds tracking
3. **Performance metrics** confirming 60fps maintenance
4. **Code references** showing integration with existing DPR system
5. **Test results** from the existing testing infrastructure

**Invalid Evidence (Will NOT count as completion):**
- Generic "it works" statements without specific proof
- Tests that don't specifically validate canvas bounds
- Performance claims without measured metrics
- Code that bypasses existing centralized utilities

## Expected Deliverables

1. **`src/lib/viz/canvasSizing.js`** - Centralized canvas sizing utilities
2. **`src/lib/viz/VisualizationLogger.js`** - Logging and monitoring system
3. **Updated visualization components** - Integration with sizing system
4. **Test results** - Validation of complete y-axis coverage
5. **Performance report** - Confirmation of 60fps maintenance

This implementation is critical for trader workflow effectiveness. Visualizations must render completely and accurately within canvas bounds to support rapid trading decisions.