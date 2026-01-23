# src/lib/marketProfile/

Market Profile visualization with orchestrator pattern.

## Files

| File                 | What                                       | When to read                                       |
| -------------------- | ------------------------------------------ | -------------------------------------------------- |
| `orchestrator.js`    | Market Profile render coordination         | Understanding full render pipeline                |
| `scaling.js`         | Price-to-Y coordinate mapping, dimensions  | Fixing alignment issues with Day Range Meter      |
| `rendering.js`       | Canvas drawing (bars, value area, POC)     | Customizing Market Profile appearance              |
| `calculations.js`    | POC, value area, intensity computations    | Adding calculation types, tuning algorithms        |
| `pointOfControl.js`  | Legacy POC function (deprecated)           | Migration reference only                           |
| `valueArea.js`       | Legacy value area function (deprecated)    | Migration reference only                           |

## README.md

Orchestrator pattern rationale, scaling parity decisions, and rendering pipeline.
