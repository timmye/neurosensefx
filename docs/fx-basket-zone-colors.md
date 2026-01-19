# FX Basket Zone Colors - Quick Reference

## What Changed

Basket markers now show **volatility zone** via color instead of positive/negative.

**Colors:** Gray → Yellow → Orange → Red (increasing volatility)

---

## Zone Colors

| Zone | Color | Hex | Daily Range |
|------|-------|-----|------------|
| QUIET | Gray | `#6B7280` | Below normal |
| NORMAL | Yellow | `#F59E0B` | Typical day |
| ACTIVE | Orange | `#F97316` | Elevated volatility |
| EXTREME | Red | `#EF4444` | Unusually high |

---

## Thresholds by Basket

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

---

## Trading Guide

| Zone | Action |
|------|--------|
| **Gray** | Standard trading |
| **Yellow** | Standard trading |
| **Orange** | Widen stops, reduce size |
| **Red** | Reduce size significantly, wider stops |

---

## Implementation

**Files:** `fxBasketConfig.js` (+20 lines), `fxBasketElements.js` (+14 lines)

**Total:** 34 lines

**Status:** ✅ Complete (2026-01-19)
