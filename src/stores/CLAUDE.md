# src/stores/

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `marketDataStore.js` | Centralized market data store with subscription management and market profile integration | Adding data subscriptions, debugging data flow, working with tick/profile data |
| `chartDataStore.js` | OHLC bar management, IndexedDB caching via Dexie.js, progressive scroll loading, quarterly aggregation | Adding candle subscriptions, debugging chart data flow, implementing resolution switching |
| `workspace.js` | Workspace state persistence and management | Implementing workspace features, debugging state |
| `priceMarkerPersistence.js` | Price marker localStorage handling | Fixing marker persistence issues |
