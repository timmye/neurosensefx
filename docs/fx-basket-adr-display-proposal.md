# FX Basket ADR Display Proposal

## Executive Summary

**Proposal:** Add zone-based color coding to FX basket markers for instant volatility awareness.

**Status:** ✅ **IMPLEMENTED** (2026-01-19)

**Implementation:** 34 lines across 2 files

**Value:** Traders get instant visual indication of basket volatility level (Gray → Yellow → Orange → Red)

---

## 1. Solution: Zone-Based Color Coding

### 1.1 Display Format

**Before:**
```
USD marker: Green (positive) or Red (negative) bar
```

**After:**
```
USD marker: Color based on daily range zone
  - Gray   (< threshold) → QUIET
  - Yellow (< 2× typical) → NORMAL
  - Orange (< 3× typical) → ACTIVE
  - Red    (≥ 3× typical) → EXTREME
```

**No text added** - pure visual indicator using existing marker bar.

### 1.2 Zone Classification

| Zone | Color | Hex | Meaning |
|------|-------|-----|---------|
| **QUIET** | Gray | `#6B7280` | Below normal |
| **NORMAL** | Yellow | `#F59E0B` | Typical day |
| **ACTIVE** | Orange | `#F97316` | Elevated volatility |
| **EXTREME** | Red | `#EF4444` | Unusually high |

### 1.3 Zone Thresholds Per Basket

| Basket | QUIET | NORMAL | ACTIVE | EXTREME |
|--------|-------|--------|--------|---------|
| USD | < 0.07% | < 0.25% | < 0.40% | ≥ 0.40% |
| EUR | < 0.05% | < 0.18% | < 0.22% | ≥ 0.22% |
| JPY | < 0.12% | < 0.40% | < 0.60% | ≥ 0.60% |
| GBP | < 0.07% | < 0.25% | < 0.45% | ≥ 0.45% |
| AUD | < 0.11% | < 0.35% | < 0.50% | ≥ 0.50% |
| CAD | < 0.05% | < 0.25% | < 0.35% | ≥ 0.35% |
| CHF | < 0.07% | < 0.30% | < 0.42% | ≥ 0.42% |
| NZD | < 0.08% | < 0.30% | < 0.48% | ≥ 0.48% |

**Source:** 65-day empirical analysis

---

## 2. Implementation

### 2.1 Files Modified

| File | Lines Added | Total Lines |
|------|-------------|-------------|
| `fxBasketConfig.js` | +20 | 80 |
| `fxBasketElements.js` | +14 | 166 |
| **TOTAL** | **+34** | - |

### 2.2 Code Changes

**fxBasketConfig.js:**
```javascript
// Zone colors
export const ZONE_COLORS = {
  QUIET: '#6B7280',    // Gray
  NORMAL: '#F59E0B',   // Yellow
  ACTIVE: '#F97316',   // Orange
  EXTREME: '#EF4444'   // Red
};

// Zone thresholds per basket
export const BASKET_ZONES = {
  'USD': { quiet: 0.07, normal: 0.25, active: 0.40 },
  'EUR': { quiet: 0.05, normal: 0.18, active: 0.22 },
  // ... JPY, GBP, AUD, CAD, CHF, NZD
};
```

**fxBasketElements.js:**
```javascript
export function renderBasketMarker(ctx, basket, y, width, config) {
  const range = Math.abs(basket.changePercent || 0);
  const zoneColor = getZoneColor(basket.currency, range);

  ctx.save();
  ctx.fillStyle = zoneColor;
  ctx.fillRect(barX, y - markerWidth / 2, barWidth, markerWidth);
  ctx.restore();
}

function getZoneColor(currency, range) {
  const zones = BASKET_ZONES[currency];
  if (!zones) return ZONE_COLORS.NORMAL;

  if (range < zones.quiet) return ZONE_COLORS.QUIET;
  if (range < zones.normal) return ZONE_COLORS.NORMAL;
  if (range < zones.active) return ZONE_COLORS.ACTIVE;
  return ZONE_COLORS.EXTREME;
}
```

---

## 3. Trader Use Cases

| Zone | Trading Implications |
|------|---------------------|
| **QUIET (Gray)** | • Fade extreme moves<br>• Tighter stops<br>• Standard position size |
| **NORMAL (Yellow)** | • Business as usual<br>• Standard stops<br>• Standard position size |
| **ACTIVE (Orange)** | • Wider stops (+20%)<br>• Be selective<br>• Watch for reversals |
| **EXTREME (Red)** | • Reduce size (-30%)<br>• Wider stops (+50%)<br>• Fade moves, don't chase |

---

## 4. References

**Data Source:** `/docs/fx-basket-historical-results.md`

**Implementation Files:**
- `src/lib/fxBasket/fxBasketConfig.js`
- `src/lib/fxBasket/fxBasketElements.js`

---

**Version:** 2.0 (Implemented) | **Date:** 2026-01-19 | **Status:** ✅ Complete
