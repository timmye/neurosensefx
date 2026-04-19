# src/lib/chart/__tests__/

Unit tests for chart modules — runs via `npm run test:unit`, no DOM or canvas required.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `xAxisCustom.test.js` | 54 tests — tick generation, boundary labels, zoom tiers, collision, setAxisWindow | Debugging x-axis behavior, adding tick tests |
| `drawingCommands.test.js` | 6 tests — undo/redo stack ops, async error recovery, maxDepth eviction, clear | Debugging undo/redo, adding command tests |
| `overlayMeta.test.js` | 6 tests — dbId/pinned CRUD, delete, clear | Debugging overlay metadata, adding meta tests |
| `styleUtils.test.js` | 6 tests — fadeColor for rgb, rgba, hex formats | Debugging color fading, adding style tests |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `helpers/` | Test harness and mock factories | Writing new chart tests, understanding test setup |
| `__mocks__/` | Module mocks for KLineChart dependencies | Debugging mock behavior, adding new mocks |
