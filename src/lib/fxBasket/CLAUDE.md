# src/lib/fxBasket/

FX basket calculations, state management, and rendering for currency strength display.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `fxBasketCalculations.js` | Ln-weighted basket calculations, inverse pairs, `updateBaskets` pipeline | Implementing basket formulas, adding currencies, basket recalculation |
| `fxBasketConfig.js` | Visual configuration (colors, fonts, positioning), `CURRENCIES` list | Customizing basket display appearance, currency list |
| `fxBasketConnection.js` | WebSocket connection management for basket data | Debugging basket data feeds |
| `fxBasketDebug.js` | Debug utilities for basket state inspection | Debugging basket calculations |
| `fxBasketElements.js` | Canvas element creation for basket display | Extending basket visual elements |
| `fxBasketOrchestrator.js` | Canvas rendering coordination, fixed baseline at 100wt | Rendering basket display, debugging visual issues |
| `fxBasketStateMachine.js` | Basket state machine transitions (IDLE, WAITING, READY, ERROR) | Understanding basket state flow |
| `fxBasketSubscription.js` | Basket WebSocket subscription management, re-exports `BasketState` | Subscribing to basket data, checking basket state |
| `fxBasketVolatility.js` | FX basket volatility calculations | Implementing volatility display, debugging volatility data |
| `README.md` | FX Basket architecture and design | Understanding basket system design |
