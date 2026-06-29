# src/stores/

Svelte state management stores for frontend application.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `marketDataStore.js` | Centralized market data store with subscription management and market profile integration | Adding data subscriptions, debugging data flow, working with tick/profile data |
| `chartDataStore.js` | OHLC bar management, IndexedDB caching via Dexie.js, progressive scroll loading | Adding candle subscriptions, debugging chart data flow, implementing resolution switching |
| `displayStore.js` | Display state (displays Map, z-index, selection, chart ghost) and display lifecycle actions (add, remove, move, resize, bring-to-front, chart-specific) | Adding new display types, debugging display CRUD, display selection/navigation |
| `markerActions.js` | Price marker CRUD actions (add, remove, update, select) that operate on displayStore, plus marker persistence (localStorage + server sync). Absorbs former `priceMarkerPersistence.js` | Adding marker features, debugging marker persistence, marker import/export |
| `workspace.js` | Workspace persistence (localStorage + server), import/export, headlines widget state (visibility, position, size). Exports combined derived store for backward compat | Implementing workspace persistence, import/export, headlines widget |
| `authStore.js` | Svelte store for authentication state (login, logout, session) | Modifying login/logout UI, checking auth status |
| `themeStore.js` | Svelte store for light/dark theme preference | Changing theme, persisting theme choice |
| `timezoneStore.js` | Svelte store for timezone preference (user → browser local → UTC fallback) | Changing timezone display, debugging timezone labels |
| `dailyResetHandler.js` | Daily reset logic (OHLC bars, market profile, subscriptions) | Modifying daily reset behavior, debugging midnight transitions |
| `marketDataNormalizer.js` | Normalizes raw tick data into structured market data format | Adding new data fields, debugging data normalization |
| `marketProfileMerger.js` | Market profile merge computation (`mergeProfileUpdate`) invoked on daily resets | Modifying market profile merging, debugging profile generation |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `__tests__/` | Unit tests for decomposed store handlers (`dailyResetHandler`, `marketDataNormalizer`, `marketProfileMerger`) | Running store tests, adding test coverage |
