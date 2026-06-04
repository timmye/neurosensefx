# src/lib/chart/__tests__/

Unit tests for chart modules — runs via `npm run test:unit`, no DOM or canvas required.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `xAxisCustom.test.js` | 54 tests — tick generation, boundary labels, zoom tiers, collision, setAxisWindow | Debugging x-axis behavior, adding tick tests |
| `drawingCommands.test.js` | 6 tests — undo/redo stack ops, async error recovery, maxDepth eviction, clear | Debugging undo/redo, adding command tests |
| `drawingPersistence.test.js` | Drawing persistence round-trip tests (IndexedDB save/load) | Debugging drawing persistence issues |
| `drawingCoordinator.test.js` | 13 tests — reset, clear/tombstone, abort safety, toggle, restore, destroy, overlayMeta absorption | Debugging coordinator behavior, adding coordinator tests |
| `pricePrecision.test.js` | Price precision and rounding tests | Debugging price display accuracy |
| `reconcile.test.js` | 15 tests — createReconcile single-writer: full replace, new-bar append, tick merge, same-timestamp skip, rAF coalescing, unsubscribe; mapBarToKline | Debugging reconciliation logic, adding reconcile tests |
| `styleUtils.test.js` | 6 tests — fadeColor for rgb, rgba, hex formats | Debugging color fading, adding style tests |
| `barMerge.test.js` | Bar merge dedup and conditional sort tests | Debugging bar merge integrity |
| `cacheFreshness.test.js` | Cache staleness threshold tests | Debugging cache freshness logic |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `helpers/` | Test harness and mock factories (chartHarness.js, drawingStoreHarness.js) | Writing new chart tests, understanding test setup |
| `__mocks__/` | Module mocks for KLineChart dependencies | Debugging mock behavior, adding new mocks |
