# Composables Module

## Deprecated

All composables were replaced by the centralized data store (`src/stores/marketDataStore.js`) as part of the centralized data function implementation.

Components now import directly from the store:
- `getMarketDataStore(symbol)` — per-symbol reactive store
- `subscribeToSymbol(symbol, source, options)` — subscription with reference counting
- `getConnectionStatus()` — reactive connection status store
- `subscribeBasket(pairs, callback)` — FX basket data aggregation
