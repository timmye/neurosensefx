# DPR-Aware Canvas Rendering System

Provides crisp 60fps canvas rendering across device pixel ratios with consistent sizing and performance optimization.

## Core Patterns

### DPR Scaling
```javascript
// Device pixel ratio with zoom awareness
const dpr = window.devicePixelRatio || 1;

// Scale canvas context for crisp rendering
ctx.scale(dpr, dpr);

// Use CSS font sizes directly (already scaled)
const finalFontSize = baseFontSize; // Not baseFontSize * dpr
```

### Canvas Sizing
```javascript
// Reference canvas: 220×120px (NeuroSense standard)
export const REFERENCE_CANVAS = { width: 220, height: 120 };

// Calculate dimensions with DPR applied
const canvasWidth = Math.round(containerWidth * dpr);
const canvasHeight = Math.round(containerHeight * dpr);

// CSS dimensions (without DPR)
canvas.style.width = containerWidth + 'px';
canvas.style.height = containerHeight + 'px';
```

### Coordinate Transformation
```javascript
// Convert CSS to canvas coordinates
cssToCanvas: (cssPos, dpr) => ({
  x: cssPos.x * dpr,
  y: cssPos.y * dpr
}),

// Convert canvas to CSS coordinates
canvasToCss: (canvasPos, dpr) => ({
  x: canvasPos.x / dpr,
  y: canvasPos.y / dpr
})
```

## Performance Optimization

### RequestAnimationFrame Loop
```javascript
const animationFrame = () => {
  render();
  requestAnimationFrame(animationFrame);
};
requestAnimationFrame(animationFrame);
```

### Bounds Checking Pattern
```javascript
// Element-specific checking (not binary)
if (boundsUtils.isYInBounds(priceY, config, { canvasArea })) {
  drawPriceMarker(); // Only draw if visible
}

// Overflow tolerance: ±50px for effects
isYInBounds: (y) => y >= -50 && y <= canvasArea.height + 50
```

### Context Configuration
```javascript
// Sub-pixel alignment for crisp 1px lines
ctx.save();
ctx.translate(0.5, 0.5);
ctx.imageSmoothingEnabled = false;

// DPR-aware text rendering
ctx.scale(dpr, dpr);
ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;
```

## Memory Management

### Pattern Validation
- Dimensions clamped: 50px - 4000px
- Object reuse in render loops
- Guard clauses for early exits

### Performance Targets
- 60fps: 16.67ms max render time
- 20+ concurrent displays
- Sub-100ms data-to-visual latency

## Usage

```javascript
import {
  getCanvasDimensions,
  configureCanvasContext,
  configureTextForDPR,
  boundsUtils
} from '../../utils/canvasSizing.js';

// Setup canvas
const dimensions = getCanvasDimensions(containerSize);
configureCanvasContext(ctx, dimensions);

// Render with bounds checking
if (boundsUtils.isYInBounds(y, config, dimensions)) {
  configureTextForDPR(ctx, dimensions, { baseFontSize: 10 });
  // Draw content
}
```