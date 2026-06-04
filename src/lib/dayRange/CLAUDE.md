# src/lib/dayRange/

Day Range ADR boundary visualization — compute/render split with orchestrator pattern.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `dayRangeOrchestrator.js` | Day Range orchestrator: `computeDayRange()` + `renderDayRange()` | Understanding render cycle, testing compute logic |
| `dayRangeCore.js` | Core day range calculation logic | Modifying day range formulas |
| `dayRangeCalculations.js` | ADR boundary and price level calculations | Adding calculation types, fixing formula errors |
| `dayRangeConfig.js` | Day Range configuration constants | Modifying display parameters |
| `dayRangeElements.js` | Canvas element creation and management | Extending day range visual elements |
| `dayRangeRenderingUtils.js` | Rendering utility functions | Adding rendering helpers |
| `adrBoundaryCalculations.js` | ADR value calculation logic | Fixing ADR formulas |
| `adrBoundaryRenderer.js` | ADR boundary line rendering | Customizing ADR display |
