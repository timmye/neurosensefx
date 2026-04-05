# src/stores/

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `marketDataStore.js` | Centralized market data store with subscription management and market profile integration | Adding data subscriptions, debugging data flow, working with tick/profile data |
| `chartDataStore.js` | OHLC bar management, IndexedDB caching via Dexie.js, progressive scroll loading | Adding candle subscriptions, debugging chart data flow, implementing resolution switching |
| `workspace.js` | Workspace state, display management, export/import (displays, price markers, drawings via IndexedDB) | Implementing workspace features, debugging state, export/import |
| `priceMarkerPersistence.js` | Price marker localStorage handling | Fixing marker persistence issues |
