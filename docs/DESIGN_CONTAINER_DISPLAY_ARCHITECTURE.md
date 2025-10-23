# DESIGN CONTAINER DISPLAY ARCHITECTURE

## Overview

Create a hierarchical separation between layout/interaction (Container) and content/rendering (Display) that eliminates circular dependencies while maintaining responsive behavior. This design provides a foundation for stable, responsive floating displays.

## Philosophy Embodiment

### **HIERARCHICAL**
- Clear separation between Container and Display layers
- Container manages layout, interaction, and user events
- Display handles content rendering, data processing, and visual scaling
- Linear data flow from user actions to visual updates

### **REACTIVE INDEPENDENCE**
- Independent reactive statements eliminate circular dependencies
- Container dimensions calculated directly from config percentages
- Display scaling uses container dimensions, not canvas dimensions
- Threshold-based updates prevent infinite loops

### **RESPONSIVE**
- Percentage-based storage maintains proportions across all sizes
- Reference Canvas Pattern ensures consistent visual scaling
- Container adapts to user input while Display adapts to container
- Visualizations scale proportionally to fit available space

### **STABLE**
- Multi-layer protection prevents exponential growth
- Safety limits and thresholds prevent edge cases
- Linear reactive flow eliminates infinite loops
- Comprehensive debugging and monitoring capabilities

---

## Architecture

### Core Foundation: Container-Display Separation

```javascript
// =============================================================================
// CONTAINER DISPLAY ARCHITECTURE
// =============================================================================

const CONTAINER_DISPLAY = {
  // HIERARCHICAL: Layer separation definition
  LAYERS: {
    CONTAINER: {
      responsibilities: [
        'Position Management: displayPosition.x, displayPosition.y',
        'Size Management: displaySize.width, displaySize.height',
        'User Interaction: drag, resize, hover, click events',
        'Visual Styling: borders, shadows, headers, resize handles',
        'Layout Constraints: minimum/maximum sizes, viewport boundaries'
      ],
      independence: 'INDEPENDENT of Display layer'
    },
    
    DISPLAY: {
      responsibilities: [
        'Content Rendering: all trading visualizations',
        'Data Processing: market data visualization',
        'Visual Scaling: adapting to container size',
        'Performance: optimized rendering pipeline',
        'Canvas Interactions: hover indicators, markers, clicks'
      ],
      dependence: 'DEPENDS on Container layer'
    }
  },
  
  // REACTIVE INDEPENDENCE: Independent reactive statements
  REACTIVE_FLOW: {
    containerCalculation: `
      // ✅ INDEPENDENT: Direct calculation from config percentages
      $: displaySize = { 
        width: (config.visualizationsContentWidth / 100) * REFERENCE_CANVAS.width,
        height: ((config.meterHeight / 100) * REFERENCE_CANVAS.height) + 40
      };
    `,
    
    displayScaling: `
      // ✅ INDEPENDENT: Uses container dimensions, not canvas dimensions
      $: scaledConfig = scaleToCanvas(config, displaySize.width, displaySize.height - 40);
    `,
    
    canvasResize: `
      // ✅ THRESHOLDED: Only resize when significant change detected
      $: if (canvas && ctx && displaySize) {
        const widthDiff = Math.abs(canvas.width - displaySize.width);
        const heightDiff = Math.abs(canvas.height - (displaySize.height - 40));
        
        if (widthDiff > 5 || heightDiff > 5) {
          updateCanvasSize(displaySize.width, displaySize.height - 40);
        }
      }
    `
  },
  
  // RESPONSIVE: Reference Canvas Pattern with three layers
  REFERENCE_CANVAS: {
    STORAGE_LAYER: {
      description: 'Percentages relative to 220×120px reference canvas',
      example: {
        visualizationsContentWidth: 110,  // 110% of 220px = 242px
        meterHeight: 100,                 // 100% of 120px = 120px
        centralAxisXPosition: 50          // 50% of 220px = 110px (center)
      }
    },
    
    CONTAINER_LAYER: {
      description: 'Direct calculation from config percentages',
      example: {
        displaySize: (config.visualizationsContentWidth / 100) * REFERENCE_CANVAS.width,     // 242px
        displaySize: ((config.meterHeight / 100) * REFERENCE_CANVAS.height) + 40             // 160px total
      }
    },
    
    DISPLAY_LAYER: {
      description: 'Scaled to actual canvas dimensions',
      example: {
        scaledConfig: scaleToCanvas(config, displaySize.width, displaySize.height - 40)
        // Result: All visualizations scale proportionally to 242×120px canvas
      }
    }
  },
  
  // STABLE: Multi-layer protection mechanisms
  SAFETY_MECHANISMS: {
    inputValidation: `
      function validateResizeDimensions(width, height) {
        return {
          width: Math.min(2000, Math.max(100, width)),
          height: Math.min(2000, Math.max(80, height))
        };
      }
    `,
    
    changeDetection: `
      // 5px threshold prevents micro-updates
      const widthThreshold = 5;
      const heightThreshold = 5;
      
      if (widthDiff > widthThreshold || heightDiff > heightThreshold) {
        updateCanvasSize(newWidth, newHeight);
      }
    `,
    
    hardBounds: `
      // SAFETY: Apply reasonable limits to prevent exponential growth
      const safeWidth = Math.min(2000, Math.max(100, newWidth));
      const safeHeight = Math.min(2000, Math.max(80, newHeight));
    `,
    
    debugLogging: `
      console.log(\`[CANVAS_RESIZE] Size check: current=\${currentWidth}x\${currentHeight}, new=\${newWidth}x\${newHeight}, diff=\${widthDiff}x\${heightDiff}\`);
    `
  }
};
```

---

## Container Layer Architecture

### Container Responsibilities
- **Position Management**: `displayPosition.x`, `displayPosition.y`
- **Size Management**: `displaySize.width`, `displaySize.height`
- **User Interaction**: Drag, resize, hover, click events
- **Visual Styling**: Borders, shadows, headers, resize handles
- **Layout Constraints**: Minimum/maximum sizes, viewport boundaries

### Container Implementation
```javascript
// Container Layer - Layout & Interaction
$: displayPosition = display?.position || position;
$: displaySize = { 
  width: Math.min(2000, (config.visualizationsContentWidth / 100) * REFERENCE_CANVAS.width), 
  height: Math.min(2000, ((config.meterHeight / 100) * REFERENCE_CANVAS.height) + 40)
};
```

### Container Data Flow
```
USER ACTION → CONTAINER (processes input)
     ↓
CONFIG UPDATE (percentages)
     ↓
SIZE CALCULATION (independent from Display)
     ↓
DISPLAY UPDATE (provides dimensions)
```

---

## Display Layer Architecture

### Display Responsibilities
- **Content Rendering**: All trading visualizations
- **Data Processing**: Market data visualization
- **Visual Scaling**: Adapting to container size
- **Performance**: Optimized rendering pipeline
- **Canvas Interactions**: Hover indicators, markers, clicks

### Display Implementation
```javascript
// Display Layer - Content Rendering
$: scaledConfig = scaleToCanvas(config, displaySize.width, displaySize.height - 40);

// Canvas resize with safety thresholds
$: if (canvas && ctx && displaySize) {
  const currentWidth = canvas.width;
  const currentHeight = canvas.height;
  const newWidth = displaySize.width;
  const newHeight = displaySize.height - 40;
  
  const widthDiff = Math.abs(currentWidth - newWidth);
  const heightDiff = Math.abs(currentHeight - newHeight);
  
  if (widthDiff > 5 || heightDiff > 5) {
    updateCanvasSize(newWidth, newHeight);
  }
}
```

### Display Data Flow
```
DISPLAY RECEIVES (container dimensions)
     ↓
SCALING CALCULATION (percentage to pixel)
     ↓
CANVAS RESIZE (threshold-based)
     ↓
VISUAL UPDATES (proportional rendering)
```

---

## Reference Canvas Pattern

### Three-Layer Responsive System

#### Storage Layer (Percentages)
```javascript
// Store: percentages relative to 220×120px reference canvas
config.visualizationsContentWidth = 110;  // 110% of 220px = 242px
config.meterHeight = 100;                 // 100% of 120px = 120px
config.centralAxisXPosition = 50;         // 50% of 220px = 110px (center)
```

#### Container Layer (Layout)
```javascript
// Container: direct calculation from config percentages
displaySize.width = (config.visualizationsContentWidth / 100) * REFERENCE_CANVAS.width;     // 242px
displaySize.height = ((config.meterHeight / 100) * REFERENCE_CANVAS.height) + 40;             // 160px total
```

#### Display Layer (Rendering)
```javascript
// Rendering: scaled to actual canvas dimensions
scaledConfig = scaleToCanvas(config, displaySize.width, displaySize.height - 40);
// Result: All visualizations scale proportionally to 242×120px canvas
```

### Scale Function Implementation
```javascript
function scaleToCanvas(config, currentCanvasWidth, currentCanvasHeight) {
  const scaleX = currentCanvasWidth / REFERENCE_CANVAS.width;
  const scaleY = currentCanvasHeight / REFERENCE_CANVAS.height;
  
  return {
    // Layout parameters (percentage-based)
    visualizationsContentWidth: (config.visualizationsContentWidth / 100) * currentCanvasWidth,
    meterHeight: (config.meterHeight / 100) * currentCanvasHeight,
    centralAxisXPosition: (config.centralAxisXPosition / 100) * currentCanvasWidth,
    
    // Price display parameters (percentage-based)
    priceFloatWidth: (config.priceFloatWidth / 100) * currentCanvasWidth,
    priceFloatHeight: (config.priceFloatHeight / 100) * currentCanvasHeight,
    priceFontSize: (config.priceFontSize / 100) * currentCanvasHeight,
    
    // Pass through non-scaled parameters unchanged
    ...Object.fromEntries(
      Object.entries(config).filter(([key]) => ![
        'visualizationsContentWidth', 'meterHeight', 'centralAxisXPosition',
        'priceFloatWidth', 'priceFloatHeight', 'priceFontSize'
      ].includes(key))
    )
  };
}
```

---

## Resize Handle System

### 8-Handle Implementation
```javascript
const handleBehaviors = {
  nw: { // Northwest: Adjust top-left corner
    widthDelta: -deltaX, heightDelta: -deltaY,
    positionX: deltaX, positionY: deltaY
  },
  ne: { // Northeast: Adjust top-right corner  
    widthDelta: deltaX, heightDelta: -deltaY,
    positionY: deltaY
  },
  se: { // Southeast: Adjust bottom-right corner
    widthDelta: deltaX, heightDelta: deltaY,
    positionChange: false
  },
  sw: { // Southwest: Adjust bottom-left corner
    widthDelta: -deltaX, heightDelta: deltaY,
    positionX: deltaX
  },
  
  // Edge Handles (resize single dimension + position)
  n: { heightDelta: -deltaY, positionY: deltaY },      // North: Top edge
  s: { heightDelta: deltaY, positionChange: false },   // South: Bottom edge
  e: { widthDelta: deltaX, positionChange: false },    // East: Right edge
  w: { widthDelta: -deltaX, positionX: deltaX }       // West: Left edge
};
```

### Minimum Constraints
```javascript
const MIN_WIDTH = GEOMETRY.COMPONENTS.FloatingDisplay.defaultSize.width;   // 240px
const MIN_HEIGHT = GEOMETRY.COMPONENTS.FloatingDisplay.defaultSize.height;  // 160px
```

---

## Data Flow Architecture

### Linear Event Chain
```
USER ACTION → CONTAINER → DISPLAY → VISUALIZATIONS
     ↓              ↓           ↓             ↓
Resize handle → Container → Canvas → Scaled rendering
    drag         resizes     resizes      proportions
```

### Reactive Flow Diagram
```
Config (percentages)
    ↓
Container Size Calculation (independent)
    ↓
Scaled Config (for rendering)
    ↓
Canvas Resize (threshold-based)
    ↓
Visual Updates (proportional)
```

---

## Implementation Guidelines

### 1. Container Implementation
```javascript
// Container Layer - Layout & Interaction
$: displayPosition = display?.position || position;
$: displaySize = { 
  width: Math.min(2000, (config.visualizationsContentWidth / 100) * REFERENCE_CANVAS.width), 
  height: Math.min(2000, ((config.meterHeight / 100) * REFERENCE_CANVAS.height) + 40)
};
```

### 2. Display Implementation
```javascript
// Display Layer - Content Rendering
$: scaledConfig = scaleToCanvas(config, displaySize.width, displaySize.height - 40);

// Canvas resize with safety thresholds
$: if (canvas && ctx && displaySize) {
  const currentWidth = canvas.width;
  const currentHeight = canvas.height;
  const newWidth = displaySize.width;
  const newHeight = displaySize.height - 40;
  
  const widthDiff = Math.abs(currentWidth - newWidth);
  const heightDiff = Math.abs(currentHeight - newHeight);
  
  if (widthDiff > 5 || heightDiff > 5) {
    updateCanvasSize(newWidth, newHeight);
  }
}
```

### 3. Safety Implementation
```javascript
function updateCanvasSize(newWidth, newHeight) {
  if (!canvas || !ctx) return;
  
  // SAFETY: Apply reasonable limits
  const safeWidth = Math.min(2000, Math.max(100, newWidth));
  const safeHeight = Math.min(2000, Math.max(80, newHeight));
  
  // Update canvas dimensions
  canvas.width = safeWidth;
  canvas.height = safeHeight;
  
  // Update tracking variables
  canvasWidth = safeWidth;
  canvasHeight = safeHeight;
  
  // Clear and reset context
  ctx.clearRect(0, 0, safeWidth, safeHeight);
}
```

---

## Performance Characteristics

### Stability Metrics
- **✅ No Exponential Growth**: Canvas dimensions stay within bounds
- **✅ Proportional Scaling**: All visualizations scale correctly
- **✅ No Infinite Loops**: Linear reactive flow established
- **✅ Smooth User Experience**: Responsive resize operations

### Performance Targets
- **Resize Response Time**: < 16ms (60fps)
- **Memory Usage**: Stable, no memory leaks
- **CPU Usage**: < 50% single core during resize
- **Visual Updates**: Smooth, no flickering

---

## Testing Strategy

### 1. Unit Tests
- **Reactive Independence**: Verify no circular dependencies
- **Scale Function**: Test percentage-to-pixel conversion
- **Safety Mechanisms**: Validate bounds and thresholds
- **Resize Handles**: Test all 8 handle behaviors

### 2. Integration Tests
- **End-to-End Resize**: Complete resize workflow
- **Performance**: 60fps maintenance during resize
- **Memory**: No leaks during extended resize sessions
- **Visual Consistency**: Proportional scaling verification

### 3. Edge Case Tests
- **Minimum Size**: 240×160px constraint enforcement
- **Maximum Size**: 2000px limit enforcement
- **Rapid Resize**: Multiple quick resize operations
- **Browser Compatibility**: Cross-browser resize behavior

---

## Maintenance Guidelines

### 1. Debugging
- **Enable Logging**: Set `DEBUG_LOGGING = { canvasResize: true, configUpdates: true }`
- **Monitor Dimensions**: Watch for unusual canvas sizes
- **Track Performance**: Monitor resize frequency and duration

### 2. Modification Guidelines
- **Preserve Independence**: Maintain reactive statement independence
- **Respect Thresholds**: Don't reduce 5px change threshold
- **Maintain Bounds**: Keep 2000px maximum limits
- **Update Documentation**: Document any architectural changes

### 3. Performance Monitoring
```javascript
// Performance monitoring implementation
let resizeCount = 0;
const MAX_RESIZE_PER_SECOND = 10;

function trackResizeActivity() {
  resizeCount++;
  if (resizeCount > MAX_RESIZE_PER_SECOND) {
    console.warn('[PERFORMANCE] Excessive resize activity detected');
    resizeCount = 0;
  }
}
```

---

## Benefits

### **HIERARCHICAL**
- Clear separation between Container and Display layers
- Linear data flow from user actions to visual updates
- Independent reactive statements eliminate circular dependencies
- Well-defined responsibilities for each layer

### **REACTIVE INDEPENDENCE**
- Container dimensions calculated independently of Display
- Display scaling depends only on Container dimensions
- Threshold-based updates prevent infinite loops
- Stable, predictable reactive behavior

### **RESPONSIVE**
- Percentage-based storage maintains proportions across all sizes
- Reference Canvas Pattern ensures consistent visual scaling
- Container adapts to user input while Display adapts to container
- Visualizations scale proportionally to fit available space

### **STABLE**
- Multi-layer protection prevents exponential growth
- Safety limits and thresholds prevent edge cases
- Linear reactive flow eliminates infinite loops
- Comprehensive debugging and monitoring capabilities

---

## Critical Issues Resolved

### **Exponential Canvas Growth Issue**
**Problem**: Canvas dimensions growing from 29809×177829 → 40106×407526 → 72603×2124684 pixels
**Root Cause**: Circular dependency in Reference Canvas Pattern reactive statements
**Solution**: Independent reactive statements with Container-Display separation
**Result**: Stable canvas dimensions within reasonable bounds

### **Circular Dependency Elimination**
**Problem**: DisplaySize → ScaledConfig → Canvas Resize → CanvasWidth/Height → ScaledConfig (LOOP)
**Solution**: DisplaySize calculated directly from config percentages, independent of canvas dimensions
**Result**: Linear reactive flow with no infinite loops

### **Resize Functionality Restoration**
**Problem**: All 8 resize handles broken, system unusable
**Solution**: Proper coordinate calculations with Container-Display architecture
**Result**: All resize handles working correctly with smooth user experience

---

## Implementation Status

- **✅ Architecture Design**: Complete
- **✅ Implementation**: Complete in FloatingDisplay.svelte
- **✅ Testing**: All 8 resize handles verified working
- **✅ Performance**: Stable 60fps maintained
- **✅ Documentation**: Complete design specification
- **✅ Production**: Fully deployed and stable

---

## Related Documents

- [DESIGN_UNIFIED_GEOMETRY_FOUNDATION.md](./DESIGN_UNIFIED_GEOMETRY_FOUNDATION.md)
- [DESIGN_UNIFIED_CONTEXT_MENU_ARCHITECTURE.md](./DESIGN_UNIFIED_CONTEXT_MENU_ARCHITECTURE.md)
- [RADICAL_FLOATING_ARCHITECTURE_MIGRATION.md](./RADICAL_FLOATING_ARCHITECTURE_MIGRATION.md)

---

**Document Version**: 1.0  
**Last Updated**: October 23, 2025  
**Next Review**: As needed for architectural changes
