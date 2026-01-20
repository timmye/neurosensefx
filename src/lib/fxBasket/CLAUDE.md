# src/lib/fxBasket/

FX basket calculations, state management, and rendering for currency strength display.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `basketAdrCalculations.js` | ADR boundary calculations for basket zones | Computing ADR levels, zone coloring |
| `fxBasketCalculations.js` | Ln-weighted basket calculations, inverse pairs | Implementing basket formulas, adding currencies |
| `fxBasketConfig.js` | Visual configuration (colors, fonts, positioning) | Customizing basket display appearance |
| `fxBasketConnection.js` | WebSocket connection management for basket data | Debugging basket data feeds |
| `fxBasketDebug.js` | Debug utilities for basket state inspection | Debugging basket calculations |
| `fxBasketElements.js` | Canvas element creation for basket display | Extending basket visual elements |
| `fxBasketManager.js` | Basket state manager | Managing basket lifecycle |
| `fxBasketOrchestrator.js` | Canvas rendering coordination, fixed baseline at 100wt | Rendering basket display, debugging visual issues |
| `fxBasketProcessor.js` | Data processing for basket updates | Processing incoming price data |
| `fxBasketStateMachine.js` | Basket state machine transitions | Understanding basket state flow |
| `fxBasketStore.js` | Svelte store for basket state | Integrating basket with components |
| `fxBasketSubscription.js` | Symbol subscription management | Adding basket symbols to subscriptions |
| `fxBasketValidation.js` | Basket data validation utilities | Validating basket calculations |
| `README.md` | FX Basket architecture and design | Understanding basket system design |

## Test Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `test-basket-adr.js` | ADR calculation unit tests | Testing basket ADR functionality |
| `test-fxBasket.js` | Basket calculation unit tests | Verifying basket calculations |
