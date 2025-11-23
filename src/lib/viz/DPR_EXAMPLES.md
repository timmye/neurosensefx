# DPR Rendering Examples

## Basic Canvas Setup
```javascript
import { getCanvasDimensions, configureCanvasContext } from '../../utils/canvasSizing.js';

// Create DPR-aware canvas configuration
const containerSize = { width: 220, height: 120 };
const dimensions = getCanvasDimensions(containerSize, { respectDpr: true });

// Set canvas dimensions
canvas.width = dimensions.canvas.width;
canvas.height = dimensions.canvas.height;
canvas.style.width = dimensions.canvas.cssWidth + 'px';
canvas.style.height = dimensions.canvas.cssHeight + 'px';

// Configure context for crisp rendering
configureCanvasContext(ctx, dimensions);
```

## Crisp Text Rendering
```javascript
import { configureTextForDPR } from '../../utils/canvasSizing.js';

// Configure text with DPR awareness
const textConfig = configureTextForDPR(ctx, dimensions, {
  baseFontSize: 10,
  fontFamily: 'JetBrains Mono',
  textAlign: 'center',
  textBaseline: 'middle'
});

// Use configured font directly (already DPR-scaled)
ctx.fillText(price, x, y);
```

## 1px Line Rendering
```javascript
function drawCrispLine(ctx, x1, y1, x2, y2) {
  ctx.save();

  // Sub-pixel alignment for perfect 1px lines
  ctx.translate(0.5, 0.5);

  // Disable smoothing for sharp rendering
  ctx.imageSmoothingEnabled = false;
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.restore();
}
```

## Bounds Checking
```javascript
import { boundsUtils } from '../../utils/canvasSizing.js';

function renderElement(ctx, elementY, config, canvasArea) {
  // Skip rendering if element is outside visible bounds
  if (!boundsUtils.isYInBounds(elementY, config, { canvasArea })) {
    return; // Performance optimization
  }

  // Render element (visible)
  drawElement(ctx, elementY);
}

// Clamp coordinates to safe bounds
const safePos = boundsUtils.clampToBounds(x, y, { canvasArea });
```

## Animation Loop
```javascript
class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.isRunning = false;
  }

  start() {
    this.isRunning = true;
    this.animate();
  }

  animate() {
    if (!this.isRunning) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Render frame
    this.render();

    // Schedule next frame (60fps target)
    requestAnimationFrame(() => this.animate());
  }

  stop() {
    this.isRunning = false;
  }
}