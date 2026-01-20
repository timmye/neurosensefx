# services/tick-backend/

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `CTraderSession.js` | cTrader connection with health monitoring, staleness detection, unlimited auto-reconnect, and manual reinit support | Debugging connection lifecycle, modifying reconnection behavior, troubleshooting data flow issues |
| `TradingViewSession.js` | TradingView WebSocket client with health monitoring, staleness detection, unlimited auto-reconnect, and manual reinit support; D1+M1 candle subscriptions for ADR and Market Profile TPO | Implementing TradingView data feed, debugging candle subscriptions, modifying reconnection behavior, troubleshooting series completion timing |
| `WebSocketServer.js` | WebSocket server with reinit message handling for selective data source reinitialization | Adding message handlers, modifying client communication, understanding connection state management |
| `HealthMonitor.js` | Centralized staleness detection service; tracks lastTick timestamp, emits stale/tick_resumed events, prevents half-open socket detection failures | Understanding health monitoring logic, debugging staleness detection, modifying timeout thresholds |
| `server.js` | WebSocket server entry point | Starting backend, debugging server startup |
| `.backend.pid` | Process ID file for service management | Checking if backend is running |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `specs/` | cTrader API specifications and OpenAPI definitions | Understanding cTrader integration |
| `docs/` | Backend design documentation | Understanding backend architecture |
| `UI/` | Backend UI components | Modifying backend interface |
