# services/tick-backend/

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `TradingViewSession.js` | TradingView WebSocket API client with D1+M1 candle subscriptions; D1 series for ADR, M1 series for Market Profile TPO; emits symbolDataPackage with initialMarketProfile array when both series complete | Implementing TradingView data feed, debugging candle subscriptions, modifying Market Profile data, troubleshooting series completion timing |
| `server.js` | WebSocket server entry point | Starting backend, debugging server startup |
| `.backend.pid` | Process ID file for service management | Checking if backend is running |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `specs/` | cTrader API specifications and OpenAPI definitions | Understanding cTrader integration |
| `docs/` | Backend design documentation | Understanding backend architecture |
| `UI/` | Backend UI components | Modifying backend interface |
