# Sigma Markers for Day Range Meter - Implementation Scope

## Objective

Add 1σ (1-sigma) and 2σ (2-sigma) markers to the existing Day Range Meter to provide traders with statistical context for daily price movements.

---

## Background & Reference

**Conversion Formula** (empirically validated):
```
σ_daily = ADR × 0.875
ADR = σ_daily × 1.14
```

**Source:** Robert Carver, ["The relationship between ATR and standard deviation"](https://qoppac.blogspot.com/2018/12/the-relationship-between-atr-and.html)

**Key Interpretation:**
- 1σ marker ≈ 114% ADR from daily open
- 2σ marker ≈ 229% ADR from daily open
- These represent statistical dispersion thresholds, not location from mean

---

## Current Implementation Analysis

### Files Involved

| File | Responsibility | Current State |
|------|---------------|---------------|
| `dayRangeConfig.js` | Configuration (colors, fonts, features) | ✓ Complete |
| `adrBoundaryCalculations.js` | Calculate ADR boundary prices & coordinates | ✓ Complete |
| `adrBoundaryRenderer.js` | Render ADR boundary lines | ✓ Complete |
| `dayRangeCore.js` | Core rendering functions (DPR-aware) | ✓ Complete |
| `dayRangeCalculations.js` | Progressive ADR disclosure logic | ✓ Complete |

### Current Visual Elements

1. **Center line** (dashed, reference color) - at daily open
2. **ADR boundary lines** (solid, purple) - at current adaptive scale (50%/75%/100%+)
3. **Reference lines** (dashed, transparent) - at 50% ADR when adaptive > 50%
4. **Percentage labels** - show ADR percentages

---

## Proposed Enhancement: Sigma Markers

### Visual Design

| Marker | Color | Line Style | Position | Label |
|--------|-------|------------|----------|-------|
| **1σ** | Orange/Cyan | Dashed-dotted | ±114% ADR from open | "1σ" |
| **2σ** | Red/Magenta | Dotted | ±229% ADR from open | "2σ" |

### Display Logic

**Always show:** 1σ and 2σ markers (static positions based on ADR)
**Override:** Hide if adaptive scale expansion is < 50% (too cluttered for quiet days)

### Placement in Rendering Order

```
1. Background
2. Center line (daily open)
3. 2σ markers (outermost, subtle)
4. 1σ markers (middle, more visible)
5. ADR boundary lines (primary, most visible)
6. Reference lines (50% ADR, if applicable)
7. Labels
```

---

## Implementation Plan

### Phase 1: Calculations (Pure Functions)

**File:** `adrBoundaryCalculations.js`

**Add:**

```javascript
// Calculate sigma marker prices
export function calculateSigmaMarkers(adrData) {
  if (!adrData || !adrData.midPrice || !adrData.adrValue) {
    return null;
  }

  const { midPrice, adrValue } = adrData;
  const sigmaValue = adrValue * 0.875; // σ = ADR × 0.875

  return {
    oneSigmaUpper: midPrice + (sigmaValue * 1),      // +1σ = +114% ADR
    oneSigmaLower: midPrice - (sigmaValue * 1),      // -1σ = -114% ADR
    twoSigmaUpper: midPrice + (sigmaValue * 2),      // +2σ = +229% ADR
    twoSigmaLower: midPrice - (sigmaValue * 2),      // -2σ = -229% ADR
    sigmaValue // for reference
  };
}

// Convert sigma markers to Y coordinates
export function calculateSigmaCoordinates(sigmaMarkers, priceScale) {
  if (!sigmaMarkers) return null;

  return {
    oneSigmaUpperY: priceScale(sigmaMarkers.oneSigmaUpper),
    oneSigmaLowerY: priceScale(sigmaMarkers.oneSigmaLower),
    twoSigmaUpperY: priceScale(sigmaMarkers.twoSigmaUpper),
    twoSigmaLowerY: priceScale(sigmaMarkers.twoSigmaLower)
  };
}
```

**Lines:** ~20 new lines

---

### Phase 2: Rendering Functions

**File:** `adrBoundaryRenderer.js`

**Add:**

```javascript
// Render sigma marker lines
export function renderSigmaMarkers(ctx, width, sigmaCoordinates, colors) {
  if (!sigmaCoordinates) return;

  ctx.save();

  // 2σ markers (outer, more subtle)
  ctx.strokeStyle = colors.sigmaTwoMarker || '#f472b6'; // Magenta
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]); // Dotted
  renderPixelPerfectLine(ctx, 0, sigmaCoordinates.twoSigmaUpperY, width, sigmaCoordinates.twoSigmaUpperY);
  renderPixelPerfectLine(ctx, 0, sigmaCoordinates.twoSigmaLowerY, width, sigmaCoordinates.twoSigmaLowerY);

  // 1σ markers (inner, more visible)
  ctx.strokeStyle = colors.sigmaOneMarker || '#fb923c'; // Orange
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 2]); // Dash-dot
  renderPixelPerfectLine(ctx, 0, sigmaCoordinates.oneSigmaUpperY, width, sigmaCoordinates.oneSigmaUpperY);
  renderPixelPerfectLine(ctx, 0, sigmaCoordinates.oneSigmaLowerY, width, sigmaCoordinates.oneSigmaLowerY);

  ctx.setLineDash([]);
  ctx.restore();
}

// Render sigma labels
export function renderSigmaLabels(ctx, width, sigmaCoordinates, config) {
  if (!sigmaCoordinates) return;

  const { colors, fonts } = config;
  const labelPadding = 5;

  ctx.save();
  ctx.font = fonts.percentageLabels || '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  // 1σ labels
  ctx.fillStyle = colors.sigmaOneMarker || '#fb923c';
  ctx.fillText('1σ', labelPadding, sigmaCoordinates.oneSigmaUpperY);
  ctx.fillText('1σ', labelPadding, sigmaCoordinates.oneSigmaLowerY);

  // 2σ labels
  ctx.fillStyle = colors.sigmaTwoMarker || '#f472b6';
  ctx.fillText('2σ', labelPadding, sigmaCoordinates.twoSigmaUpperY);
  ctx.fillText('2σ', labelPadding, sigmaCoordinates.twoSigmaLowerY);

  ctx.restore();
}
```

**Lines:** ~40 new lines

---

### Phase 3: Integration

**File:** `dayRangeCore.js`

**Modify `renderAdrBoundaryLines`:**

```javascript
export function renderAdrBoundaryLines(ctx, config, width, height, priceScale, adrData, adaptiveScale) {
  const { colors, features } = config;

  // Calculate boundaries and coordinates
  const boundaries = calculateAdrBoundaries(adrData, adaptiveScale);
  if (!boundaries) return;

  const coordinates = calculateBoundaryCoordinates(boundaries, priceScale);
  const referenceLines = calculateReferenceLines(boundaries, priceScale, adrData.adrValue);

  // Calculate sigma markers (NEW)
  const sigmaMarkers = calculateSigmaMarkers(adrData);
  const sigmaCoordinates = calculateSigmaCoordinates(sigmaMarkers, priceScale);

  // Determine if sigma markers should be shown (NEW)
  const showSigmaMarkers = features?.sigmaMarkers && shouldShowSigma(adaptiveScale);

  // Render all components
  renderRefLines(ctx, width, boundaries, coordinates, referenceLines, colors);

  // Render sigma markers (NEW - before ADR boundaries for layering)
  if (showSigmaMarkers) {
    renderSigmaMarkers(ctx, width, sigmaCoordinates, colors);
    renderSigmaLabels(ctx, width, sigmaCoordinates, config);
  }

  renderBoundaryLines(ctx, width, coordinates, colors);
  renderBoundaryLabels(ctx, width, height, boundaries, coordinates, colors);
}
```

**Add helper function:**

```javascript
function shouldShowSigma(adaptiveScale) {
  // Only show sigma markers if adaptive scale is at least 50%
  // This prevents clutter on quiet days
  return adaptiveScale.maxAdrPercentage >= 0.5;
}
```

**Lines:** ~15 modified, ~10 new

---

### Phase 4: Configuration

**File:** `dayRangeConfig.js`

**Add to `defaultConfig.colors`:**

```javascript
colors: {
  // ... existing colors ...
  sigmaOneMarker: '#fb923c',    // Orange for 1σ
  sigmaTwoMarker: '#f472b6',    // Magenta for 2σ
}
```

**Add to `defaultConfig.features`:**

```javascript
features: {
  // ... existing features ...
  sigmaMarkers: true,  // Enable sigma marker display
}
```

**Lines:** ~4 new

---

## Summary of Changes

| File | Lines Added | Lines Modified | Complexity |
|------|-------------|----------------|------------|
| `adrBoundaryCalculations.js` | ~20 | 0 | Low (pure functions) |
| `adrBoundaryRenderer.js` | ~40 | 0 | Low (rendering) |
| `dayRangeCore.js` | ~10 | ~15 | Medium (integration) |
| `dayRangeConfig.js` | ~4 | 0 | Low (config) |
| **TOTAL** | **~74** | **~15** | **Low-Medium** |

---

## Crystal Clarity Compliance

| Principle | Compliance |
|-----------|------------|
| **Files < 120 lines** | ✓ All files remain well under limit |
| **Functions < 15 lines** | ✓ All new functions under 10 lines |
| **Framework-First** | ✓ Pure Canvas 2D, no abstractions |
| **Single Responsibility** | ✓ Separate calc/render/config functions |
| **No Custom Implementations** | ✓ Uses existing patterns and utilities |

---

## Testing Considerations

1. **Visual Testing:** Verify markers appear at correct positions
2. **Edge Cases:**
   - Quiet days (adaptive < 50%) - markers should hide
   - Volatile days (200%+ ADR) - markers should be visible
   - Missing ADR data - graceful fallback
3. **DPR Testing:** Verify crisp rendering on high-DPI displays
4. **Color Contrast:** Ensure sigma markers are visible but not distracting

---

## Future Enhancements (Out of Scope)

- Toggle for σ-only view (hide ADR percentages)
- Configurable sigma levels (user-selectable 1σ/2σ/3σ)
- Sigma-based color coding for price markers
- Real-time sigma value display alongside ADR percentage
- Historical sigma percentiles (P50, P75, P95)

---

## Acceptance Criteria

- [ ] 1σ markers appear at ±114% ADR from daily open
- [ ] 2σ markers appear at ±229% ADR from daily open
- [ ] Markers hide when adaptive scale < 50%
- [ ] Markers render below ADR boundary lines (correct z-index)
- [ ] Labels are readable and non-overlapping
- [ ] Colors are distinct from existing elements
- [ ] All functions follow Crystal Clarity principles
- [ ] No performance degradation (60fps maintained)

---

## Open Questions

1. **Color choice:** Orange/Magenta proposed - any preference?
2. **Label position:** Left-aligned vs right-aligned?
3. **Always show 1σ:** Should 1σ always be visible even at 50% scale?
4. **Responsive behavior:** Hide sigma markers on small displays?
