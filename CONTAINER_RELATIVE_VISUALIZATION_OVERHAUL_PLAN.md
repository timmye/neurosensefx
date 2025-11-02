# Container-Relative Visualization Overhaul Plan

### **Core Problem Diagnosis**

NeuroSense FX has **container-relative positioning inconsistencies** across all visualization components:

1. **Fixed Central Axis** - Hardcoded `centralAxisXPosition` with no configurability
2. **Non-Responsive Elements** - Visualizations don't adapt to container size changes
3. **Scattered Positioning Logic** - Each component calculates positions independently
4. **Missing Container Boundaries** - Elements can overflow or misalign on resize

**Result**: Professional trading interface lacks the responsive precision required for extended trading sessions.

### **Strategic Requirements**

**User Specifications:**
- **ADR Axis Default Position**: 30% right of center
- **Price Marker Interaction**: Current click implementation retained (no visual feedback)
- **ADR Axis Range**: 5% to 95% of container width
- **Config Update Frequency**: Global default (per-canvas config noted for future resolution)

**Design Document Compliance:**
- **Day Range Meter**: Horizontal movement capability (ADR axis positioning)
- **Responsive Elements**: All elements relative to container dimensions
- **Professional Interface**: Precise positioning control for trading workflows

### **Container-Relative Elements Analysis**

**Current State vs. Required State:**

| Component | Current Positioning | Required Positioning | Gap |
|------------|-------------------|-------------------|------|
| Day Range Meter | Fixed `centralAxisXPosition` | Configurable `adrAxisXPosition` | **MISSING** |
| Price Float | Uses fixed axis | Uses `adrAxisXPosition` | **BROKEN** |
| Volatility Orb | Fixed center | Uses `adrAxisXPosition` | **BROKEN** |
| Market Profile | Fixed alignment | Uses `adrAxisXPosition` | **BROKEN** |
| Price Display | Fixed offset | Container-aware positioning | **PARTIAL** |
| Hover Indicator | Basic positioning | Smart positioning near axis | **NEEDS WORK** |

### **Execution Plan: Surgical Container Integration**

#### **Phase 1: Foundation Configuration (1 hour)**

**Add ADR Axis Configuration:**
```javascript
// Add to default config
const defaultConfig = {
  // ... existing config ...
  adrAxisXPosition: null, // Will default to 30% right of center
  adrAxisXMin: 0.05,  // 5% of container width
  adrAxisXMax: 0.95   // 95% of container width
};
```

**Context Menu Integration:**
```javascript
// Add to floatingStore actions
updateAdrAxisPosition: (displayId, position) => {
  const display = displays.get(displayId);
  if (display) {
    const clampedPosition = Math.max(
      config.adrAxisXMin * display.size.width,
      Math.min(config.adrAxisXMax * display.size.width, position)
    );
    display.config.adrAxisXPosition = clampedPosition;
    displays.set(displayId, display);
  }
}
```

#### **Phase 2: Visualization Function Updates (2 hours)**

**Files to Modify:**

1. **dayRangeMeter.js** - Primary axis positioning
```javascript
// BEFORE: Fixed central axis
const startX = centralAxisXPosition - (priceFloatWidth / 2);

// AFTER: Configurable ADR axis
const axisX = config.adrAxisXPosition || (visualizationsContentWidth * 0.65); // 30% right of center
const startX = axisX - (priceFloatWidth / 2);
```

2. **priceFloat.js** - Horizontal positioning
```javascript
// Update positioning calculation
const axisX = config.adrAxisXPosition || (width * 0.65);
const startX = axisX - (priceFloatWidth / 2);
```

3. **volatilityOrb.js** - Center positioning
```javascript
// Update center calculation
const axisX = config.adrAxisXPosition || (width * 0.65);
const centerX = axisX;
```

4. **marketProfile.js** - Alignment calculations
```javascript
// Update left/right alignment
const axisX = config.adrAxisXPosition || (visualizationsContentWidth * 0.65);

const leftData = marketProfile.levels.map(level => ({
    x: axisX - x(level.sell),
    y: y(level.price)
}));

const rightData = marketProfile.levels.map(level => ({
    x: axisX + x(level.buy),
    y: y(level.price)
}));
```

5. **hoverIndicator.js** - Smart label positioning
```javascript
// Update smart positioning near ADR axis
const axisX = config.adrAxisXPosition || (config.visualizationsContentWidth * 0.65);

if (axisX + labelOffsetFromLine + metrics.width < config.visualizationsContentWidth) {
    labelX = axisX + labelOffsetFromLine;
} else if (axisX - labelOffsetFromLine - metrics.width > 0) {
    labelX = axisX - labelOffsetFromLine - metrics.width;
    ctx.textAlign = 'right';
} else {
    // Fallback positioning
    labelX = config.visualizationsContentWidth - metrics.width - labelPadding;
    ctx.textAlign = 'right';
}
```

#### **Phase 3: Container Boundary Integration (1 hour)**

**Boundary Checking Function:**
```javascript
// Add to canvasSizing.js utils
const boundsUtils = {
  // ... existing utils ...
  isAxisInBounds: (axisX, config) => {
    const containerWidth = config.visualizationsContentWidth;
    return axisX >= (config.adrAxisXMin * containerWidth) && 
           axisX <= (config.adrAxisXMax * containerWidth);
  }
};
```

**Responsive Axis Calculation:**
```javascript
// Add to Container.svelte reactive system
$: if (config && canvasSizingConfig) {
  const containerWidth = canvasSizingConfig.dimensions.canvasArea.width;
  
  // Default ADR axis to 30% right of center if not set
  if (!config.adrAxisXPosition) {
    config.adrAxisXPosition = containerWidth * 0.65; // 50% + 15% = 65%
  }
  
  // Ensure axis stays within bounds on container resize
  if (config.adrAxisXPosition) {
    config.adrAxisXPosition = Math.max(
      containerWidth * 0.05,  // 5% minimum
      Math.min(containerWidth * 0.95, config.adrAxisXPosition) // 95% maximum
    );
  }
}
```

#### **Phase 4: Context Menu Integration (1 hour)**

**Add ADR Axis Controls:**
```javascript
// Add to context menu generation
const getCanvasContextMenuItems = (displayId) => {
  const display = displays.get(displayId);
  const axisPosition = display?.config?.adrAxisXPosition || 'Default';
  
  return [
    // ... existing menu items ...
    {
      type: 'slider',
      label: `ADR Axis Position: ${Math.round(axisPosition)}px`,
      min: 0,
      max: display.size.width,
      value: axisPosition,
      action: (value) => actions.updateAdrAxisPosition(displayId, value)
    },
    {
      type: 'separator'
    },
    {
      type: 'button',
      label: 'Reset ADR Axis',
      action: () => actions.updateAdrAxisPosition(displayId, null) // Uses default
    }
  ];
};
```

### **Expected Outcomes**

**Before**: Fixed positioning, non-responsive elements, inconsistent layout
**After**: Fully configurable ADR axis, container-responsive elements, professional positioning

**Benefits:**
1. **Precise Control** - ADR axis positioning configurable via context menu
2. **Responsive Layout** - All elements adapt to container size changes
3. **Professional Interface** - Meets design document requirements
4. **Consistent Behavior** - All visualizations use same positioning logic
5. **Boundary Safety** - Elements constrained within container bounds

### **Risk Mitigation**

**Low Risk:**
- Simple configuration parameter addition
- Non-breaking changes (defaults maintain current behavior)
- Isolated to visualization functions only

**Rollback Plan:**
- Git branch before changes
- Keep original functions commented out
- Test with single display first

### **Success Criteria**

**Container-relative success looks like:**
1. ADR axis repositionable via context menu slider
2. All elements follow axis position changes immediately
3. Container resize maintains proper element positioning
4. No elements overflow container boundaries
5. Existing price marker click functionality preserved

### **The Bottom Line**

**This implements professional-grade container-relative positioning.**

The overhaul ensures every visualization element properly relates to container dimensions while providing the precise control needed for professional trading workflows. All elements will maintain proper relationships during resize operations and respect container boundaries.

---

*Use this document as source of truth during execution. When confusion arises, return to this plan rather than generating additional analysis docs.*

## **Implementation Order**

1. **Add ADR axis configuration** to default config and store actions
2. **Update dayRangeMeter.js** to use configurable axis position
3. **Update priceFloat.js** positioning calculations
4. **Update volatilityOrb.js** center positioning
5. **Update marketProfile.js** alignment calculations
6. **Update hoverIndicator.js** smart positioning
7. **Add container boundary checking** and responsive behavior
8. **Integrate context menu controls** for ADR axis positioning
9. **Test container resize scenarios** with various axis positions
10. **Validate price marker click** functionality preserved

This ensures every canvas element that requires container relationship is properly addressed while maintaining existing functionality.
