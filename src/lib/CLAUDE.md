# src/lib/

Utility modules, visualizers, and domain-specific libraries for the frontend application.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `visualizers.js` | Day range and combined visualization renderers | Registering new visualization types |
| `connectionManager.js` | WebSocket connection lifecycle singleton facade (delegates to `connection/` modules) | Debugging connection issues, implementing reconnection |
| `dataContracts.js` | WebSocket message type definitions and runtime validation | Understanding data shapes, adding new message types, debugging contract violations |
| `displayDataProcessor.js` | Transforms raw WebSocket messages into reactive state objects (extracts prevDayOHLC) | Processing incoming display data, debugging prevDay fields |
| `displayCanvasRenderer.js` | Canvas 2D rendering with DPR awareness, memoized price scale | Fixing rendering issues, text crispness, per-tick redraw |
| `canvasStatusRenderer.js` | Connection status indicator | Modifying status display |
| `percentageMarkerRenderer.js` | Percentage marker drawing | Customizing percentage display |
| `interactSetup.js` | interact.js configuration factory for FloatingDisplay | Customizing drag/resize/snap behavior |
| `keyManager.js` | Centralized keyboard event handling with priority resolution and escape stack | Adding keyboard shortcuts, fixing key handling bugs |
| `priceFormat.js` | Price formatting utilities | Formatting display values |
| `colors.js` | Color constants and utilities | Changing color schemes |
| `workspaceKeyboardShortcuts.js` | Keyboard shortcut definitions extracted from Workspace.svelte | Adding/modifying global keyboard shortcuts |
| `README.md` | Lib module architecture, data flow, and design decisions | Understanding lib module architecture, data flow patterns |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `chart/` | KLineChart integration: configuration, calendar x-axis, drawing persistence, undo/redo, overlays, themes | Adding chart features, modifying drawing tools, changing resolutions, x-axis behavior |
| `connection/` | WebSocket connection management (handler, subscription, reconnection) | Debugging connection issues, implementing reconnection |
| `fxBasket/` | FX Basket calculations, state machine, rendering, subscriptions | Understanding basket system design, testing compute/layout logic |
| `marketProfile/` | Market Profile visualization with orchestrator pattern | Understanding Market Profile rendering pipeline |
| `priceMarkers/` | Price marker compute/render split — base model, compute, coordinates, dropdown, interaction, renderer | Adding marker types, debugging marker positioning |
| `dayRange/` | Day Range ADR boundary visualization — orchestrator pattern with compute/render split | Understanding day range pipeline, modifying ADR calculations |
| `__tests__/` | Unit tests for top-level lib modules (data contracts, day range compute, price format) | Running lib tests, adding test coverage |
