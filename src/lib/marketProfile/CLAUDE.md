# src/lib/marketProfile/

Market Profile visualization with orchestrator pattern.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `orchestrator.js` | Market Profile compute/render split — `computeMarketProfile()` + `computeMiniMarketProfile()` + render functions | Understanding full render pipeline, testing compute logic |
| `scaling.js` | Price-to-Y coordinate mapping, dimensions | Fixing alignment issues with Day Range Meter |
| `rendering.js` | Canvas drawing (bars, value area, POC) | Customizing Market Profile appearance |
| `calculations.js` | POC, value area, intensity computations | Adding calculation types, tuning algorithms |
| `README.md` | Market Profile architecture overview | Understanding Market Profile rendering pipeline |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `__tests__/` | Unit tests for Market Profile compute logic (`computeMarketProfile.test.js`) | Running profile tests, adding test coverage |
