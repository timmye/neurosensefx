Looking at `src/lib/viz/dayRangeMeter.js`, I see the complexity nightmare:

1. __Over-engineered Configuration__: 20+ config parameters with nested conditionals
2. __Complex Draw Logic__: `drawMarkerAndLabel` function has 8+ conditional branches
3. __Mixed Responsibilities__: ADR axis, price markers, proximity pulses all in one giant function
4. __Legacy Complications__: `hexToRgba`, complex label positioning, multiple display modes
5. __Bounds Checking__: Manual bounds logic with magic numbers (-50, +50)

## Fresh Minimal Approach

You're absolutely right - we need a __radical simplification__. Here's what I propose:

### __Core Function - Just 3 Things__

```javascript
// NEW: src/lib/viz/dayRangeMeterSimple.js
export function drawDayRangeMeterSimple(ctx, canvas, config, state, y) {
  // 1. Draw vertical line at movable position
  drawVerticalLine(ctx, canvas, config.adrAxisX || 0.65);
  
  // 2. Draw price markers (O, H, L, C)
  drawPriceMarkers(ctx, canvas, config, state, y);
  
  // 3. Draw ADR percentage
  drawAdrPercentage(ctx, canvas, state);
}
```

### __Key Simplifications__

- __No Complex Config__: Just `adrAxisX` (position 0-1)
- __No Legacy Functions__: Direct canvas operations
- __100% Canvas Usage__: Use full canvas dimensions directly
- __Simple Math__: Basic linear scaling only
- __Clean Functions__: Single responsibility per function

### __What This Fixes__

- __Rendering Issues__: Direct canvas ops, no complex coordinate transforms
- __Bounds Problems__: Use canvas dimensions, not calculated contentArea
- __ADR Movement__: Simple percentage-based positioning
- __Performance__: Minimal operations, no complex conditionals

## Implementation Plan

### __Step 1__: Create Simple Core (50 lines)

- `drawVerticalLine()` - just draws line at position
- `drawPriceMarkers()` - basic O,H,L,C with simple labels
- `drawAdrPercentage()` - calculate and display ADR%

### __Step 2__: Simple Integration

- Replace complex `drawDayRangeMeter()` with `drawDayRangeMeterSimple()`
- Remove all complex config dependencies
- Use canvas dimensions directly

### __Step 3__: Test & Validate

- Verify ADR axis moves correctly
- Test price positioning
- Confirm 100% canvas usage