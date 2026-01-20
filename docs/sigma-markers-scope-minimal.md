# Sigma Markers - Minimal Scope (Crystal Clarity Compliant)

## The Actual Work

**2 functions added, 1 function modified. ~30 lines total.**

---

## Implementation

### 1. Add Calculation Function

**File:** `adrBoundaryCalculations.js`

```javascript
export function calculateSigmaMarkers(adrData) {
  if (!adrData?.midPrice || !adrData?.adrValue) return null;
  const sigmaValue = adrData.adrValue * 0.875;
  return {
    oneSigmaUpper: adrData.midPrice + sigmaValue,
    oneSigmaLower: adrData.midPrice - sigmaValue,
    twoSigmaUpper: adrData.midPrice + sigmaValue * 2,
    twoSigmaLower: adrData.midPrice - sigmaValue * 2
  };
}
```

**Lines:** 7

---

### 2. Add Render Function

**File:** `adrBoundaryRenderer.js`

```javascript
export function renderSigmaMarkers(ctx, width, sigmaCoords, colors) {
  if (!sigmaCoords) return;
  ctx.save();
  ctx.lineWidth = 1;

  // 2σ (outer, dotted)
  ctx.strokeStyle = colors.sigmaTwo || '#f472b6';
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.moveTo(0, sigmaCoords.twoSigmaUpperY);
  ctx.lineTo(width, sigmaCoords.twoSigmaUpperY);
  ctx.moveTo(0, sigmaCoords.twoSigmaLowerY);
  ctx.lineTo(width, sigmaCoords.twoSigmaLowerY);
  ctx.stroke();

  // 1σ (inner, dash-dot)
  ctx.strokeStyle = colors.sigmaOne || '#fb923c';
  ctx.setLineDash([4, 2]);
  ctx.beginPath();
  ctx.moveTo(0, sigmaCoords.oneSigmaUpperY);
  ctx.lineTo(width, sigmaCoords.oneSigmaUpperY);
  ctx.moveTo(0, sigmaCoords.oneSigmaLowerY);
  ctx.lineTo(width, sigmaCoords.oneSigmaLowerY);
  ctx.stroke();

  ctx.restore();
}
```

**Lines:** 24

---

### 3. Integrate (Modify Existing)

**File:** `dayRangeCore.js` - modify `renderAdrBoundaryLines()`

```javascript
// Add this after line 77 (after referenceLines calculation):
const sigmaMarkers = calculateSigmaMarkers(adrData);
const sigmaCoords = sigmaMarkers ? {
  oneSigmaUpperY: priceScale(sigmaMarkers.oneSigmaUpper),
  oneSigmaLowerY: priceScale(sigmaMarkers.oneSigmaLower),
  twoSigmaUpperY: priceScale(sigmaMarkers.twoSigmaUpper),
  twoSigmaLowerY: priceScale(sigmaMarkers.twoSigmaLower)
} : null;

// Add this after line 82 (after renderRefLines call):
renderSigmaMarkers(ctx, width, sigmaCoords, colors);
```

**Lines:** +10

---

### 4. Add Config

**File:** `dayRangeConfig.js`

```javascript
colors: {
  // ... existing ...
  sigmaOne: '#fb923c',
  sigmaTwo: '#f472b6'
}
```

**Lines:** +2

---

## Summary

| File | Lines |
|------|-------|
| `adrBoundaryCalculations.js` | +7 |
| `adrBoundaryRenderer.js` | +24 |
| `dayRangeCore.js` | +10 |
| `dayRangeConfig.js` | +2 |
| **Total** | **~43 lines** |

**No new data. No backend changes. No complexity.**

---

## What Was Removed (from original 90-line estimate)

| Removed | Why |
|---------|-----|
| Separate coordinate calculation function | Inline it (5 lines vs 10) |
| Separate label rendering function | No labels needed (traders know what σ is) |
| `shouldShowSigma()` logic | Always show, let lines speak for themselves |
| Complex display conditions | Keep it simple |

---

## Final Answer

**43 lines.**

2 new functions, 1 modified function, 2 config lines.

The 90-line estimate included labels, conditional display, and extra helper functions that aren't necessary.
