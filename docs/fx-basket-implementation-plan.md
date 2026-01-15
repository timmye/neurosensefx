# FX Basket Implementation Plan

**Date:** 2026-01-15
**Status:** Ready for Implementation
**Estimated Effort:** 12 hours

---

## Overview

This plan implements the architecture defined in [ADR 001](./adr/001-fx-basket-connection-refactoring.md) to fix the FX Basket "Waiting for FX data..." stall.

---

## Phase 1: Request Queue Implementation (4 hours)

### 1.1 Create Request Queue Module

**File:** `src/lib/websocket/requestQueue.js`

```javascript
/**
 * Request Queue for WebSocket requests
 * Queues requests until connection is ready, then flushes
 * Framework-First: Map, Set, setTimeout only
 * Crystal Clarity: <40 lines, <15 line functions
 */

export function createRequestQueue() {
  return {
    pending: [],
    isReady: false,

    enqueue(request) {
      this.pending.push(request);
      const symbol = request.symbol || 'unknown';
      console.log(`[QUEUE] Enqueued ${symbol}, queue size: ${this.pending.length}`);
    },

    flush(ws) {
      console.log(`[QUEUE] Flushing ${this.pending.length} requests`);
      while (this.pending.length > 0) {
        const request = this.pending.shift();
        try {
          ws.send(JSON.stringify(request));
        } catch (error) {
          console.error(`[QUEUE] Failed to send queued request:`, error);
        }
      }
      this.isReady = true;
    },

    clear() {
      this.pending = [];
      this.isReady = false;
      console.log('[QUEUE] Cleared');
    },

    get size() {
      return this.pending.length;
    }
  };
}
```

### 1.2 Refactor ConnectionManager

**File:** `src/lib/websocket/connectionManager.js`

**Key Changes:**

1. Import requestQueue
2. Add requestQueue to constructor
3. Modify `connect()` to use requestQueue
4. Fix `handleOpen()` timing (notify BEFORE resubscribeAll)
5. Modify `sendCoordinatedRequest()` to use queue
6. Add logging for all queue operations

**Critical handleOpen() fix:**

```javascript
async handleOpen() {
  console.log('[CM] WebSocket OPEN');
  this.state = 'READY';
  this.notifyStatusChange();  // Notify BEFORE async operations
  this.requestQueue.flush(this.ws);  // Flush pending requests
  await this.resubscribeAll();
}
```

**Modified sendCoordinatedRequest():**

```javascript
sendCoordinatedRequest(symbol, adr, source) {
  const payload = { type: 'get_symbol_data_package', symbol, adrLookbackDays: adr, source };

  if (this.ws?.readyState === WebSocket.OPEN && this.requestQueue.isReady) {
    this.ws.send(JSON.stringify(payload));
  } else {
    console.log(`[CM] WebSocket not ready, queuing request for ${symbol}`);
    this.requestQueue.enqueue(payload);
  }
}
```

---

## Phase 2: Independent Timeout Implementation (3 hours)

### 2.1 Enhance MessageCoordinator

**File:** `src/lib/websocket/messageCoordinator.js`

**Key Change:** Add `subscribe()` method that starts timeout immediately

```javascript
export function createMessageCoordinator(config) {
  const { requiredTypes, timeoutMs, onAllReceived, onTimeout } = config;
  const buffers = new Map();
  const received = new Map();
  const timeouts = new Map();

  function initSymbol(symbol) {
    buffers.set(symbol, new Map());
    received.set(symbol, new Set());
  }

  function startTimeout(symbol) {
    timeouts.set(symbol, setTimeout(() => {
      const partial = Object.fromEntries(buffers.get(symbol) || {});
      cleanup(symbol);
      onTimeout(symbol, partial, received.get(symbol) || new Set());
    }, timeoutMs));
  }

  function checkComplete(symbol) {
    const receivedSet = received.get(symbol);
    if (receivedSet && receivedSet.size === requiredTypes.length) {
      const allData = Object.fromEntries(buffers.get(symbol));
      cleanup(symbol);
      onAllReceived(symbol, allData);
    }
  }

  function cleanup(symbol) {
    if (timeouts.has(symbol)) clearTimeout(timeouts.get(symbol));
    buffers.delete(symbol);
    received.delete(symbol);
    timeouts.delete(symbol);
  }

  return {
    // NEW: Start timeout on subscription, not first message
    subscribe(symbol) {
      if (!buffers.has(symbol)) {
        initSymbol(symbol);
        startTimeout(symbol);
        console.log(`[COORD] Subscribed to ${symbol}, timeout: ${timeoutMs}ms`);
      }
    },

    onMessage(symbol, messageType, data) {
      if (!buffers.has(symbol)) initSymbol(symbol);
      buffers.get(symbol).set(messageType, data);
      received.get(symbol).add(messageType);
      checkComplete(symbol);
    },

    cleanup
  };
}
```

### 2.2 Enhance FxBasketStateMachine

**File:** `src/lib/fxBasket/fxBasketStateMachine.js`

**Key Changes:**

1. Add `initTimeoutMs` parameter
2. Start init timeout immediately in `createStateMachine()`
3. Add `handleInitTimeout()` function
4. Update `reset()` to clear init timeout

```javascript
export function createStateMachine(expectedPairs, timeoutMs = 10000, initTimeoutMs = 15000) {
  const sm = {
    state: BasketState.FAILED,
    expectedPairs,
    receivedPairs: new Set(),
    startTime: null,
    timeoutId: null,
    initTimeoutId: null,
    timeoutMs,
    initTimeoutMs,
    missingPairs: [],
    partialData: false,
    getProgress() {
      return { received: this.receivedPairs.size, total: this.expectedPairs.length };
    }
  };

  // Start initialization timeout IMMEDIATELY
  sm.initTimeoutId = setTimeout(() => handleInitTimeout(sm), initTimeoutMs);
  console.log(`[SM] Init timeout started: ${initTimeoutMs}ms`);

  return sm;
}

function handleInitTimeout(sm) {
  if (sm.state === BasketState.FAILED) {
    console.error('[SM] Initialization timeout - no data received');
    sm.state = BasketState.ERROR;
  }
}

export function reset(sm) {
  if (sm.timeoutId) clearTimeout(sm.timeoutId);
  if (sm.initTimeoutId) clearTimeout(sm.initTimeoutId);  // NEW
  sm.state = BasketState.FAILED;
  sm.receivedPairs.clear();
  sm.startTime = null;
  sm.timeoutId = null;
  sm.initTimeoutId = null;  // NEW
  sm.missingPairs = [];
  sm.partialData = false;
}
```

---

## Phase 3: Component Integration (5 hours)

### 3.1 Update FxBasketDisplay

**File:** `src/components/FxBasketDisplay.svelte`

**Change 1:** Update `waitForConnection()` to wait for 'READY' state

```javascript
async function waitForConnection() {
  // Wait for READY state (not just 'connected')
  if (connectionManager.state === 'READY') {
    console.log('[FX BASKET] Already ready');
    return;
  }

  console.log('[FX BASKET] Waiting for READY state...');
  return new Promise(resolve => {
    const unsubscribe = connectionManager.addStatusCallback(() => {
      if (connectionManager.state === 'READY') {
        unsubscribe();
        console.log('[FX BASKET] Connection ready!');
        resolve();
      }
    });

    setTimeout(() => {
      unsubscribe();
      console.warn('[FX BASKET] Connection timeout - proceeding anyway');
      resolve();
    }, 10000);
  });
}
```

**Change 2:** Add ERROR state handling

```javascript
function handleBasketUpdate(baskets) {
  if (stateMachine.state === BasketState.ERROR) {
    console.error('[FX BASKET] Error state - cannot display basket');
    basketData = {
      _state: BasketState.ERROR,
      _error: 'Initialization timeout - no data received'
    };
  } else {
    basketData = baskets;
  }
  renderCanvas();
}
```

### 3.2 Update ConnectionManager Import

The connectionManager.js file location may change if we decide to move it to websocket/ directory. Update imports accordingly:

```javascript
// In FxBasketDisplay.svelte
import { ConnectionManager } from '../lib/websocket/connectionManager.js';
```

---

## Testing Checklist

### Unit Tests to Create

- [ ] `requestQueue.test.js`
  - [ ] test_enqueue_when_not_ready
  - [ ] test_flush_sends_all
  - [ ] test_clear_empties_queue
  - [ ] test_multiple_enqueue_preserves_order

- [ ] `connectionManager.test.js`
  - [ ] test_state_transition
  - [ ] test_sendQueued_when_ready
  - [ ] test_sendQueued_when_not_ready
  - [ ] test_handleOpen_flushes_queue
  - [ ] test_handleOpen_notifies_before_resubscribe
  - [ ] test_resubscribeAll_sends_all

- [ ] `messageCoordinator.test.js`
  - [ ] test_subscribe_starts_timeout
  - [ ] test_onMessage_buffers
  - [ ] test_onMessage_triggers_callback
  - [ ] test_timeout_fires_without_messages
  - [ ] test_cleanup_clears_all

- [ ] `fxBasketStateMachine.test.js`
  - [ ] test_init_timeout_starts_immediately
  - [ ] test_init_timeout_transitions_to_error
  - [ ] test_data_prevents_init_timeout
  - [ ] test_collection_timeout_with_partial_data
  - [ ] test_reset_clears_timeouts

### Integration Tests to Create

- [ ] Race Condition Tests
  - [ ] test_subscribe_before_connection
  - [ ] test_subscribe_during_connection
  - [ ] test_connection_drops_with_pending_requests

- [ ] Timeout Tests
  - [ ] test_no_data_arrives_init_timeout
  - [ ] test_partial_data_collection_timeout
  - [ ] test_server_never_responds

- [ ] Load Tests
  - [ ] test_all_30_pairs_subscribe
  - [ ] test_reconnect_with_all_pairs

---

## Implementation Order

1. **Start with Phase 1.1** - Create requestQueue.js (isolated, no dependencies)
2. **Then Phase 1.2** - Modify connectionManager.js to use requestQueue
3. **Then Phase 2.1** - Enhance messageCoordinator.js
4. **Then Phase 2.2** - Enhance fxBasketStateMachine.js
5. **Then Phase 3** - Update FxBasketDisplay.svelte
6. **Finally** - Create tests for each module

---

## Verification Steps

After implementation:

1. Start dev server: `npm run dev`
2. Open FX Basket display (Alt+B)
3. Verify "Waiting for FX data..." progresses to actual basket display
4. Check console for "[QUEUE] Flushing X requests" message
5. Check console for "[SM] Init timeout started" message
6. Test with slow connection (add artificial delay)
7. Test with server not responding (should timeout to ERROR state)
8. Test reconnection (should resubscribe all pairs)

---

## Rollback Plan

If issues arise:

1. Revert `src/lib/websocket/requestQueue.js` (delete file)
2. Revert `src/lib/websocket/connectionManager.js` to original
3. Revert `src/lib/websocket/messageCoordinator.js` to original
4. Revert `src/lib/fxBasket/fxBasketStateMachine.js` to original
5. Revert `src/components/FxBasketDisplay.svelte` to original

Git commits should be structured to allow selective rollback:
- Commit 1: Add requestQueue.js (can be reverted independently)
- Commit 2: Modify connectionManager.js
- Commit 3: Enhance messageCoordinator.js
- Commit 4: Enhance fxBasketStateMachine.js
- Commit 5: Update FxBasketDisplay.svelte
