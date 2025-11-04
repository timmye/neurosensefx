# Day Range Meter - Implementation Steps

## Core Implementation Approach

**Strategy**: Fresh implementation using existing foundations, focused on essential functionality first.

---

## Step 1: Create Fresh DayRangeMeter Core

**File**: `src/lib/viz/dayRangeMeterCore.js` (NEW)

### Core Functions to Implement:
1. `drawAdrAxis()` - Draw movable vertical ADR axis
2. `drawDailyPriceData()` - Draw O, H, L, C price markers with labels
3. `drawAdrPercentage()` - Calculate and display current ADR percentage
4. Helper functions for markers, labels, and price formatting

### Key Features:
- Configurable ADR axis position (default 65% across content)
- Price markers with color coding (Open=gray, High/Low=orange, Current=green)
- Real-time ADR percentage calculation: `((currentPrice - dailyOpen) / adrValue) * 100`
- Clean, minimal code (~100 lines total)

---

## Step 2: Create Minimal Container Component

**File**: `src/components/DayRangeDisplay.svelte` (NEW)

### Component Structure:
- Canvas setup with existing `createCanvasSizingConfig()` foundation
- Reactive rendering using existing clean foundation pattern
