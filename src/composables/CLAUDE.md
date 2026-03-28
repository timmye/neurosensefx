# src/composables/

## Deprecated

All composables have been replaced by `src/stores/marketDataStore.js` which provides centralized data management. The composables directory is now empty.

| Former Composable | Replacement |
| ----------------- | ----------- |
| `useWebSocketSub.js` | `subscribeToSymbol()` in marketDataStore |
| `useDisplayState.js` | `getConnectionStatus()` in marketDataStore |
| `useDataCallback.js` | `handleStoreUpdate()` in marketDataStore |
| `useSymbolData.js` | `normalizeData()` in marketDataStore |
| `useDisplayHandlers.js` | Inline handlers in components |
