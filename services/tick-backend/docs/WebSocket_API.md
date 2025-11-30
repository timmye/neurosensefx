# WebSocket API Documentation

**Source of Truth for NeuroSense FX Backend Communication Protocol**

## Endpoints

- Development: `ws://localhost:8080`
- Production: `ws://localhost:8081`

## Connection Flow

1. Client connects → Backend sends `status` immediately
2. Backend sends `ready` when connected to cTrader
3. Client requests data

## Status States

- `disconnected` - Not connected to cTrader API
- `ws-connecting` - WebSocket server starting
- `ws-open` - WebSocket running, cTrader not connected
- `ctrader-connecting` - Connecting to cTrader API
- `connected` - Fully operational
- `error` - Unrecoverable error

## Message Protocol

All messages are JSON objects with a `type` field.

---

## Client → Server Messages

### 1. Get Symbol Data Package ⭐ **RECOMMENDED**
```javascript
{
    "type": "get_symbol_data_package",
    "symbol": "EURUSD",
    "adrLookbackDays": 14
}
```

**Purpose**: Request comprehensive symbol data package with ADR calculations and market profile.

**Parameters**:
- `symbol` (string, required): Symbol name
- `adrLookbackDays` (number, optional): ADR calculation period, defaults to 14

**Response**: `symbolDataPackage` + real-time `tick` messages.

### 2. Subscribe ⚠️ **LEGACY**
```javascript
{
    "type": "subscribe",
    "symbols": ["EURUSD"]
}
```

**Purpose**: Legacy protocol for multiple symbols. **Do not use for new implementations.**

**Parameters**:
- `symbols` (array, required): Symbol names
- Fixed 14-day ADR calculation

**Response**: `symbolDataPackage` per symbol + real-time `tick` messages.

### 3. Unsubscribe from Symbol
```javascript
{
    "type": "unsubscribe",
    "symbols": ["EURUSD", "GBPUSD"]
}
```

**Purpose**: Stop receiving tick data.

**Parameters**:
- `symbols` (array, required): Symbols to unsubscribe

**Response**: Tick messages stop for specified symbols.

---

## Server → Client Messages

### 1. Connection Status
```javascript
{
    "type": "status",
    "status": "connected",
    "availableSymbols": ["EURUSD", "GBPUSD", "USDJPY", ...]
}
```

**Sent**: On connection + status changes

**Fields**:
- `status` (string): Connection state
- `availableSymbols` (array): Available symbols

### 2. Ready Message
```javascript
{
    "type": "ready",
    "availableSymbols": ["EURUSD", "GBPUSD", "USDJPY", ...]
}
```

**Sent**: When backend fully connects to cTrader.

### 3. Symbol Data Package
```javascript
{
    "type": "symbolDataPackage",
    "symbol": "EURUSD",
    "digits": 5,
    "bid": 1.08567,
    "ask": 1.08570,
    "adr": 0.0080,
    "projectedAdrHigh": 1.0895,
    "projectedAdrLow": 1.0815,
    "todaysOpen": 1.0820,
    "todaysHigh": 1.0860,
    "todaysLow": 1.0810,
    "initialPrice": 1.08568,
    "initialMarketProfile": [
        {
            "open": 1.08500,
            "high": 1.08580,
            "low": 1.08490,
            "close": 1.08560,
            "timestamp": 1701234560000
        }
        // ... more M1 bars
    ]
}
```

**Sent**: Response to `get_symbol_data_package` request.

**Fields**:
- `symbol` (string): Symbol name
- `digits` (number): Decimal places
- `bid`/`ask` (number): Current prices
- `adr` (number): Average Daily Range
- `projectedAdrHigh`/`projectedAdrLow` (number): ADR-based projections
- `todaysOpen`/`todaysHigh`/`todaysLow` (number): Today's range
- `initialPrice` (number): Mid price
- `initialMarketProfile` (array): M1 bar data

### 4. Real-time Tick Data
```javascript
{
    "type": "tick",
    "symbol": "EURUSD",
    "bid": 1.08567,
    "ask": 1.08570,
    "timestamp": 1701234567890
}
```

**Sent**: Continuously for subscribed symbols.

**Fields**:
- `symbol` (string): Symbol name
- `bid`/`ask` (number): Current prices
- `timestamp` (number): Unix timestamp

### 5. Error Message
```javascript
{
    "type": "error",
    "message": "Invalid symbol: INVALID"
}
```

**Sent**: On invalid requests or server errors.

**Fields**:
- `message` (string): Error description

---

## Data Processing

### Price Format
- Decimal numbers (not cTrader relative format)
- Converted from cTrader internal values (/100000)
- Formatted to symbol's `digits` precision

### ADR Calculations
- Based on `adrLookbackDays` period
- Projects daily high/low levels
- Indicates volatility expectations

### Market Profile
- M1 (1-minute) OHLC bar data
- Used for volume-at-price analysis

## Environment Configuration

### Environment Variables
```bash
# cTrader API Credentials
CTRADER_CLIENT_ID=
CTRADER_CLIENT_SECRET=
CTRADER_ACCESS_TOKEN=
CTRADER_ACCOUNT_ID=

# cTrader API Servers
HOST=live.ctraderapi.com
PORT=5035

# Backend Configuration
WS_PORT=8080
NODE_ENV=development
```

### Environments
- **Development**: Port 8080, verbose logging
- **Production**: Port 8081, optimized performance
- Can run simultaneously for testing

## Performance Characteristics

### Performance
- **Sub-100ms latency** from cTrader to client
- **Subscription aggregation**: Only subscribe cTrader API for active symbols
- **Automatic cleanup** on client disconnect/unsubscribe
- **Efficient broadcasting** to multiple clients
- **Auto-reconnection** with exponential backoff

## Troubleshooting
### Issues
1. **"Invalid symbol"**: Check symbol against `availableSymbols` list
2. **No tick data**: Verify backend `status` is `connected`
3. **Connection failures**: Check WebSocket URL and port

### Debug Logging
- Connection state changes
- Symbol subscription management
- Message processing and errors
- cTrader API interaction

---

## Implementation Notes

### Protocols

**Primary (`get_symbol_data_package`)** - ⭐ **RECOMMENDED**
- Single symbol with configurable ADR period
- Comprehensive data package with market profile
- Use for all new implementations

**Legacy (`subscribe`)** - ⚠️ **DEPRECATED**
- Multiple symbols, fixed 14-day ADR
- Backward compatibility only
- **Do not use for new implementations**

### Backend Behavior
- Identical responses for both protocols
- Per-symbol subscription tracking
- Automatic resource cleanup
- Efficient cTrader API aggregation

### Message Validation
- JSON format validation
- Required field checking
- Symbol availability verification

---

**Source of truth for NeuroSense FX backend WebSocket API.**