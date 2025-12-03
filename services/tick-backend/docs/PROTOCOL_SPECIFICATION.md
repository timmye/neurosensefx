# NeuroSense FX WebSocket Protocol Specification

**Definitive Source of Truth - Current Implementation**

## Quick Reference

### Connection
```
Development: ws://localhost:8080
Production:  ws://localhost:8081
```

### Message Flow
1. **Connect** → Backend sends `status` immediately
2. **Backend Ready** → Backend sends `ready` (if connected to cTrader)
3. **Client Request** → `get_symbol_data_package`
4. **Backend Response** → `symbolDataPackage` + continuous `tick` messages

---

## Message Protocol

### Client → Server

#### ⭐ RECOMMENDED: Get Symbol Data Package
```json
{
  "type": "get_symbol_data_package",
  "symbol": "EURUSD",
  "adrLookbackDays": 14
}
```

#### Unsubscribe
```json
{
  "type": "unsubscribe",
  "symbols": ["EURUSD", "GBPUSD"]
}
```

### Server → Client

#### Status Update
```json
{
  "type": "status",
  "status": "connected",
  "availableSymbols": ["EURUSD", "GBPUSD", "USDJPY"]
}
```

#### Ready Message
```json
{
  "type": "ready",
  "availableSymbols": ["EURUSD", "GBPUSD", "USDJPY"]
}
```

#### Symbol Data Package
```json
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
  ]
}
```

#### Real-time Tick
```json
{
  "type": "tick",
  "symbol": "EURUSD",
  "bid": 1.08567,
  "ask": 1.08570,
  "timestamp": 1701234567890
}
```

#### Error Message
```json
{
  "type": "error",
  "message": "Invalid symbol: INVALID"
}
```

---

## Status States

- `disconnected` - Not connected to cTrader
- `ws-connecting` - WebSocket starting
- `ws-open` - WebSocket running, cTrader not connected
- `ctrader-connecting` - Connecting to cTrader API
- `connected` - Fully operational
- `error` - Unrecoverable error

---

## Implementation Notes

### Protocol Support
- **RECOMMENDED**: Use `get_symbol_data_package` for all new implementations
- **LEGACY**: `subscribe` maintained only for backward compatibility
- Both protocols receive identical backend responses
- **Do not use `subscribe` for new client implementations**

### Message Flow
- No `connect` message required
- No `ping`/`pong` heartbeat
- No `subscribeResponse`/`unsubscribeResponse`
- No `getSubscriptions` query

### Data Format
- All prices as decimal numbers (not cTrader relative format)
- Timestamps in Unix milliseconds
- Symbol validation against `availableSymbols` list
- Market profile data provides M1 OHLC bars

### Performance
- Sub-100ms latency from cTrader to client
- Efficient subscription aggregation
- Automatic resource cleanup
- Real-time streaming with optimized broadcasting

---

**For complete documentation, see `WebSocket_API.md`**