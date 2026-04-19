# src/stores/

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `marketDataStore.js` | Centralized market data store with subscription management and market profile integration | Adding data subscriptions, debugging data flow, working with tick/profile data |
| `chartDataStore.js` | OHLC bar management, IndexedDB caching via Dexie.js, progressive scroll loading | Adding candle subscriptions, debugging chart data flow, implementing resolution switching |
| `workspace.js` | Workspace state, display management, export/import, headlines widget persistence (visibility, position, size) | Implementing workspace features, debugging state, headlines persistence |
| `priceMarkerPersistence.js` | Price marker localStorage handling | Fixing marker persistence issues |
| `authStore.js` | Svelte store for authentication state (login, logout, session) | Modifying login/logout UI, checking auth status |
| `themeStore.js` | Svelte store for light/dark theme preference | Changing theme, persisting theme choice |
| `timezoneStore.js` | Svelte store for timezone preference (user → browser local → UTC fallback) | Changing timezone display, debugging timezone labels |
| `volatilityStore.js` | Svelte store for volatility data and state | Accessing volatility data, debugging volatility display |
