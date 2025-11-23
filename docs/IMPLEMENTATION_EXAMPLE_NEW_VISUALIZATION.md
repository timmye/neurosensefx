# Example: Creating a New Visualization Component

## Example Visualization Implementation

This demonstrates how to create a new "Custom Indicator" visualization using the Container-Content-Rendering pipeline.

### Step 1: Create Rendering Library

```javascript
// src/lib/viz/customIndicator.js
import { boundsUtils, configureTextForDPR } from '../../utils/canvasSizing.js';

/**
 * Custom Indicator Visualization
 * Renders custom market indicator with configurable parameters
 */
export function drawCustomIndicator(ctx, renderingContext, config, state, y) {
  // Guard clause - respect show/hide configuration
  if (!config.showCustomIndicator) {
    return;
  }

  // Extract rendering context from container
  const { contentArea, adrAxisX } = renderingContext;

  // Extract required data from state
  const { customValue = 0, threshold = 50 } = state;

  // Safe context management
  ctx.save();

  try {
    // Position calculation using content area
    const xPos = contentArea.width * 0.1; // 10% from left
    const yPos = y(customValue); // Convert data value to Y coordinate

    // Render indicator
    ctx.fillStyle = customValue > threshold ? '#22c55e' : '#ef4444';
    ctx.beginPath();
    ctx.arc(xPos, yPos, 4, 0, Math.PI * 2);
    ctx.fill();

    // Render threshold line
    const thresholdY = y(threshold);
    ctx.strokeStyle = '#6b7280';
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, thresholdY);
    ctx.lineTo(contentArea.width, thresholdY);
    ctx.stroke();

  } finally {
    ctx.restore();
  }
}
```

### Step 2: Add to Container.svelte

```javascript
// Import the new visualization
import { drawCustomIndicator } from '../../lib/viz/customIndicator.js';

// Add to draw function in rendering order
function draw(currentState, currentRenderingContext, currentMarkers) {
  // ... existing background renderers ...

  // Add custom indicator in appropriate layer
  try {
    drawCustomIndicator(ctx, currentRenderingContext, config, currentState, y);
  } catch (error) {
    console.error('[Container] Custom Indicator render error:', error);
  }

  // ... existing foreground renderers ...
}
```

### Step 3: Add Configuration Schema

```javascript
// src/data/schema.js
export const VisualizationConfigSchema = z.object({
  // ... existing fields ...
  showCustomIndicator: z.boolean().default(false),
  customIndicatorColor: z.string().default('#22c55e'),
  customIndicatorThreshold: z.number().default(50),
});
```

### Step 4: Update Default Configuration

```javascript
// src/config/visualizationSchema.js
export function getEssentialDefaultConfig() {
  return {
    // ... existing defaults ...
    showCustomIndicator: true,
    customIndicatorColor: '#22c55e',
    customIndicatorThreshold: 50,
  };
}
```

## Container Integration Benefits

- **Automatic DPR scaling** - Container handles device pixel ratio
- **Error isolation** - Failed renders don't crash other visualizations
- **Configuration inheritance** - New displays get runtime settings automatically
- **Performance optimization** - Container manages draw throttling and context reuse
- **Standardized interface** - Consistent parameter pattern across all visualizations

The visualization library focuses purely on rendering logic while the container handles cross-cutting concerns like sizing, scaling, and lifecycle management.