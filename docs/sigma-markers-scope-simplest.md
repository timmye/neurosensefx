# Sigma Markers - Simplest Approach (Direct Render)

## The Idea

Add sigma markers directly in the main render function - no new files, no separate functions.

---

## Single File Change

**File:** `dayRangeCore.js`

**Location:** Inside `renderAdrBoundaryLines()` function, after line 82 (after `renderRefLines` call)

---

## Code to Add

```javascript
// === SIGMA MARKERS ===
if (adrData?.midPrice && adrData?.adrValue) {
  const sigmaValue = adrData.adrValue * 0.875;
  ctx.save();
  ctx.lineWidth = 1;

  // 2σ markers
  ctx.strokeStyle = colors.sigmaTwo || '#f472b6';
  ctx.setLineDash([2, 4]);
  const twoSigmaUpperY = priceScale(adrData.midPrice + sigmaValue * 2);
  const twoSigmaLowerY = priceScale(adrData.midPrice - sigmaValue * 2);
  renderPixelPerfectLine(ctx, 0, twoSigmaUpperY, width, twoSigmaUpperY);
  renderPixelPerfectLine(ctx, 0, twoSigmaLowerY, width, twoSigmaLowerY);

  // 1σ markers
  ctx.strokeStyle = colors.sigmaOne || '#fb923c';
  ctx.setLineDash([4, 2]);
  const oneSigmaUpperY = priceScale(adrData.midPrice + sigmaValue);
  const oneSigmaLowerY = priceScale(adrData.midPrice - sigmaValue);
  renderPixelPerfectLine(ctx, 0, oneSigmaUpperY, width, oneSigmaUpperY);
  renderPixelPerfectLine(ctx, 0, oneSigmaLowerY, width, oneSigmaLowerY);

  ctx.restore();
}
```

---

## Plus Two Config Lines

**File:** `dayRangeConfig.js`

```javascript
colors: {
  // ... existing ...
  sigmaOne: '#fb923c',
  sigmaTwo: '#f472b6'
}
```

---

## Summary

| What | Lines |
|------|-------|
| Add to `dayRangeCore.js` | ~20 |
| Add to `dayRangeConfig.js` | 2 |
| **Total** | **~22 lines** |
| **Files** | **2** |

---

## What We Skip

| Skipped | Why |
|---------|-----|
| New functions | Not needed |
| New files | Not needed |
| Separate calc module | Inline is fine |
| Labels | Visual distinction is enough |

---

## Complete Diff

**File: src/lib/dayRangeCore.js**

```diff
export function renderAdrBoundaryLines(ctx, config, width, height, priceScale, adrData, adaptiveScale) {
  const { colors } = config;

  const boundaries = calculateAdrBoundaries(adrData, adaptiveScale);
  if (!boundaries) return;

  const coordinates = calculateBoundaryCoordinates(boundaries, priceScale);
  const referenceLines = calculateReferenceLines(boundaries, priceScale, adrData.adrValue);

  renderBoundaryLines(ctx, width, coordinates, colors);
  renderBoundaryLabels(ctx, width, height, boundaries, coordinates, colors);
  renderRefLines(ctx, width, boundaries, coordinates, referenceLines, colors);

+  // Sigma markers
+  if (adrData?.midPrice && adrData?.adrValue) {
+    const sigmaValue = adrData.adrValue * 0.875;
+    ctx.save();
+    ctx.lineWidth = 1;
+
+    // 2σ
+    ctx.strokeStyle = colors.sigmaTwo || '#f472b6';
+    ctx.setLineDash([2, 4]);
+    const twoSigmaUpperY = priceScale(adrData.midPrice + sigmaValue * 2);
+    const twoSigmaLowerY = priceScale(adrData.midPrice - sigmaValue * 2);
+    renderPixelPerfectLine(ctx, 0, twoSigmaUpperY, width, twoSigmaUpperY);
+    renderPixelPerfectLine(ctx, 0, twoSigmaLowerY, width, twoSigmaLowerY);
+
+    // 1σ
+    ctx.strokeStyle = colors.sigmaOne || '#fb923c';
+    ctx.setLineDash([4, 2]);
+    const oneSigmaUpperY = priceScale(adrData.midPrice + sigmaValue);
+    const oneSigmaLowerY = priceScale(adrData.midPrice - sigmaValue);
+    renderPixelPerfectLine(ctx, 0, oneSigmaUpperY, width, oneSigmaUpperY);
+    renderPixelPerfectLine(ctx, 0, oneSigmaLowerY, width, oneSigmaLowerY);
+
+    ctx.restore();
+  }
}
```

---

## Verdict

**22 lines, 2 files.** Just another marker in the render function.
