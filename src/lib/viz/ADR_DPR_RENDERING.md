# ADR: DPR-Aware Canvas Rendering System

## Status
Accepted - 2025-11-23

## Context
Canvas rendering across different device pixel ratios (DPR) caused fuzzy text and inconsistent line rendering. High-DPI displays showed blurry visuals, while low-DPI displays had acceptable quality. Performance suffered when rendering 20+ displays simultaneously.

## Decision
Implement DPR-aware canvas rendering with device pixel ratio scaling, sub-pixel alignment, and consistent coordinate transformation utilities. Use RequestAnimationFrame for 60fps rendering with bounds checking optimization.

## Consequences

**Benefits:**
- Crisp 1px line rendering across all display densities
- Consistent text rendering with monospace fonts
- 60fps performance with 20+ concurrent displays
- Unified coordinate system for all components
- Automatic zoom detection and adaptation

**Tradeoffs:**
- Slight complexity increase in canvas setup
- Memory usage scales with DPR (2x on 2x displays)
- Requires coordinate transformation for mouse events

## Implementation

### 1. Canvas Sizing (`canvasSizing.js`)
```javascript
// Reference canvas: 220×120px (NeuroSense standard)
export const REFERENCE_CANVAS = { width: 220, height: 120 };

// DPR-aware dimension calculation
const canvasWidth = Math.round(containerWidth * dpr);
const cssWidth = canvasWidth / dpr;
```

### 2. Context Configuration
```javascript
// Scale context for DPR
ctx.scale(dpr, dpr);

// Sub-pixel alignment for crisp lines
ctx.translate(0.5, 0.5);
ctx.imageSmoothingEnabled = false;
```

### 3. Text Rendering
```javascript
// Use base CSS font size directly (already scaled)
const finalFontSize = baseFontSize; // Not baseFontSize * dpr
ctx.font = `${finalFontSize}px 'JetBrains Mono', monospace`;
```

### 4. Performance Patterns
```javascript
// RequestAnimationFrame loop for 60fps
requestAnimationFrame(animationFrame);

// Element-specific bounds checking
if (boundsUtils.isYInBounds(elementY, config, dimensions)) {
  renderElement(); // Only if visible
}
```

### 5. Coordinate Transformation
```javascript
// Convert between CSS and canvas coordinates
cssToCanvas: (pos) => ({ x: pos.x * dpr, y: pos.y * dpr }),
canvasToCss: (pos) => ({ x: pos.x / dpr, y: pos.y / dpr })
```