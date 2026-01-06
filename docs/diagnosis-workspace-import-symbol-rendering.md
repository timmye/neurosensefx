# Diagnosis: WebSocket Subscription Lifecycle Race Condition

**Document Version**: 1.1 (REVISED)
**Date**: 2026-01-06
**Status**: DIAGNOSIS REVISED PER DECISION-CRITIC REVIEW
**Severity**: HIGH - Core functionality broken

**Revision History**:
- v1.1: Expanded scope beyond import, added callback cleanup, addressed memory leak risks
- v1.0: Initial diagnosis focused on workspace import

---

## Executive Summary

When multiple symbols are subscribed simultaneously (via workspace import OR manual addition), only a subset receives data. The root cause is a **systemic WebSocket lifecycle race condition**: subscriptions created while WebSocket is not OPEN are stored but never requested. This affects all subscription paths, not just workspace import.

**Impact**: Users cannot reliably restore workspaces or add symbols during WebSocket connection transitions. The refresh button does not resolve the issue.

**Scope**: This is NOT an import-specific bug—it affects ANY `subscribeAndRequest()` call during CONNECTING state, including manual symbol addition.

---

## Visual Diagnosis

### Overview: The Race Condition

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         THE BROKEN FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User Action (Import 12 symbols)                                           │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │ Svelte Reacts:  │                                                        │
│  │ All components  │                                                        │
│  │ mount at once   │                                                        │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────┐                                               │
│  │ WebSocket State:        │                                               │
│  │ CONNECTING (0)          │◄── RACE WINDOW                                │
│  └────────┬────────────────┘                                               │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────┐                                   │
│  │ subscribeAndRequest() called 12x    │                                   │
│  │                                     │                                   │
│  │  ✓ Callbacks stored in Set         │                                   │
│  │  ✗ NO data requests sent           │  ← THE GAP                         │
│  │    (only sends if OPEN)            │                                   │
│  └────────┬────────────────────────────┘                                   │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────┐                                               │
│  │ WebSocket opens (OPEN)  │                                               │
│  └────────┬────────────────┘                                               │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────┐                                   │
│  │ onopen handler fires:               │                                   │
│  │  ✓ Status updated                  │                                   │
│  │  ✗ NO subscription replay          │  ← MISSING FIX                     │
│  └────────┬────────────────────────────┘                                   │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────┐                                   │
│  │ RESULT:                             │                                   │
│  │  • 4-6 symbols have data (lucky)    │                                   │
│  │  • 6-8 symbols show "No data"       │                                   │
│  │  • Refresh button doesn't fix      │                                   │
│  └─────────────────────────────────────┘                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Memory Leak: The Accumulating Callbacks Problem

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MEMORY LEAK ON RECONNECT                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Session Start:     subscriptions = 0 callbacks                             │
│                     │                                                        │
│                     ▼                                                        │
│  User adds 10 symbols → subscriptions = 10 callbacks ✓                      │
│                     │                                                        │
│                     ▼                                                        │
│  ┌───────────────────────────────────────────────────────────────────┐     │
│  │ WebSocket disconnects (network loss)                              │     │
│  │                                                                   │     │
│  │  onclose handler:                                                 │     │
│  │   ✓ Status = 'disconnected'                                       │     │
│  │   ✗ subscriptions NOT CLEARED  ← MEMORY LEAK                     │     │
│  └───────────────────────────┬───────────────────────────────────────┘     │
│                             │                                                  │
│                             ▼                                                  │
│  WebSocket reconnects                                                          │
│                             │                                                  │
│                             ▼                                                  │
│  Components re-subscribe → subscriptions = 20 callbacks (10 stale + 10 new)  │
│                             │                                                  │
│                             ▼                                                  │
│  ┌───────────────────────────────────────────────────────────────────┐     │
│  │ PROBLEMS:                                                         │     │
│  │  • Stale callbacks receive messages (duplicates)                  │     │
│  │  • Memory grows with each reconnect                               │     │
│  │  • Potential errors from unmounted components                     │     │
│  └───────────────────────────────────────────────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### All Subscription Paths Affected

```
                              ┌──────────────────┐
                              │   USER ACTIONS   │
                              └────────┬─────────┘
                                       │
                  ┌────────────────────┼────────────────────┐
                  │                    │                    │
                  ▼                    ▼                    ▼
           ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
           │   IMPORT    │      │  MANUAL ADD │      │  RECONNECT  │
           │  Workspace  │      │  (Alt+A/T)  │      │   Event     │
           └──────┬──────┘      └──────┬──────┘      └──────┬──────┘
                  │                    │                    │
                  └────────────────────┼────────────────────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │ Svelte Reactivity│
                              │ Component Mount  │
                              └────────┬─────────┘
                                       │
                                       ▼
                        ┌──────────────────────────┐
                        │ connectionManager.       │
                        │ subscribeAndRequest()    │
                        └────────┬─────────────────┘
                                 │
                                 ▼
                      ┌─────────────────────┐
                      │ WebSocket.OPEN?     │
                      └────┬────────────┬────┘
                           │ YES         │ NO
                           ▼             ▼
                   ┌──────────┐    ┌──────────┐
                   │ Request  │    │ Store    │
                   │ sent ✓   │    │ only ✗   │
                   └──────────┘    └──────────┘
                                        │
                                        ▼
                                  ┌─────────┐
                                  │ GAP: No │
                                  │ replay  │
                                  │ on open │
                                  └─────────┘
```

### Proposed Solution: The Fix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        THE FIXED FLOW (Solutions 1+2+3)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User Action (Import 12 symbols)                                           │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │ Svelte Reacts:  │                                                        │
│  │ All components  │                                                        │
│  │ mount at once   │                                                        │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────┐                                               │
│  │ WebSocket State:        │                                               │
│  │ CONNECTING (0)          │◄── RACE WINDOW                                │
│  └────────┬────────────────┘                                               │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────┐                                   │
│  │ subscribeAndRequest() called 12x    │                                   │
│  │                                     │                                   │
│  │  ✓ Callbacks stored in Set         │                                   │
│  │  ✗ NO data requests sent           │  ← Expected (not OPEN yet)        │
│  └────────┬────────────────────────────┘                                   │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────┐                                               │
│  │ WebSocket opens (OPEN)  │                                               │
│  └────────┬────────────────┘                                               │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ onopen handler (SOLUTION 1):                                         │   │
│  │  ✓ Status updated                                                  │   │
│  │  ✓ Iterate ALL stored subscriptions                                │   │
│  │  ✓ Send data request for each                                      │   │
│  │    → 12 requests sent                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────┐                                   │
│  │ RESULT:                             │                                   │
│  │  ✓ All 12 symbols receive data      │                                   │
│  │  ✓ User can refresh any symbol      │                                   │
│  │    (Solution 3: hard refresh)       │                                   │
│  │  ✓ No memory leak on reconnect      │                                   │
│  │    (Solution 2: cleanup on close)   │                                   │
│  └─────────────────────────────────────┘                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Solution Comparison

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SOLUTION COMPARISON                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ SOLUTION 1: Subscription Replay on Open                              │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ What:  Add forEach loop in onopen to request data for all subs      │   │
│  │ Where: connectionManager.js, line ~28                               │   │
│  │ Lines:  <15                                                          │   │
│  │ Impact: HIGH - Fixes root cause for ALL paths                       │   │
│  │ Risk:  LOW - Simple additive change                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ SOLUTION 2: Cleanup on Close (Memory Leak Fix)                      │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ What:  Add onclose handler to clear subscriptions Map               │   │
│  │ Where: connectionManager.js, add after onopen                       │   │
│  │ Lines:  <10                                                          │   │
│  │ Impact: HIGH - Prevents memory leak and duplicates                   │   │
│  │ Risk:  LOW - Components will re-subscribe naturally                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ SOLUTION 3: Hard Refresh (User Recovery)                            │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ What:  Force unsubscribe, clear data, re-subscribe                  │   │
│  │ Where: FloatingDisplay.svelte, handleRefresh()                      │   │
│  │ Lines:  <20                                                          │   │
│  │ Impact: HIGH - Works in ANY connection state                        │   │
│  │ Risk:  LOW - Replaces existing weak refresh                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ SOLUTION 4: Request Queue (Alternative)                             │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ What:  Queue requests when not OPEN, flush on open                  │   │
│  │ Where: connectionManager.js, throughout                             │   │
│  │ Lines:  ~30                                                          │   │
│  │ Impact: HIGH - More explicit than replay                            │   │
│  │ Risk:  LOW-MED - More complex, clearer separation                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### WebSocket Lifecycle and Missing Hooks

```
                    WEBSOCKET STATE TRANSITIONS

    CONNECTING (0)          OPEN (1)           CLOSING (2)         CLOSED (3)
    ┌─────────┐           ┌─────────┐        ┌─────────┐         ┌─────────┐
    │         │   Event   │         │ Event  │         │  Event  │         │
    │ onopen  │──────────▶│         │───────▶│         │────────▶│ onclose │
    │ handler │           │ (ready) │        │onclose  │         │ handler │
    │         │           │         │        │handler  │         │         │
    └─────────┘           └─────────┘        └─────────┘         └─────────┘
         │                      │                                       │
         │                      │                                       │
         ▼                      ▼                                       ▼
  ┌──────────────────┐  ┌──────────────────┐               ┌──────────────────┐
  │ CURRENT:         │  │ CURRENT:         │               │ CURRENT:         │
  │ • Status update  │  │ • Status update  │               │ • Status update  │
  │ • Callback fire  │  │ • Callback fire  │               │ • Callback fire  │
  │ ✗ No replay     │  │ ✗ No cleanup     │               │ ✗ No cleanup     │
  └──────────────────┘  └──────────────────┘               └──────────────────┘
         │                      │                                       │
         ▼                      ▼                                       ▼
  ┌──────────────────┐  ┌──────────────────┐               ┌──────────────────┐
  │ SOLUTION 1:      │  │ (No change       │               │ SOLUTION 2:      │
  │ • Add forEach    │  │  needed here)    │               │ • Clear subs Map │
  │   replay subs    │  │                  │               │ • Clear adr Map  │
  └──────────────────┘  └──────────────────┘               └──────────────────┘
```

---

## Problem Statement

### Observed Behavior
1. **Scenario A (Import)**: User imports workspace with 12+ symbols → only some render
2. **Scenario B (Manual)**: User adds symbols while WebSocket is CONNECTING → symbols never load
3. **Scenario C (Reconnect)**: WebSocket disconnects and reconnects during session → some symbols lost
4. **Refresh button** on affected displays does not fix the issue

### Expected Behavior
All subscribed symbols should receive data regardless of WebSocket lifecycle timing.

---

## Root Cause Analysis

### PRIMARY ROOT CAUSE: WebSocket State Race Condition

**Location**: `src/lib/connectionManager.js:86-113`

**Issue Description**:

The `subscribeAndRequest()` method stores subscriptions but only sends data requests when `WebSocket.readyState === OPEN`. This creates a gap where subscriptions can be created during CONNECTING/CLOSING states but are never requested.

```javascript
subscribeAndRequest(symbol, callback, adr = 14, source = 'ctrader') {
  const key = this.makeKey(symbol, source);

  if (!this.subscriptions.has(key)) {
    this.subscriptions.set(key, new Set());
    this.subscriptionAdr.set(key, adr);
  }

  const callbacks = this.subscriptions.get(key);
  callbacks.add(callback);  // Callback stored

  // CRITICAL FLAW: Only sends request if WebSocket is OPEN
  if (this.ws?.readyState === WebSocket.OPEN) {
    this.ws.send(JSON.stringify({
      type: 'get_symbol_data_package',
      symbol,
      adrLookbackDays: adr,
      source
    }));
  }
  // PROBLEM: If CONNECTING/CLOSING, subscription stored but NO request sent
  // PROBLEM: No mechanism exists to request data later when connection opens
}
```

**Race Condition Timeline**:

| Time | WebSocket State | Action | Result |
|------|-----------------|--------|--------|
| T0 | CONNECTING | Import triggers 12 component mounts | Subscriptions stored, no requests |
| T1 | OPEN | Connection established | No automatic replay of subscriptions |
| T2 | OPEN | - | Only symbols that subscribed during OPEN have data |

**Missing Mechanisms**:

1. **No subscription replay on `onopen`**: Stored subscriptions are not iterated and requested when connection opens
2. **No request queueing**: No pending request queue that flushes on connection
3. **No callback cleanup on disconnect**: Callbacks accumulate across reconnects, causing memory leaks

### SECONDARY ROOT CAUSES

#### 1. Missing WebSocket Close Handler (MEMORY LEAK)

**Location**: `src/lib/connectionManager.js`

**Issue**: The `onclose` handler does not clean up `this.subscriptions` Set. When WebSocket disconnects and reconnects, old callbacks persist and new callbacks are added, causing:
- Memory leak from accumulating callbacks
- Potential duplicate message processing
- Stale callbacks receiving messages after component unmount

```javascript
// MISSING: Cleanup on close
this.ws.onclose = () => {
  console.log('[CONNECTION_MANAGER] WebSocket closed');
  this.connectionStatus = 'disconnected';

  // Should be: this.subscriptions.clear(); this.subscriptionAdr.clear();
};
```

#### 2. Refresh Button Doesn't Hard Refresh

**Location**: `src/components/FloatingDisplay.svelte:84-91`

```javascript
function handleRefresh() {
  if (canvasRef?.refreshCanvas) canvasRef.refreshCanvas();
  if (connectionStatus === 'connected') {  // Only works if connected
    connectionManager.resubscribeSymbol(formattedSymbol);
  } else if (connectionStatus === 'disconnected') {
    refreshConnection();
  }
  // PROBLEM: Doesn't handle 'connecting' state
  // PROBLEM: Doesn't force re-subscription, only re-requests
}
```

**Problems**:
- Only triggers if `connectionStatus === 'connected'`
- Won't work for symbols that never got data (exact failure scenario)
- Doesn't create fresh subscription—only re-requests data

#### 3. No Retry Mechanism

If a data request fails (timeout, backend error), there's no retry logic. Failed subscriptions remain failed permanently.

#### 4. Silent Data Format Mismatches

**Location**: `src/lib/displayDataProcessor.js:48-64`

```javascript
} : data.type === 'tick' && data.symbol === formattedSymbol ? {
```

Strict equality check means "EURUSD" won't match "EUR/USD" from backend. Ticks are silently dropped.

---

## Architecture Assessment

### Code Quality Issues

| File | Lines | Limit | Status | Issue |
|------|-------|-------|--------|-------|
| `connectionManager.js` | 279 | 120 | FAIL | Exceeds limit, too many responsibilities |
| `workspace.js` | 279 | 120 | FAIL | Exceeds limit, mixed concerns |

### Architectural Violations

1. **Single Responsibility Principle**: `connectionManager.js` handles WebSocket connection, subscription management, message routing, AND connection status
2. **Framework-First Violation**: Custom subscription management instead of leveraging framework features
3. **Missing Error Boundaries**: No error recovery mechanisms for failed subscriptions
4. **Silent Failures**: Data rejection without user feedback
5. **Lifecycle Mismatch**: Svelte's reactive lifecycle (synchronous, microtask) vs WebSocket (async, network event)

### Dependency Chain (All Subscription Paths)

```
ANY Subscription Trigger
    ├── Workspace Import → workspaceStore.update() → FloatingDisplay.onMount()
    ├── Manual Add (Alt+A/T) → keyboardHandler → addDisplay()
    └── Programmatic Add → workspaceActions.addDisplay()
        ↓
    connectionManager.subscribeAndRequest()
        ↓
    WebSocket.OPEN check
        ↓
    RACE CONDITION (if not OPEN)
```

---

## Proposed Solutions

### Solution 1: Subscription Replay on Connection Open (CRITICAL FIX)

**File**: `src/lib/connectionManager.js`
**Lines**: ~18-28 (onopen handler)
**Complexity**: LOW (<15 lines)
**Impact**: HIGH - Fixes root cause for ALL subscription paths

```javascript
this.ws.onopen = () => {
  console.log('[CONNECTION_MANAGER] WebSocket connected');
  this.connectionStatus = 'connected';
  this.connectionCallbacks.forEach(cb => cb('connected'));

  // FIX: Replay all stored subscriptions
  this.subscriptions.forEach((callbacks, key) => {
    const [symbol, source] = key.split(':');
    const adr = this.subscriptionAdr.get(key) || 14;

    // Send data request for each subscription
    this.ws.send(JSON.stringify({
      type: 'get_symbol_data_package',
      symbol,
      adrLookbackDays: adr,
      source
    }));

    console.log(`[CONNECTION_MANAGER] Replayed subscription: ${key}`);
  });
};
```

**Note**: This fix addresses ALL subscription paths, not just import.

### Solution 2: Add WebSocket Close Handler (MEMORY LEAK FIX)

**File**: `src/lib/connectionManager.js`
**Lines**: Add after onopen handler
**Complexity**: LOW (<10 lines)
**Impact**: HIGH - Prevents memory leak and duplicate callbacks

```javascript
this.ws.onclose = () => {
  console.log('[CONNECTION_MANAGER] WebSocket closed');
  this.connectionStatus = 'disconnected';
  this.connectionCallbacks.forEach(cb => cb('disconnected'));

  // FIX: Clear stale callbacks to prevent memory leak
  this.subscriptions.clear();
  this.subscriptionAdr.clear();

  console.log('[CONNECTION_MANAGER] Cleared subscriptions on close');
};
```

**Rationale**: Components will re-subscribe on re-mount or via explicit refresh. Clearing ensures:
1. No memory leak from accumulating callbacks
2. No duplicate message processing
3. Clean state for reconnection

### Solution 3: Hard Refresh Implementation (WORKS IN ANY STATE)

**File**: `src/components/FloatingDisplay.svelte`
**Lines**: 84-91
**Complexity**: LOW (<20 lines)
**Impact**: HIGH - User recovery mechanism for any connection state

```javascript
function handleRefresh() {
  if (connectionManager) {
    // Unsubscribe from current (clears callback from Set)
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    // Clear existing data
    lastData = null;
    lastMarketProfileData = null;

    // Force fresh subscription regardless of connection state
    // subscribeAndRequest will queue request if not OPEN
    unsubscribe = connectionManager.subscribeAndRequest(
      formattedSymbol,
      (data) => {
        try {
          const result = processSymbolData(data, formattedSymbol, lastData);
          if (result?.type === 'data') {
            lastData = result.data;
            if (canvasRef) canvasRef.render();
          }
          // Market profile processing...
        } catch (error) {
          canvasRef?.renderError(`JSON_PARSE_ERROR: ${error.message}`);
        }
      },
      14,
      source
    );

    console.log(`[REFRESH] Hard re-subscribed to ${formattedSymbol}`);
  }

  if (canvasRef?.refreshCanvas) canvasRef.refreshCanvas();
}
```

**Key Improvement**: Works in ANY connection state (disconnected, connecting, connected) because it creates a fresh subscription that will be replayed when WebSocket opens (if Solution 1 is implemented).

### Solution 4: Request Queue Pattern (ALTERNATIVE APPROACH)

**File**: `src/lib/connectionManager.js`
**Complexity**: MEDIUM
**Impact**: HIGH - More robust than replay, handles edge cases

Instead of replaying stored subscriptions on open, queue requests when not OPEN and flush on connection:

```javascript
constructor() {
  // ... existing code ...
  this.requestQueue = new Map(); // symbol:source -> {callback, adr}
}

subscribeAndRequest(symbol, callback, adr = 14, source = 'ctrader') {
  const key = this.makeKey(symbol, source);

  // Store callback
  if (!this.subscriptions.has(key)) {
    this.subscriptions.set(key, new Set());
  }
  this.subscriptions.get(key).add(callback);

  // Queue or send request
  if (this.ws?.readyState === WebSocket.OPEN) {
    this.ws.send(JSON.stringify({
      type: 'get_symbol_data_package',
      symbol,
      adrLookbackDays: adr,
      source
    }));
  } else {
    // Queue request for later
    this.requestQueue.set(key, { symbol, adr, source });
    console.log(`[CONNECTION_MANAGER] Queued request: ${key}`);
  }
}

// In onopen handler:
this.ws.onopen = () => {
  // ... existing code ...

  // Flush request queue
  this.requestQueue.forEach((request, key) => {
    this.ws.send(JSON.stringify({
      type: 'get_symbol_data_package',
      symbol: request.symbol,
      adrLookbackDays: request.adr,
      source: request.source
    }));
    console.log(`[CONNECTION_MANAGER] Sent queued request: ${key}`);
  });
  this.requestQueue.clear();
};
```

**Tradeoff**: More complex than Solution 1 but clearer separation of concerns (subscriptions vs requests).

### Solution 5: Import Completion Handler (OPTIONAL)

**File**: `src/stores/workspace.js`
**Lines**: 164-193
**Complexity**: MEDIUM
**Impact**: LOW-MEDIUM - Convenience, not required with Solutions 1-3

```javascript
importWorkspace: async (file) => {
  const text = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });

  const data = JSON.parse(text);

  if (data.priceMarkers) {
    for (const [key, value] of Object.entries(data.priceMarkers)) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  workspaceStore.update(state => ({
    ...state,
    displays: new Map(data.workspace.displays || []),
    nextZIndex: data.workspace.nextZIndex || 1
  }));

  // OPTIONAL: Trigger explicit subscription if connected
  // NOTE: This is redundant if Solution 1 is implemented
  await tick();
  const cm = ConnectionManager.getInstance();
  if (cm?.ws?.readyState === WebSocket.OPEN) {
    for (const [id, display] of workspaceStore.getState().displays) {
      const symbol = formatSymbol(display.symbol);
      const source = display.source || 'ctrader';
      cm.resubscribeSymbol(symbol, source);
    }
  }
}
```

**Note**: With Solution 1 implemented (subscription replay), this solution is redundant. Kept for backward compatibility or if Solution 1 is not implemented.

---

## Implementation Priority

| Priority | Solution | Complexity | Impact | Risk | Required |
|----------|----------|------------|--------|------|----------|
| **P0** | Solution 1: Subscription Replay | LOW | HIGH | LOW | YES |
| **P0** | Solution 2: Close Handler Cleanup | LOW | HIGH | LOW | YES |
| **P0** | Solution 3: Hard Refresh | LOW | HIGH | LOW | YES |
| P2 | Solution 4: Request Queue | MEDIUM | HIGH | LOW | Alternative to 1 |
| P3 | Solution 5: Import Handler | MEDIUM | LOW | LOW | Optional |

**Minimum Viable Fix**: Solutions 1 + 2 + 3

---

## Testing Strategy

### Reproduction Steps (All Scenarios)

#### Scenario A: Workspace Import
1. Create workspace with 12+ symbols
2. Export workspace
3. Disconnect WebSocket (simulate network loss)
4. Clear application state
5. Import workspace while WebSocket is CONNECTING
6. Verify all symbols render data

#### Scenario B: Manual Addition During CONNECTING
1. Start application with WebSocket disconnected
2. Initiate connection (put WebSocket in CONNECTING state)
3. Add 5 symbols via Alt+A or Alt+T
4. Wait for WebSocket to reach OPEN
5. Verify all 5 symbols render data

#### Scenario C: WebSocket Reconnect
1. Load workspace with 10 symbols (all rendering)
2. Simulate network disconnect (WebSocket closes)
3. Wait for auto-reconnect
4. Verify all 10 symbols continue rendering after reconnect

### Test Cases

| Case | Description | Expected Result |
|------|-------------|-----------------|
| TC-01 | Import with WebSocket disconnected | All symbols load when connection opens |
| TC-02 | Import with WebSocket connecting | All symbols load when connection opens |
| TC-03 | Import with WebSocket connected | All symbols load immediately |
| TC-04 | Manual add during CONNECTING | Symbol loads when connection opens |
| TC-05 | Refresh on missing symbol (disconnected) | Symbol queued, loads when connected |
| TC-06 | Refresh on missing symbol (connecting) | Symbol queued, loads when opens |
| TC-07 | Refresh on missing symbol (connected) | Symbol loads immediately |
| TC-08 | WebSocket reconnect during session | All symbols restored without user action |
| TC-09 | Memory leak after 10 reconnect cycles | No callback accumulation |
| TC-10 | Duplicate messages not processed | Each message processed once |

### Memory Leak Verification

```javascript
// In browser console after multiple reconnect cycles:
const cm = ConnectionManager.getInstance();
console.log('Callback count:', cm.subscriptions.size);
// Expected: Should be 0 or equal to active display count
// Bug: Count grows with each reconnect
```

---

## Open Questions

1. **Request Queue vs Replay**: Should we implement Solution 4 (queue pattern) instead of Solution 1 (replay)? Queue is more explicit but adds complexity.

2. **Reconnection Strategy**: Should we attempt to restore previous subscriptions on reconnect, or require explicit refresh?

3. **Error Indicators**: Should we add per-symbol error indicators instead of generic "No data"?

4. **Line Limit Compliance**: Implementing Solutions 1-3 will push `connectionManager.js` further over 120-line limit. Should we split this file?

---

## Decision-Critic Review Summary

**Verdict**: REVISED

**Critical Gaps Addressed**:

| Gap | Original | Revised |
|-----|----------|---------|
| Scope | Import-specific | All subscription paths |
| Memory leak | Not addressed | Close handler added |
| Hard refresh | Only works when connected | Works in any state |
| Testing | Basic import tests | Added reconnect, manual, memory leak |
| Alternative | None | Request queue pattern documented |

**Accepted Risks**:
- Request queue pattern (Solution 4) is more complex but not required for MVP
- Solution 5 (import handler) is redundant with Solution 1 but kept as optional

---

## References

**Files Analyzed**:
- `src/lib/connectionManager.js` (279 lines) - Primary fix location
- `src/stores/workspace.js` (279 lines) - Import flow
- `src/components/FloatingDisplay.svelte` (152 lines) - Refresh button
- `src/lib/displayDataProcessor.js` (103 lines) - Data processing
- `src/components/Workspace.svelte` (150 lines) - Display iteration

**Investigation Method**:
- Parallel agent exploration (agents aa246c8, a1bcb69, a97e5d5)
- Decision-critic workflow (7-step analysis)

**Related Issues**:
- Crystal Clarity line limit violations (connectionManager.js, workspace.js both 279 lines)
- Framework-First principle compliance (custom subscription management)
