# src/lib/priceMarkers/

Price marker system — compute/render split with base model, coordinates, dropdown, interaction, and renderer.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `priceMarkers.js` | Price marker collection management | Working with multiple markers |
| `priceMarkerBase.js` | Price marker data model and state | Understanding marker state management |
| `priceMarkerCompute.js` | Pure computation: price-to-data transforms, marker value calculations | Testing marker computation, adding marker types |
| `priceMarkerCoordinates.js` | Price to canvas coordinate conversion | Fixing positioning issues |
| `priceMarkerDropdown.js` | Marker configuration UI | Adding marker options |
| `priceMarkerInteraction.js` | Marker drag, drop, click handlers | Implementing marker interactions |
| `priceMarkerRenderer.js` | Price marker drawing logic | Customizing marker appearance, adding historical price markers |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `__tests__/` | Unit tests for price marker modules | Running marker tests, adding test coverage |
