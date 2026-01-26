# src/lib/

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `visualizers.js` | Visualizer registry and initialization | Registering new visualization types |
| `connectionManager.js` | WebSocket connection lifecycle management | Debugging connection issues, implementing reconnection |
| `websocket.js` | WebSocket client implementation | Debugging data streaming, implementing WebSocket features |
| `symbolData.js` | Symbol data cache and management | Working with symbol-specific data |
| `connectionSetup.js` | Connection initialization logic | Setting up new connections |

## Day Range Rendering

| File | What | When to read |
| ---- | ---- | ------------ |
| `dayRange.js` | Day Range visualization orchestrator | Implementing Day Range features |
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
| `marketProfileProcessor.js` | Market Profile data processing | Implementing Market Profile calculations |
| `marketProfileRenderer.js` | Market Profile visualization rendering | Debugging Market Profile display |
| `marketProfileConfig.js` | Market Profile configuration constants | Modifying Market Profile parameters |

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
| `interactionSetup.js` | interact.js configuration | Debugging drag/resize behavior |
| `visualizationRegistry.js` | Visualization type registration | Adding new visualization types |
| `adrBoundaryRenderer.js` | ADR boundary line rendering | Customizing ADR display |
| `adrBoundaryCalculations.js` | ADR value calculation logic | Fixing ADR formulas |
