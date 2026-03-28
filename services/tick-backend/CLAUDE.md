# services/tick-backend/

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `CTraderSession.js` | cTrader connection orchestration; delegates to CTraderSymbolLoader, CTraderDataProcessor, and CTraderEventHandler | Debugging connection lifecycle, modifying reconnection behavior, troubleshooting data flow issues |
| `CTraderSymbolLoader.js` | Symbol loading, mapping, and symbol info caching for cTrader | Working with symbol lookups, adding symbol-related features, debugging symbol data issues |
| `CTraderDataProcessor.js` | Data processing and calculations for cTrader (price calculation, ADR, OHLC extraction, historical bars) | Modifying data processing logic, adding calculations, fixing data transformation bugs |
| `CTraderEventHandler.js` | Event processing for cTrader spot events (trendbar and spot event handlers) | Debugging tick data processing, modifying event handling logic, fixing data extraction |
| `TradingViewSession.js` | TradingView WebSocket client orchestration; delegates to TradingViewCandleHandler | Implementing TradingView data feed, debugging candle subscriptions, modifying reconnection behavior |
| `TradingViewCandleHandler.js` | Candle processing logic for TradingView (D1/M1 handlers, ADR calculation, data package emission) | Debugging candle processing, modifying ADR logic, fixing data package emission timing |
| `TradingViewDataPackageBuilder.js` | Symbol data package construction with M1 candle filtering and bucket sizing | Debugging data package assembly, modifying candle filtering logic |
| `TradingViewSubscriptionManager.js` | TradingView D1/M1 chart session lifecycle management | Adding chart subscriptions, debugging session creation, modifying lookback parameters |
| `WebSocketServer.js` | WebSocket server orchestrator; delegates to SubscriptionManager, RequestCoordinator, and StatusBroadcaster | Understanding client communication flow, adding message handlers, modifying server initialization |
| `SubscriptionManager.js` | Client and backend subscription tracking with coalescing support | Debugging subscription state, understanding coalescing logic, modifying subscription lifecycle |
| `RequestCoordinator.js` | Symbol data request handling with fetch timeout and retry logic | Debugging data fetching, modifying retry behavior, understanding request coordination |
| `StatusBroadcaster.js` | Status message broadcasting to subscribed clients | Understanding status propagation, modifying broadcast logic, debugging client notifications |
| `DataRouter.js` | Data routing from cTrader/TradingView sessions to WebSocket clients using MessageBuilder | Understanding data flow, modifying routing logic, debugging message delivery |
| `HealthMonitor.js` | Centralized staleness detection service; tracks lastTick timestamp, emits stale/tick_resumed events | Understanding health monitoring logic, debugging staleness detection, modifying timeout thresholds |
| `MarketProfileService.js` | Market Profile calculation with bucket size determination and level aggregation | Understanding Market Profile logic, modifying bucket calculations, debugging profile generation |
| `TwapService.js` | TWAP calculation with historical initialization and bar-based updates from cTrader/TradingView | Implementing TWAP features, debugging time-weighted averages, modifying bar aggregation |
| `server.js` | WebSocket server entry point | Starting backend, debugging server startup |
| `stream-real.cjs` | Real-time streaming data test utility | Testing live data streaming |
| `test-timeframe.js` | Timeframe calculation test utility | Debugging timeframe logic |
| `Dockerfile` | Production container build definition | Building backend container |
| `Dockerfile.dev` | Development container build definition | Building backend dev container |
| `.backend.pid` | Process ID file for service management (runtime-generated) | Checking if backend is running |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `utils/` | Shared utility modules (ReconnectionManager, MessageBuilder) | Understanding reconnection logic, using message building utilities, adding shared utilities |
| `specs/` | cTrader API specifications and OpenAPI definitions | Understanding cTrader integration |
| `docs/` | Backend design documentation | Understanding backend architecture |
| `UI/` | Backend UI components | Modifying backend interface |
