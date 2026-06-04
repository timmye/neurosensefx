# src/lib/

Utility modules, visualizers, and domain-specific libraries for the frontend application.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `workspaceKeyboardShortcuts.js` | Keyboard shortcut definitions extracted from Workspace.svelte | Adding/modifying global keyboard shortcuts |
| `visualizers.js` | Day range and combined visualization renderers | Registering new visualization types |
| `connectionManager.js` | WebSocket connection lifecycle management | Debugging connection issues, implementing reconnection |
| `dataContracts.js` | WebSocket message type definitions and runtime validation | Understanding data shapes, adding new message types, debugging contract violations |
| `README.md` | Lib module architecture overview | Understanding lib module architecture, data flow patterns |
| `adrBoundaryCalculations.js` | ADR value calculation logic | Fixing ADR formulas |
| `adrBoundaryRenderer.js` | ADR boundary line rendering | Customizing ADR display |
| `canvasStatusRenderer.js` | Connection status indicator | Modifying status display |
| `colors.js` | Color constants and utilities | Changing color schemes |
| `dayRangeCalculations.js` | ADR boundary, price level calculations | Adding calculation types, fixing formula errors |
| `dayRangeConfig.js` | Day Range configuration constants | Modifying display parameters |
| `dayRangeCore.js` | Day Range core calculations | Modifying day range logic |
| `dayRangeElements.js` | Canvas element creation and management | Extending day range visual elements |
| `dayRangeOrchestrator.js` | Day Range compute/render split — `computeDayRange()` + `renderDayRange()` | Understanding render cycle, testing compute logic |
| `dayRangeRenderingUtils.js` | Rendering utility functions | Adding rendering helpers |
| `displayCanvasRenderer.js` | Canvas 2D rendering with DPR awareness | Fixing rendering issues, text crispness |
| `displayDataProcessor.js` | Display data transformation and validation | Processing incoming data |
| `interactSetup.js` | interact.js configuration factory for FloatingDisplay | Customizing drag/resize/snap behavior |
| `keyManager.js` | Centralized keyboard event handling with priority resolution and escape stack | Adding keyboard shortcuts, fixing key handling bugs |
| `percentageMarkerRenderer.js` | Percentage marker drawing | Customizing percentage display |
| `priceFormat.js` | Price formatting utilities | Formatting display values |
| `priceMarkerBase.js` | Price marker data model and state | Understanding marker state management |
| `priceMarkerCoordinates.js` | Price to canvas coordinate conversion | Fixing positioning issues |
| `priceMarkerDropdown.js` | Marker configuration UI | Adding marker options |
| `priceMarkerInteraction.js` | Marker drag, drop, click handlers | Implementing marker interactions |
| `priceMarkerRenderer.js` | Price marker drawing logic | Customizing marker appearance, adding historical price markers |
| `priceMarkers.js` | Price marker collection management | Working with multiple markers |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `chart/` | KLineChart integration: configuration, calendar x-axis, drawing persistence, undo/redo, overlays, themes | Adding chart features, modifying drawing tools, changing resolutions, x-axis behavior |
| `connection/` | WebSocket connection management (handler, subscription, reconnection) | Debugging connection issues, implementing reconnection |
| `fxBasket/` | FX Basket calculations, state machine, rendering, subscriptions | Understanding basket system design, testing compute/layout logic |
| `marketProfile/` | Market Profile visualization with orchestrator pattern | Understanding Market Profile rendering pipeline |
| `priceMarkers/` | Price marker compute/render split — base model, coordinates, dropdown, interaction, renderer | Adding marker types, debugging marker positioning |
| `dayRange/` | Day Range ADR boundary visualization — orchestrator pattern with compute/render split | Understanding day range pipeline, modifying ADR calculations |
