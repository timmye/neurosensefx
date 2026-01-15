# FX Basket "Waiting for FX data..." Stall - Root Cause Analysis

**Date:** 2026-01-15
**Status:** Root Cause Identified
**Priority:** CRITICAL - Functionality blocked

---

## Problem Statement

FX Basket initialization gets stuck at "Waiting for FX data..." indefinitely. The display never progresses to show actual basket data.

---

## Root Cause

The stall is caused by **three cascading race conditions** in the WebSocket connection and subscription flow:

```
subscribeCoordinated() called
  └─> sendCoordinatedRequest() checks if WebSocket.OPEN
      └─> If not OPEN, request is silently dropped (NO ERROR, NO RETRY)
          └─> No messages arrive from server
              └─> Message coordinator timeout never starts (requires first message)
                  └─> State machine never transitions from FAILED to WAITING
                      └─> UI shows "Waiting for FX data..." forever
```

---

## Critical Issues

### Issue 1: Silent Request Drops
**File:** `src/lib/connectionManager.js:164-173`

```javascript
sendCoordinatedRequest(symbol, adr, source) {
  if (this.ws?.readyState === WebSocket.OPEN) {
    const payload = { type: 'get_symbol_data_package', symbol, adrLookbackDays: adr, source };
    this.ws.send(JSON.stringify(payload));
  }
  // NO ELSE BRANCH - Request silently dropped if not OPEN!
}
```

**Impact:** Subscription requests are discarded without logging or retry when WebSocket isn't fully open.

---

### Issue 2: State Machine Stuck in FAILED
**File:** `src/lib/fxBasket/fxBasketStateMachine.js:14-35`

```javascript
export function createStateMachine(expectedPairs, timeoutMs = 10000) {
  return {
    state: BasketState.FAILED,  // Initial state - no transition without data
    // ...
  };
}

export function trackPair(sm, pair, dailyOpen, currentPrice) {
  if (!dailyOpen || !currentPrice) return false;
  if (sm.state === BasketState.FAILED) {
    sm.state = BasketState.WAITING;  // Only transitions when data arrives
  }
}
```

**Impact:** State machine never leaves `FAILED` state if no data arrives. No initialization timeout exists.

---

### Issue 3: Race Window in handleOpen()
**File:** `src/lib/connectionManager.js:74-77`

```javascript
async handleOpen() {
  this.status = 'connected';  // Set immediately
  await this.resubscribeAll();  // Async operation
  this.notifyStatusChange();    // Notified AFTER
}
```

**Impact:** `waitForConnection()` resolves while `resubscribeAll()` is still running, creating a race window.

---

### Issue 4: Message Coordinator Timeout Dependency
**File:** `src/lib/websocket/messageCoordinator.js:40-47`

```javascript
onMessage(symbol, messageType, data) {
  received.get(symbol).add(messageType);
  if (received.get(symbol).size === 1) startTimeout(symbol);  // Only on first message
}
```

**Impact:** If no messages arrive, the 5-second timeout never starts.

---

## Systemic Patterns

1. **Async operations mixed with synchronous state management** - State changes happen immediately, but side effects are async
2. **Silent failures** - Errors are dropped without logging or retry mechanisms
3. **Missing fallback timeouts** - State transitions depend on external events without independent timeouts

---

## Recommended Fixes

### Fix 1: Request Queue in ConnectionManager
Add a queue to hold requests until WebSocket is ready:

```javascript
// In constructor
this.requestQueue = [];

// Modified sendCoordinatedRequest
sendCoordinatedRequest(symbol, adr, source) {
  const payload = { type: 'get_symbol_data_package', symbol, adrLookbackDays: adr, source };
  if (this.ws?.readyState === WebSocket.OPEN) {
    this.ws.send(JSON.stringify(payload));
  } else {
    this.requestQueue.push(payload);
  }
}

// Modified handleOpen - send queued requests first
async handleOpen() {
  this.status = 'connected';
  this.notifyStatusChange();  // Notify BEFORE async operation
  while (this.requestQueue.length > 0) {
    this.ws.send(JSON.stringify(this.requestQueue.shift()));
  }
  await this.resubscribeAll();
}
```

### Fix 2: Initialization Timeout in State Machine
Add independent timeout for FAILED -> ERROR transition:

```javascript
export function createStateMachine(expectedPairs, timeoutMs = 10000, initTimeoutMs = 15000) {
  const sm = {
    state: BasketState.FAILED,
    expectedPairs,
    receivedPairs: new Set(),
    initTimeoutId: null,
    initTimeoutMs,
    // ...
  };
  sm.initTimeoutId = setTimeout(() => {
    if (sm.state === BasketState.FAILED) {
      sm.state = BasketState.ERROR;
    }
  }, initTimeoutMs);
  return sm;
}
```

### Fix 3: Notify Status Before Resubscribe
Move `notifyStatusChange()` before `await this.resubscribeAll()`.

### Fix 4: Start Timeout on Subscription
Modify message coordinator to start timeout when subscription is created, not on first message.

---

## Files Requiring Changes

| File | Lines | Change Type |
|------|-------|-------------|
| `src/lib/connectionManager.js` | 256 | Add request queue, fix timing |
| `src/lib/fxBasket/fxBasketStateMachine.js` | 91 | Add init timeout |
| `src/lib/websocket/messageCoordinator.js` | 52 | Start timeout on subscription |
| `src/components/FxBasketDisplay.svelte` | 273 | May need updates for new patterns |

---

## Testing Strategy

1. **Reproduce the stall:** Add delay in `handleOpen()` before WebSocket is fully open
2. **Verify queue:** Confirm requests are queued and sent when ready
3. **Verify init timeout:** Confirm state transitions to ERROR if no data arrives
4. **Load test:** Test with all 30 FX pairs at 400ms intervals
