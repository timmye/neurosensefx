# Market Profile Module

## Overview

The Market Profile module implements an orchestrator pattern for rendering Market Profile visualizations with specialized modules for scaling, rendering, and calculations while maintaining backward compatibility.

## Architecture

```
orchestrator.js (Facade)
    ├── scaling.js (Y-coordinate calculations)
    ├── rendering.js (Canvas drawing operations)
    └── calculations.js (POC, value area, intensity)
```

**Rendering Pipeline:**
```
renderMarketProfile(ctx, data, config)
    ↓
validateMarketData() → calculateAdaptiveScale()
    ↓
computePOC() → calculateValueArea()
    ↓
drawValueArea() → drawBars() → drawPOC()
```

## Design Decisions

### Why Orchestrator Pattern?

renderMarketProfile mixes data validation, scaling calculations, POC/value area computation, and Canvas rendering. The orchestrator:
- Delegates to specialized modules (<50 lines each)
- Maintains backward compatibility with existing signature
- Enables independent testing of calculations and rendering

### Why Shared Scaling with Day Range Meter?

`scaling.js` imports from `dayRangeCalculations.js` to ensure Market Profile overlay aligns perfectly with Day Range Meter. Without sharing, overlays drift apart due to rounding differences. This provides:
- Single source of truth for price scaling
- Consistent Y-coordinates across visualizations
- Guaranteed parity between overlays

### Why Separate POC/Value Area Files?

`pointOfControl.js` and `valueArea.js` are legacy duplicates maintained for backward compatibility during migration. Use `calculations.js` for new code.

### Canvas Rendering Strategy

Market Profile renders on hot path, so:
- Batch draw calls reduce Canvas context switches
- Direct `path()` used instead of Path2D objects for simpler state management
- POC drawn last to overlay bars (visual hierarchy)
- Single `stroke()` call after all paths defined for performance

### Scaling Thresholds for Y-Coordinates

Y-coordinate granularity affects text readability:
- 10px minimum spacing prevents label overlap
- Adaptive scale normalizes price range to canvas height
- Line height = 1.2x font size for legible typography

### Intensity Calculation Normalization

Intensity visualizes volume distribution per price level:
- Raw volume varies widely (100 to 100,000+)
- Normalization required for consistent visualization
- `intensity = volumeAtLevel / maxVolume * 100` produces percentage (0-100)
- Enables consistent opacity/color mapping regardless of symbol

## Invariants

1. **Y-Coordinate Parity**: Market Profile overlay Y-coordinates must match Day Range Meter Y-coordinates for the same price. Both use `adaptiveScale` from the same scaling module.
2. **POC is Single Price Level**: The price with highest TPO (Time Price Opportunity) count.
3. **Value Area = 70% TPO**: Expands from POC until 70% of volume is covered.
4. **Canvas Context Integrity**: Market Profile renderer must not modify Canvas global state (transforms, clip regions) without restoring. Day Range renderer shares the same canvas.
5. **No External Dependencies**: Pure functions, Framework-First (Canvas 2D API only).

## Calculation Details

### Point of Control (POC)

The price level with highest TPO count represents fair value where most trading occurred.

### Value Area Algorithm

1. Start at POC (highest TPO level)
2. Expand upward/downward greedily (pick higher TPO neighbor)
3. Stop when cumulative TPO >= 70% of total TPO

Result: Price range containing 70% of trading activity.

### Intensity Levels

| TPO Ratio | Level  | Color              |
| --------- | ------ | ------------------ |
| 0-60%     | low    | #374151 (dark gray)|
| 60-80%    | medium | #404694ff (blue)   |
| 80-100%   | high   | #7b5dc0 (purple)   |
