# ADR 001: FX Basket Connection and Data Handling Architecture Refactoring

**Status:** Proposed
**Date:** 2026-01-15
**Decision:** Refactor to request-queue-based architecture with independent timeout guarantees

---

## Context

The FX Basket display stalls at "Waiting for FX data..." due to cascading race conditions in the WebSocket connection and subscription flow.

### Root Causes Identified

1. **Silent request drops** - `sendCoordinatedRequest()` discards requests when WebSocket isn't OPEN without logging or retry
2. **State machine deadlock** - State machine starts in FAILED and requires data arrival to transition, with no initialization timeout
3. **Race window in connection timing** - `handleOpen()` sets status to 'connected' before async `resubscribeAll()` completes
4. **Timeout dependency** - Message coordinator timeout only starts after first message arrives

### Systemic Patterns

1. Async operations mixed with synchronous state management
2. Silent failures without logging or retry mechanisms
3. Missing fallback timeouts for state transitions

---

## Decision

Refactor the FX Basket connection layer into a **request-queue-based architecture with independent timeout guarantees**.

### Architecture Overview

```
ConnectionManager (singleton)
  ├─ ConnectionState: DISCONNECTING → CONNECTING → READY
  ├─ RequestQueue: Pending requests during connection
  └─ SubscriptionRegistry: Active subscriptions with lifecycle
       ↓
MessageCoordinator (per subscription)
  ├─ BufferMap: Message type buffers per symbol
  ├─ TimeoutManager: Independent timeout per symbol
  └─ CleanupHandler: Resource cleanup on completion
       ↓
FxStateMachine (per basket)
  ├─ InitializationTimeout: Independent of data arrival
  ├─ DataCollectionTimeout: Per-pair timeout
  └─ FallbackToPartial: Graceful degradation
```

### Key Principles

1. **Queue Everything** - No request is ever dropped. All requests are queued and processed when ready.
2. **Independent Timeouts** - Every operation has its own timeout that starts immediately, not conditionally.
3. **Explicit State** - Connection state and subscription state are tracked separately.
4. **Fail Loudly** - All failures are logged, no silent drops.
5. **Framework-First** - Use only Map, Set, setTimeout (no custom abstractions)

---

## Consequences

### Benefits

- Eliminates entire class of race conditions through request queuing
- Guarantees timeout behavior regardless of message arrival
- Simplifies debugging with explicit state tracking
- Maintains Crystal Clarity compliance (<120 line files, <15 line functions)
- Reduces ConnectionManager from 256 lines to ~180 lines

### Tradeoffs

- Adds memory overhead for request queue (negligible: ~1KB per pending request)
- Increases code complexity in ConnectionManager (mitigated by splitting into smaller files)
- Slightly slower connection establishment (queue flush adds ~50ms, acceptable)

---

## Implementation Strategy

### Phase 1: Request Queue and Connection State Separation

**New File:** `src/lib/websocket/requestQueue.js` (~40 lines)

**Functions:**
- `createRequestQueue()` - Initialize empty queue and state
- `enqueue(queue, request)` - Add request to queue, log if not connected
- `flush(queue, ws)` - Send all queued requests via WebSocket
- `clear(queue)` - Clear pending requests (for disconnect)

**Refactor:** `src/lib/websocket/connectionManager.js` (256 → 180 lines)

**Changes:**
1. Extract request queue logic into dedicated module
2. Separate connection state from subscription state
3. Implement queue flush on connection ready
4. Add defensive logging for all queue operations

### Phase 2: Independent Timeout Implementation

**Modify:** `src/lib/websocket/messageCoordinator.js` (52 → 60 lines)

**Changes:**
1. Add `subscribe(symbol)` method that starts timeout immediately
2. Move timeout start from first message to subscription creation

**Modify:** `src/lib/fxBasket/fxBasketStateMachine.js` (91 → 100 lines)

**Changes:**
1. Add `initTimeoutMs` parameter to `createStateMachine()`
2. Start initialization timeout immediately on creation
3. Add `handleInitTimeout()` function for ERROR state transition

### Phase 3: Component Integration and Testing

**Modify:** `src/components/FxBasketDisplay.svelte` (273 → 275 lines)

**Changes:**
1. Update `waitForConnection()` to wait for 'READY' state
2. Add ERROR state handling in `handleBasketUpdate()`

---

## Testing Strategy

### Unit Tests Required

1. **requestQueue.test.js**
   - Enqueue when not ready
   - Flush sends all
   - Clear empties queue
   - Multiple enqueue preserves order

2. **connectionManager.test.js**
   - State transition (DISCONNECTING → CONNECTING → READY)
   - sendQueued when ready vs not ready
   - handleOpen flushes queue
   - handleOpen notifies before resubscribe
   - resubscribeAll sends all subscriptions

3. **messageCoordinator.test.js**
   - subscribe starts timeout immediately
   - onMessage buffers correctly
   - timeout fires without messages
   - cleanup clears all resources

4. **fxBasketStateMachine.test.js**
   - init timeout starts immediately
   - init timeout transitions to ERROR
   - data arrival prevents init timeout
   - collection timeout with partial data
   - reset clears timeouts

### Integration Tests Required

1. **Race Condition Tests**
   - Subscribe before connection
   - Subscribe during connection
   - Connection drops with pending requests

2. **Timeout Tests**
   - No data arrives (init timeout)
   - Partial data (collection timeout)
   - Server never responds

3. **Load Tests**
   - All 30 FX pairs at 400ms intervals
   - Reconnect with active subscriptions

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Request Queue | 4 hours |
| Phase 2: Timeouts | 3 hours |
| Phase 3: Integration/Tests | 5 hours |
| **Total** | **12 hours** |

---

## Files Changed

| File | Change | Lines |
|------|--------|-------|
| `src/lib/websocket/requestQueue.js` | New | ~40 |
| `src/lib/websocket/connectionManager.js` | Refactor | 256 → 180 |
| `src/lib/websocket/messageCoordinator.js` | Modify | 52 → 60 |
| `src/lib/fxBasket/fxBasketStateMachine.js` | Modify | 91 → 100 |
| `src/components/FxBasketDisplay.svelte` | Modify | 273 → 275 |
