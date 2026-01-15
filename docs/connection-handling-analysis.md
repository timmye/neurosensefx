# Connection Handling & Message Coordination Analysis

**Date:** 2026-01-15
**Scope:** Documentation of WebSocket connection management and message coordination patterns in the NeuroSense FX codebase.

---

## Executive Summary

The codebase has **two connection handling patterns**:

| Component | Message Coordination | Implementation |
|-----------|---------------------|----------------|
| **Standard Canvas** (`FloatingDisplay.svelte`) | No | Uses `subscribeAndRequest()` |
| **FX Basket** (`FxBasketDisplay.svelte`) | Yes | Uses `subscribeCoordinated()` |

### Key Findings

- **Standard displays** receive messages asynchronously without coordination
- **FX Basket** waits for coordinated message pairs (`symbolDataPackage` + `tick`) with 5s timeout
- **~220 lines of dead code removed** (see Cleanup Status below)
- **Two subscription patterns** serve different use cases (latency vs completeness)

---

## Cleanup Status ✅ COMPLETED

**Date:** 2026-01-15

| Action | Result |
|--------|--------|
| Files removed | 2 (~175 lines) |
| Code removed from active files | 1 file, 45 lines |
| Total cleanup | **~220 lines** |
| Build | ✅ Success (829ms, 87 modules) |
| Tests | ✅ 31 passed (11 WebSocket-required tests skipped) |

### Removed

| File | Lines |
|------|-------|
| `src/lib/websocket.js` | 122 |
| `src/lib/connectionSetup.js` | 53 |
| `src/lib/fxBasket/fxBasketProcessor.js` | 45 (unused export + helpers) |

### Process

1. **Verified unused code** via grep (0 imports/calls)
2. **Removed files** and unused exports
3. **Built successfully** - no import/syntax errors
4. **Tested** - 31 core workflow tests passed
5. **Documented** findings and cleanup status

---

## Connection Handling Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ConnectionManager (Singleton)                │
│  src/lib/connectionManager.js                                   │
│                                                                  │
│  ┌────────────────────┐  ┌──────────────────────────────────┐  │
│  │ subscribeAndRequest│  │    subscribeCoordinated           │  │
│  │   (OLD Pattern)    │  │    (NEW Pattern)                  │  │
│  │                    │  │                                   │  │
│  │ • Direct callback  │  │ • createMessageCoordinator()      │  │
│  │ • No coordination  │  │ • Waits for symbolDataPackage    │  │
│  │ • Messages async   │  │   + tick or timeout               │  │
│  └────────┬───────────┘  └────────────────┬──────────────────┘  │
└───────────┼───────────────────────────────┼──────────────────────┘
            │                               │
            ▼                               ▼
    ┌───────────────┐             ┌─────────────────┐
    │FloatingDisplay│             │FxBasketDisplay  │
    │src/components/│             │src/components/  │
    │FloatingDisplay│             │FxBasketDisplay  │
    │.svelte:83     │             │.svelte:107      │
    │               │             │                 │
    │• 1 symbol     │             │• 30 FX pairs    │
    │• Inline       │             │• Coordinated    │
    │  callback     │             │  subscription   │
    │• No timeout   │             │• 5s timeout     │
    └───────────────┘             └─────────────────┘
```

---

## Message Coordination Flow

```
subscribeCoordinated(symbol, onAllReceived, onTimeout, adr, source, timeoutMs)
  │
  ├─→ createCoordinator({
  │     requiredTypes: ['symbolDataPackage', 'tick'],
  │     timeoutMs: 5000,
  │     onAllReceived: (sym, data) => onAllReceived(data.symbolDataPackage, data.tick),
  │     onTimeout: (sym, partial, received) => onTimeout(partial, received)
  │   })
  │
  ├─→ Coordinator buffers messages by type
  │     (Map<symbol, Map<messageType, data>>)
  │
  ├─→ Tracks received types per symbol
  │     (Map<symbol, Set<messageType>>)
  │
  ├─→ Starts timeout on first message received
  │     (Map<symbol, timeoutId>)
  │
  └─→ Completion scenarios:
       ├─ SUCCESS: All requiredTypes received
       │   → clearTimeout()
       │   → onAllReceived(symbol, allData)
       │   → cleanup(symbol)
       │
       └─ TIMEOUT: Only some types received
           → clearTimeout()
           → onTimeout(symbol, partialData, receivedTypes)
           → cleanup(symbol)
```

### Message Coordinator Implementation

**File:** `src/lib/websocket/messageCoordinator.js` (52 lines)

```javascript
export function createMessageCoordinator(config) {
  const { requiredTypes, timeoutMs, onAllReceived, onTimeout } = config;
  const buffers = new Map();    // symbol -> Map<messageType, data>
  const received = new Map();   // symbol -> Set<messageType>
  const timeouts = new Map();   // symbol -> timeoutId

  return {
    onMessage(symbol, messageType, data) {
      if (!buffers.has(symbol)) initSymbol(symbol);
      buffers.get(symbol).set(messageType, data);
      received.get(symbol).add(messageType);
      if (received.get(symbol).size === 1) startTimeout(symbol);
      checkComplete(symbol);
    },
    cleanup(symbol) { /* ... */ }
  };
}
```

**Framework-First:** Uses only `Map`, `Set`, `setTimeout` (no external dependencies)

---

## Current State: Two Subscription Patterns

### Pattern 1: Standard Canvas (`subscribeAndRequest`)

**File:** `src/components/FloatingDisplay.svelte:83`

```javascript
unsubscribe = connectionManager.subscribeAndRequest(formattedSymbol, dataCallback, 14, source);
```

**Characteristics:**
- Direct callback per message
- Messages processed independently as they arrive
- No coordination between message types
- No timeout handling

**Use case:** Real-time updates where immediate processing is prioritized over completeness

---

### Pattern 2: FX Basket (`subscribeCoordinated`)

**File:** `src/components/FxBasketDisplay.svelte:107-124`

```javascript
const unsub = connectionManager.subscribeCoordinated(
  pair,
  // onAllReceived: called when both messages arrive
  (symbolDataPackage, tick) => {
    console.log(`[FX BASKET] Coordinated: ${pair} - both messages received`);
    trackingCallback(symbolDataPackage);
    trackingCallback(tick);
  },
  // onTimeout: handles timeout if both messages don't arrive
  (partial, received) => {
    console.warn(`[FX BASKET] Timeout for ${pair}, received:`, Array.from(received));
    if (partial.symbolDataPackage) trackingCallback(partial.symbolDataPackage);
    if (partial.tick) trackingCallback(partial.tick);
  },
  14,      // adr
  'ctrader',
  5000     // timeoutMs
);
```

**Characteristics:**
- Waits for coordinated message pairs (`symbolDataPackage` + `tick`)
- 5s timeout with partial data fallback
- Callback invoked only after both received OR timeout expires

**Use case:** Multi-symbol display where complete data per symbol is preferred

---

## Removed Dead Code (Completed)

### 1. `src/lib/websocket.js` (122 lines)

Parallel Svelte store-based implementation not integrated with ConnectionManager. Verified 0 imports via grep.

### 2. `src/lib/connectionSetup.js` (53 lines)

Utility functions using `new ConnectionManager()` instead of singleton pattern. Verified 0 function calls via grep.

### 3. Unused export from `fxBasketProcessor.js` (~12 lines)

`subscribeCoordinated()` wrapper that bypassed ConnectionManager's implementation. FxBasketDisplay calls directly.

---

## Connection Manager API

### subscribeAndRequest() - Old Pattern

**File:** `src/lib/connectionManager.js:91-125`

```javascript
subscribeAndRequest(symbol, callback, adr = 14, source = 'ctrader') {
  const key = this.makeKey(symbol, source);
  if (!this.subscriptions.has(key)) {
    this.subscriptions.set(key, new Set());
    this.subscriptionAdr.set(key, adr);
  }
  const callbacks = this.subscriptions.get(key);
  callbacks.add(callback);

  if (this.ws?.readyState === WebSocket.OPEN) {
    const payload = { type: 'get_symbol_data_package', symbol, adrLookbackDays: adr, source };
    this.ws.send(JSON.stringify(payload));
  }

  return () => {
    const callbacks = this.subscriptions.get(key);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.subscriptions.delete(key);
        this.subscriptionAdr.delete(key);
      }
    }
  };
}
```

**Characteristics:**
- Direct callback per message
- No coordination between message types
- No timeout handling
- Used by: FloatingDisplay.svelte

---

### subscribeCoordinated() - New Pattern

**File:** `src/lib/connectionManager.js:127-185`

```javascript
subscribeCoordinated(symbol, onAllReceived, onTimeout, adr = 14, source = 'ctrader', timeoutMs = 5000) {
  const coordinator = this.createCoordinator(onAllReceived, onTimeout, timeoutMs);
  const key = this.makeKey(symbol, source);
  this.ensureSubscription(key, adr);

  const callback = this.createCoordinatorCallback(coordinator, symbol);
  this.subscriptions.get(key).add(callback);
  this.sendCoordinatedRequest(symbol, adr, source);

  return () => this.cleanupCoordinated(key, callback, coordinator, symbol);
}

createCoordinator(onAllReceived, onTimeout, timeoutMs) {
  const { createMessageCoordinator } = require('./websocket/messageCoordinator.js');
  return createMessageCoordinator({
    requiredTypes: ['symbolDataPackage', 'tick'],
    timeoutMs,
    onAllReceived: (sym, data) => onAllReceived(data.symbolDataPackage, data.tick),
    onTimeout: (sym, partial, received) => onTimeout(partial, received)
  });
}

createCoordinatorCallback(coordinator, symbol) {
  return (message) => {
    if (message.type === 'symbolDataPackage' || message.type === 'tick') {
      coordinator.onMessage(symbol, message.type, message);
    }
  };
}
```

**Characteristics:**
- Coordinated callbacks (waits for multiple message types)
- Timeout handling (5s default)
- Partial data processing on timeout
- Used by: FxBasketDisplay.svelte

---

## File Inventory

### Active Connection Files

| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| `src/lib/connectionManager.js` | 256 | Singleton WebSocket manager | ✅ Active |
| `src/lib/websocket/messageCoordinator.js` | 52 | Multi-message coordination | ✅ Active (2 imports) |
| `src/components/FloatingDisplay.svelte` | 187 | Standard display component | ✅ Active |
| `src/components/FxBasketDisplay.svelte` | 273 | FX Basket display component | ✅ Active |
| `src/lib/fxBasket/fxBasketProcessor.js` | 66 | FX Basket message routing | ✅ Active (cleaned) |

### ✅ Removed Files (Completed)

| File | Lines | Status |
|------|-------|--------|
| `src/lib/websocket.js` | 122 | ✅ Removed (0 imports) |
| `src/lib/connectionSetup.js` | 53 | ✅ Removed (0 calls) |

### ✅ Removed Code (Completed)

| File | Lines Removed | Status |
|------|---------------|--------|
| `src/lib/fxBasket/fxBasketProcessor.js` | 45 | ✅ Removed unused export + helpers |

---

## References

### Key File Locations

- **Connection Manager:** `src/lib/connectionManager.js`
- **Message Coordinator:** `src/lib/websocket/messageCoordinator.js`
- **Standard Display:** `src/components/FloatingDisplay.svelte:83`
- **FX Basket Display:** `src/components/FxBasketDisplay.svelte:107-124`
- **FX Basket Processor:** `src/lib/fxBasket/fxBasketProcessor.js`

### Related Documentation

- `src/CLAUDE.md` - Frontend architecture
- `src/lib/CLAUDE.md` - Library reference
- `docs/crystal-clarity/` - Development guidelines

---
