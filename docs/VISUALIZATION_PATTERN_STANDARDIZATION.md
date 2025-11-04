# Visualization Pattern Standardization

## Overview

This document formalizes the successful rendering and container/resizing patterns from the Day Range Meter and establishes them as the standard for all NeuroSense FX visualizations.

## 🏗️ **CLEAN FOUNDATION PATTERN**

### **Core Architecture**
```
Container (physical) → Content (derived) → Rendering Context → Visualizations
```

**Layers:**
1. **Container Layer**: Physical dimensions (240×160px default)
2. **Content Layer**: Usable area after padding/header subtraction  
3. **Rendering Context**: Unified coordinate system with ADR axis positioning
4. **Visualization Layer**: Pure drawing functions with standardized signatures

### **Standard Function Signature**
```javascript
export function drawVisualizationName(ctx, renderingContext, config, state, y) {
  // Standardized implementation
}
```

**Parameters:**
- `ctx`: Canvas 2D rendering context
- `renderingContext`: Clean foundation context object
- `config`: Visualization configuration object
- `state`: Current market data state
- `y`: D3.js linear scale for price-to-coordinate conversion

## 📐 **RENDERING CONTEXT STANDARD**

### **Structure**
```javascript
const renderingContext = {
  containerSize: { width, height },           // Physical container dimensions
  contentArea: { width, height },             // Usable drawing area
  adrAxisX: number,                           // ADR axis X position
  // Backward compatibility
  visualizationsContentWidth: contentArea.width,
  meterHeight: contentArea.height,
  adrAxisXPosition: adrAxisX
};
```

### **Usage Pattern**
```javascript
// 🔧 CLEAN FOUNDATION: Use rendering context instead of legacy config
const { contentArea, adrAxisX } = renderingContext;

// 🔧 CLEAN FOUNDATION: Use ADR axis position from rendering context
const axisX = adrAxisX;

// 🔧 CLEAN FOUNDATION: Use content-relative positioning
const width = contentArea.width * config.widthRatio;
const height = contentArea.height * config.heightRatio;
```

## 🎨 **STANDARDIZED DRAWING PATTERNS**

### **1. Content-Relative Positioning**
```javascript
// Convert percentage values to actual pixels
const width = contentArea.width * config.widthRatio;
const height = contentArea.height * config.heightRatio;
const horizontalOffset = contentArea.width * config.horizontalOffsetRatio;
const fontSize = contentArea.height * config.fontSizeRatio;
```

### **2. Bounds Checking**
```javascript
// Use renderingContext for bounds validation
if (priceY === undefined || priceY === null || 
    priceY < -50 || priceY > contentArea.height + 50) return;
```

### **3. Configuration Extraction**
```javascript
// Extract configuration parameters (now content-relative)
const {
  widthRatio,
  heightRatio,
  color,
  opacity,
  showBackground,
  backgroundColor,
  backgroundOpacity
} = config;
```

### **4. Color Handling**
```javascript
function hexToRgba(hex, opacity) {
  if (!hex) return 'rgba(0,0,0,0)';
  
  const finalOpacity = (opacity === undefined || opacity === null) ? 1 : opacity;
  let r = 0, g = 0, b = 0;
  
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  
  return `rgba(${r},${g},${b},${finalOpacity})`;
}
```

### **5. Text Background Pattern**
```javascript
// Standardized text background with optional outline
const padding = config.textPadding || 4;
const backgroundX = textX - padding;
const backgroundY = textY - (textHeight / 2) - padding;
const backgroundWidth = textWidth + (padding * 2);
const backgroundHeight = textHeight + (padding * 2);

if (showBackground) {
  ctx.fillStyle = hexToRgba(backgroundColor, backgroundOpacity);
  ctx.fillRect(backgroundX, backgroundY, backgroundWidth, backgroundHeight);
}

if (showOutline) {
  ctx.strokeStyle = hexToRgba(outlineColor, outlineOpacity);
  ctx.lineWidth = 1;
  ctx.strokeRect(backgroundX, backgroundY, backgroundWidth, backgroundHeight);
}
```

## 🔄 **RESIZING INTEGRATION**

### **Container-Level Updates**
```javascript
// In Container.svelte
$: if (canvas && config) {
  // 1. Container layer - physical dimensions
  const containerSize = config.containerSize || { width: 240, height: 160 };
  
  // 2. Content area - derived from container
  const contentArea = {
    width: containerSize.width - (config.padding * 2),
    height: containerSize.height - config.headerHeight - config.padding
  };
  
  // 3. ADR axis - positioned relative to content
  const adrAxisX = contentArea.width * config.adrAxisPosition;
  
  // 4. Create rendering context for visualizations
  renderingContext = {
    containerSize,
    contentArea,
    adrAxisX,
    // Backward compatibility
    visualizationsContentWidth: contentArea.width,
    meterHeight: contentArea.height,
    adrAxisXPosition: adrAxisX
  };
}
```

### **Canvas Configuration**
```javascript
// Use unified canvas sizing
canvasSizingConfig = createCanvasSizingConfig(containerSize, config, {
  includeHeader: true,
  padding: config.padding,
  headerHeight: config.headerHeight,
  respectDpr: true
});

// Configure canvas with unified sizing
configureCanvasContext(ctx, canvasSizingConfig.dimensions);
```

## 📋 **IMPLEMENTATION CHECKLIST**

### **Required for Each Visualization**
- [ ] Use standard function signature: `drawVisualizationName(ctx, renderingContext, config, state, y)`
- [ ] Extract renderingContext: `const { contentArea, adrAxisX } = renderingContext;`
- [ ] Use content-relative positioning for all dimensions
- [ ] Apply bounds checking using contentArea dimensions
- [ ] Use standardized hexToRgba function for colors
- [ ] Implement text background/outline pattern where applicable
- [ ] Add proper error handling and null checks
- [ ] Use D3.js scale for price-to-coordinate conversion
- [ ] Follow consistent commenting with "🔧 CLEAN FOUNDATION" markers

### **Configuration Standards**
- [ ] Use percentage-based ratios (0-1) for dimensions relative to contentArea
- [ ] Provide sensible defaults for all configuration parameters
- [ ] Support opacity controls for all visual elements
- [ ] Enable/disable flags for optional features
- [ ] Color configuration with fallback values

### **Performance Requirements**
- [ ] Early return for invalid state or parameters
- [ ] Efficient bounds checking to prevent unnecessary drawing
- [ ] Proper canvas state management (save/restore)
- [ ] Memory-efficient gradient and pattern creation

## 🎯 **MIGRATION PLAN**

### **Phase 1: Pattern Documentation** ✅
- [x] Document successful patterns from dayrangemeter
- [x] Create implementation checklist
- [x] Define configuration standards

### **Phase 2: Apply to Existing Visualizations**
- [ ] Update marketProfile.js
- [ ] Update priceFloat.js  
- [ ] Update volatilityOrb.js
- [ ] Update priceDisplay.js
- [ ] Update priceMarkers.js
- [ ] Update hoverIndicator.js

### **Phase 3: Validation & Testing**
- [ ] Test all visualizations with new patterns
- [ ] Verify resize behavior across all components
- [ ] Performance testing with 20+ displays
- [ ] Update documentation with any discovered issues

## 📊 **BENEFITS**

### **Consistency**
- Unified coordinate system across all visualizations
- Standardized configuration patterns
- Consistent error handling and bounds checking

### **Maintainability**
- Clear separation of concerns
- Documented patterns for future development
- Reduced code duplication

### **Performance**
- Efficient canvas sizing and DPR handling
- Optimized bounds checking
- Reduced unnecessary redraws

### **Reliability**
- Robust error handling
- Consistent behavior across visualizations
- Standardized configuration validation

This pattern standardization ensures all NeuroSense FX visualizations follow the same high-quality, performance-optimized approach established in the successful Day Range Meter implementation.
