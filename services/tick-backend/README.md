# NeuroSense FX Backend - Tick Streaming Service

Real-time forex tick streaming from cTrader Open API and TradingView WebSocket with Node.js.

## Architecture Overview

The backend follows **Crystal Clarity principles** with modular, focused components:

```
┌─────────────────────────────────────────────────────────────┐
│                     WebSocketServer                         │
│  (206 lines - orchestrator, delegates to sub-managers)        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────┐  │
│  │SubscriptionMgr  │  │RequestCoord    │  │StatusBroadcast│  │
│  │  (137 lines)   │  │  (145 lines)   │  │  (132 lines) │  │
│  └────────────────┘  └────────────────┘  └─────────────┘  │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │CTraderSession│  │TradingViewSes│  │MarketProfile │    │
│  │  (214 lines) │  │  (236 lines) │  │Service       │    │
│  │              │  │              │  │  (126 lines) │    │
│  │ Uses:        │  │ Uses:        │  │              │    │
│  │-Reconnection │  │-Reconnection │  │              │    │
│  │-SymbolLoader │  │-CandleHandler │  │              │    │
│  │-DataProcessor│  │              │  │              │    │
│  │-EventHandler │  │              │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐                   │
│  │ReconnectionMgr │  │MessageBuilder  │                   │
│  │  (utils/53)    │  │  (utils/78)    │                   │
│  └────────────────┘  └────────────────┘                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Module Structure

### CTraderSession Module

**Responsibility**: cTrader connection lifecycle and event orchestration

```javascript
CTraderSession.js
├── connect()              // Initialize connection and delegates
├── setupEventListeners()  // Route events to processors
├── authenticate()         // cTrader authentication
├── handleDisconnect()     // Connection failure handling
└── reconnect()            // Manual reconnection
```

**Delegates to**:
- `CTraderSymbolLoader` - Symbol management
- `CTraderDataProcessor` - Data processing
- `CTraderEventHandler` - Event processing

### TradingViewSession Module

**Responsibility**: TradingView connection lifecycle and candle orchestration

```javascript
TradingViewSession.js
├── connect()              // Initialize connection
├── handleEvent()          // Route TradingView events
├── handleSeriesCompleted() // Coordinate D1/M1 completion
├── subscribeToSymbol()    // Set up dual candle sessions
└── reconnect()            // Manual reconnection
```

**Delegates to**:
- `TradingViewCandleHandler` - Candle processing
- `ReconnectionManager` - Reconnection logic

### WebSocketServer Module

**Responsibility**: Client communication orchestration

```javascript
WebSocketServer.js
├── constructor()          // Initialize sub-managers
├── handleSubscribe()      // Delegate to RequestCoordinator
├── handleReinit()         // Delegate to session reconnect
└── broadcast()            // Delegate to StatusBroadcaster
```

**Delegates to**:
- `SubscriptionManager` - Subscription tracking
- `RequestCoordinator` - Request handling with retry
- `StatusBroadcaster` - Status message broadcasting
- `DataRouter` - Data routing to clients

### Data Processing Modules

**CTraderSymbolLoader**:
- Symbol loading from cTrader API
- Bidirectional symbol ID/name mapping
- Symbol info caching with pip data

**CTraderDataProcessor**:
- Price calculation from raw cTrader integers
- Historical bar fetching (D1, M1)
- ADR calculation
- Today's OHLC extraction
- Symbol data package composition

**CTraderEventHandler**:
- Trendbar (M1 bar) event processing
- Spot (bid/ask) event processing
- Data validation and sanitization

### Infrastructure Modules

**SubscriptionManager**:
- Client subscription tracking by symbol and source
- Backend subscription tracking with coalescing
- Client removal on disconnect
- Subscribed clients lookup for broadcasting

**RequestCoordinator**:
- Symbol data request handling
- Fetch timeout management (30s default)
- Retry logic for failed requests
- Pending request tracking and resolution

**StatusBroadcaster**:
- Status message broadcasting to subscribed clients
- Connection status propagation
- Selective client notification by symbol

**DataRouter**:
- Data routing from cTrader/TradingView to WebSocket clients
- Message building via MessageBuilder
- Client lookup via SubscriptionManager
- Symbol data package delivery

**HealthMonitor**:
- Staleness detection (30s default threshold)
- Last tick timestamp tracking
- Stale/tick_resumed event emission

**Utilities**:

**ReconnectionManager** (utils/):
- Exponential backoff reconnection scheduling
- Reconnection attempt tracking
- Pending reconnect cancellation
- State reset after successful connection
- Shared by CTraderSession and TradingViewSession

**MessageBuilder** (utils/):
- Conditional field inclusion helper
- cTrader message construction
- TradingView message construction
- Consistent message formatting

### Data Processing Modules
- D1 candle processing and tick emission
- M1 candle processing with hard cap enforcement
- ADR calculation from candle data
- Data package emission when D1+M1 complete

## Design Principles

### Single Responsibility
Each module has one clear purpose:
- **Session files**: Connection lifecycle
- **Loader/Handler files**: Data processing
- **Infrastructure files**: Cross-cutting concerns

### Framework-First
- Native `EventEmitter` for pub/sub
- Native `WebSocket` for client communication
- No custom abstractions

### Line Limits
- All files <120 lines (except orchestration)
- All functions <15 lines
- Focused, testable units

## Data Flow

### Symbol Subscription Flow
```
Client → WebSocketServer.handleSubscribe()
        → RequestCoordinator.handleRequest()
        → Session.getSymbolDataPackage()
        → DataRouter.routeFrom...()
        → SubscriptionManager.addClientSubscription()
        → StatusBroadcaster.broadcastToClients()
```

### Tick Data Flow
```
cTrader API → CTraderSession → CTraderEventHandler
                          → HealthMonitor
                          → DataRouter.routeFromCTrader()
                          → MessageBuilder.buildCTraderMessage()
                          → SubscriptionManager.getSubscribedClients()
                          → WebSocketServer → Clients

TradingView API → TradingViewSession → TradingViewCandleHandler
                              → HealthMonitor
                              → DataRouter.routeFromTradingView()
                              → MessageBuilder.buildTradingViewMessage()
                              → SubscriptionManager.getSubscribedClients()
                              → WebSocketServer → Clients
```

### Reconnection Flow
```
Disconnect → Session.handleDisconnect()
          → ReconnectionManager.scheduleReconnect()
          → Exponential backoff delay
          → Session.connect()
          → ReconnectionManager.reset() (on success)
```

## Quick Start

### 1. Setup Environment
```bash
npm install
cp .env.example .env
# Edit .env with your credentials
```

### 2. Run Services
```bash
# Development mode (from project root)
./run.sh dev

# Backend only
./run.sh backend

# Production mode
./run.sh start
```

## Environment Configuration

Required `.env` variables:
```bash
# cTrader Credentials
CTRADER_ACCESS_TOKEN=your_token
CTRADER_ACCOUNT_ID=your_account_id
CTRADER_CLIENT_ID=your_client_id
CTRADER_CLIENT_SECRET=your_client_secret
HOST=demo.ctraderapi.com
PORT=5035

# Server Configuration
PORT=8080  # Development
# PORT=8081  # Production
```

## Session Lifecycle

### CTraderSession
1. **connect()** → Initialize CTraderConnection, delegates
2. **authenticate()** → Application + Account auth
3. **loadAllSymbols()** → Populate symbol maps
4. **startHeartbeat()** → 10s interval keepalive
5. **setupEventListeners()** → Route PROTO_OA_SPOT_EVENT
6. **handleDisconnect()** → Auto-reconnect via ReconnectionManager

### TradingViewSession
1. **connect()** → WebSocket connection
2. **subscribeToSymbol()** → Create D1 + M1 chart sessions
3. **handleSeriesCompleted()** → Wait for both D1 and M1
4. **emitDataPackage()** → Send complete package to frontend
5. **handleDisconnect()** → Auto-reconnect via ReconnectionManager

## Message Flow

### Client → Backend
```javascript
// Subscribe to symbol
{
  type: 'subscribe',
  symbol: 'EURUSD',
  source: 'ctrader'  // or 'tradingview'
}

// Manual reconnection (reinitialize specific data source)
{
  type: 'reinit',
  source: 'ctrader'  // or 'tradingview'
}

// Unsubscribe
{
  type: 'unsubscribe',
  symbol: 'EURUSD',
  source: 'ctrader'
}
```

**Message routing**: WebSocketServer → RequestCoordinator/SubscriptionManager

### Backend → Client
```javascript
// Tick data (routed via DataRouter)
{
  type: 'tick',
  source: 'ctrader',  // or 'tradingview'
  symbol: 'EURUSD',
  bid: 1.0850,
  ask: 1.0852,
  timestamp: 1234567890,
  pipPosition: 4,
  pipSize: 0.0001,
  pipetteSize: 0.00001,
  // Optional previous day OHLC (cTrader only)
  prevDayOpen: 1.0830,
  prevDayHigh: 1.0855,
  prevDayLow: 1.0820,
  prevDayClose: 1.0845
}

// Symbol data package (initial load via RequestCoordinator)
{
  type: 'symbolDataPackage',
  symbol: 'EURUSD',
  digits: 5,
  adr: 0.0080,
  todaysOpen: 1.0845,
  todaysHigh: 1.0860,
  todaysLow: 1.0840,
  projectedAdrHigh: 1.0885,
  projectedAdrLow: 1.0805,
  initialMarketProfile: [...],
  prevDayOpen: 1.0830,
  prevDayHigh: 1.0855,
  prevDayLow: 1.0820,
  prevDayClose: 1.0845
}

// Connection status (via StatusBroadcaster)
{
  type: 'status',
  source: 'ctrader',  // or 'tradingview'
  status: 'connected' | 'disconnected'
}

// Staleness warning (via HealthMonitor)
{
  type: 'stale',
  source: 'ctrader',  // or 'tradingview'
  threshold: 30000
}
```

## Health Monitoring

**HealthMonitor** tracks data staleness:
- Configurable timeout threshold (default 30s)
- Emits `stale` event when no data received
- Emits `tick_resumed` event when data flow resumes
- Prevents half-open socket detection failures

## Reconnection Strategy

**ReconnectionManager** handles automatic reconnection:
- Exponential backoff (max 60s)
- Unlimited retry attempts
- Manual `reconnect()` for forced reinit
- `shouldReconnect` flag for graceful shutdown

## Troubleshooting

### Common Issues

1. **"Cannot read properties of undefined"**
   - Check `.env` configuration
   - Verify all required variables set

2. **Connection timeout**
   - Verify network access to cTrader/TradingView APIs
   - Check firewall rules
   - Validate credentials

3. **Authentication failed**
   - Validate access token and account ID
   - Check cTrader account is active
   - Verify client ID/secret

4. **No data streaming**
   - Check HealthMonitor staleness threshold
   - Verify symbol subscriptions active
   - Review console logs for errors

### Debug Mode
```bash
# View backend logs
./run.sh logs backend

# Check environment status
./run.sh env-status

# Check service status
./run.sh status
```

## Dependencies

### Core
- `@reiryoku/ctrader-layer`: cTrader API wrapper
- `tradingview-ws`: TradingView WebSocket client
- `ws`: WebSocket server implementation
- `eventemitter3`: Enhanced EventEmitter

### Utilities
- `dotenv`: Environment configuration
- `moment`: Date/time manipulation
- `randomstring`: Session ID generation

## Development Notes

### Adding New Features

1. **New data source**: Create new Session class following pattern
2. **New calculation**: Add to appropriate DataProcessor
3. **New message type**: Add to MessageBuilder
4. **New subscription**: Extend WebSocketServer handlers

### Testing

Backend must be running for E2E tests:
```bash
# Start backend
./run.sh start

# Run E2E tests
npm test
```

## Windows PowerShell Notes
- Use PowerShell 7+ for best compatibility
- Ensure Node.js 16+ is installed
- Run commands from project root directory
