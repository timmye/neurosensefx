# src/lib/

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `visualizers.js` | Day range and combined visualization renderers | Registering new visualization types |
| `connectionManager.js` | WebSocket connection lifecycle management | Debugging connection issues, implementing reconnection |
| `symbolData.js` | Symbol data cache and management | Working with symbol-specific data |
| `dataContracts.js` | WebSocket message type definitions and runtime validation | Understanding data shapes, adding new message types, debugging contract violations |

## Day Range Rendering

| File | What | When to read |
| ---- | ---- | ------------ |
| `dayRangeElements.js` | Canvas element creation and management | Extending day range visual elements |
| `dayRangeRenderingUtils.js` | Rendering utility functions | Adding rendering helpers |
| `dayRangeOrchestrator.js` | Day Range update coordination | Understanding render cycle |
| `dayRangeMarkers.js` | Price marker rendering for day range | Debugging marker display |

## Day Range Calculations

| File | What | When to read |
| ---- | ---- | ------------ |
| `dayRangeCore.js` | Day Range core calculations | Modifying day range logic |
| `dayRangeCalculations.js` | ADR boundary, price level calculations | Adding calculation types, fixing formula errors |
| `dayRangeConfig.js` | Day Range configuration constants | Modifying display parameters |

## Market Profile Visualization

| File | What | When to read |
| ---- | ---- | ------------ |
| `marketProfile/` | Market Profile module (orchestrator, scaling, rendering, calculations) | See `marketProfile/CLAUDE.md` |
| `fxBasket/` | FX Basket module (calculations, state machine, rendering, subscriptions) | See `fxBasket/CLAUDE.md` |
| `connection/` | WebSocket connection management (handler, subscription, reconnection) | See `connection/CLAUDE.md` |
| `websocket/` | WebSocket utilities (message coordinator) | Coordinating multi-message dependencies |

## Price Markers

| File | What | When to read |
| ---- | ---- | ------------ |
| `priceMarkerBase.js` | Price marker data model and state | Understanding marker state management |
| `priceMarkerCoordinates.js` | Price to canvas coordinate conversion | Fixing positioning issues |
| `priceMarkerRenderer.js` | Price marker drawing logic | Customizing marker appearance, adding historical price markers |
| `priceMarkerInteraction.js` | Marker drag, drop, click handlers | Implementing marker interactions |
| `priceMarkerDropdown.js` | Marker configuration UI | Adding marker options |
| `priceScale.js` | Price axis scaling calculations | Fixing scale issues |
| `priceFormat.js` | Price formatting utilities | Formatting display values |
| `priceMarkers.js` | Price marker collection management | Working with multiple markers |
| `percentageMarkers.js` | Percentage-based marker utilities | Implementing percentage markers |
| `percentageMarkerRenderer.js` | Percentage marker drawing | Customizing percentage display |

## Display & Rendering

| File | What | When to read |
| ---- | ---- | ------------ |
| `displayCanvasRenderer.js` | Canvas 2D rendering with DPR awareness | Fixing rendering issues, text crispness |
| `displayDataProcessor.js` | Display data transformation and validation | Processing incoming data |
| `canvasStatusRenderer.js` | Connection status indicator | Modifying status display |

## Utilities

| File | What | When to read |
| ---- | ---- | ------------ |
| `colors.js` | Color constants and utilities | Changing color schemes |
| `keyboardHandler.js` | Keyboard event handling | Adding keyboard shortcuts |
| `interactSetup.js` | interact.js configuration factory for FloatingDisplay | Customizing drag/resize/snap behavior |
| `adrBoundaryRenderer.js` | ADR boundary line rendering | Customizing ADR display |
| `adrBoundaryCalculations.js` | ADR value calculation logic | Fixing ADR formulas |
