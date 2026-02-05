# Backend Connection Management - Interim Patch Options

**Date:** 2026-02-05
**Status:** Patch Analysis Complete | Awaiting Implementation Decision
**Reference:** Alternative to full Framework-First Refactor in `backend-connection-management-assessment.md`

---

## Executive Summary

The full Framework-First Refactor (recommended in the assessment document) would eliminate the `cTrader-Layer` abstraction entirely. However, **interim patches** can provide immediate value with minimal risk and code changes.

**Key Finding:** The event propagation chain is already wired via `EventEmitter` - issues are simply missing `emit()` calls and forgotten handler assignments. The handlers are already assignable; no architectural changes required.

---

## Patch Options Overview

| Option | Lines | Impact | Risk | Files | Description |
|--------|-------|--------|------|-------|-------------|
| **1: Critical Event Fix** | ~8 | HIGH | Very Low | 2 | Fix silent close/error events |
| **2: HealthMonitor Wiring** | ~5 | MEDIUM | Very Low | 2 | Wire stale/tick_resumed events |
| **3: TCP Keepalive** | ~3 | LOW-MED | Very Low | 1 | Add idle connection protection |
| **4: Reconnection Visibility** | ~4 | LOW | Very Low | 1 | Show reconnection progress |
| **ALL COMBINED** | **~20** | **HIGH** | **Low** | **4** | **Immediate comprehensive fix** |

---

## Patch Option 1: Critical Event Propagation Fix

**Impact:** HIGH | **Risk:** VERY LOW | **Lines:** ~8

### Problem
`CTraderConnection` has empty no-op handlers for `close` and `error` events. The underlying socket events die silently.

### Solution

**File:** `libs/cTrader-Layer/build/src/core/CTraderConnection.js`

#### Change 1: Emit close event (line 150-151)
```javascript
// BEFORE:
_CTraderConnection_onClose = function _CTraderConnection_onClose() {
},

// AFTER:
_CTraderConnection_onClose = function _CTraderConnection_onClose() {
    this.emit('close');
},
```

#### Change 2: Add onError callback assignment (after line 58)
```javascript
// ADD after line 58 (after onClose assignment):
__classPrivateFieldGet(this, _CTraderConnection_socket, "f").onError = (err) =>
    __classPrivateFieldGet(this, _CTraderConnection_instances, "m", _CTraderConnection_onError).call(this, err);
```

#### Change 3: Add onError private method (after line 151)
```javascript
// ADD after _CTraderConnection_onClose:
_CTraderConnection_onError = function _CTraderConnection_onError(err) {
    this.emit('error', err);
},
```

### Result
`CTraderSession` receives `close` and `error` events that were previously swallowed. Existing error handlers in `CTraderSession.js` (lines 106-109) will now fire.

---

## Patch Option 2: HealthMonitor Event Wiring

**Impact:** MEDIUM | **Risk:** VERY LOW | **Lines:** ~5

### Problem
`HealthMonitor` emits `stale` and `tick_resumed` events, but nothing is listening. Frontend has no visibility into data staleness.

### Solution

**File:** `services/tick-backend/WebSocketServer.js`

#### Change 1: Wire cTrader health events (after line 52)
```javascript
// ADD in constructor after existing event handlers:
this.cTraderSession.healthMonitor.on('stale', () =>
    this.statusBroadcaster.broadcastStatus('stale', 'cTrader data stale'));
this.cTraderSession.healthMonitor.on('tick_resumed', () =>
    this.statusBroadcaster.broadcastStatus('tick_resumed', 'cTrader data resumed'));
```

#### Change 2: Wire TradingView health events (after line 52)
```javascript
// ADD:
this.tradingViewSession.healthMonitor.on('stale', () =>
    this.statusBroadcaster.broadcastStatus('stale', 'TradingView data stale'));
this.tradingViewSession.healthMonitor.on('tick_resumed', () =>
    this.statusBroadcaster.broadcastStatus('tick_resumed', 'TradingView data resumed'));
```

#### Change 3: Reduce staleness threshold (optional, 2 lines)
```javascript
// CTraderSession.js line 29 - BEFORE:
this.healthMonitor = new HealthMonitor('ctrader');

// AFTER:
this.healthMonitor = new HealthMonitor('ctrader', 30000, 10000);

// TradingViewSession.js line 27 - BEFORE:
this.healthMonitor = new HealthMonitor('tradingview');

// AFTER:
this.healthMonitor = new HealthMonitor('tradingview', 30000, 10000);
```

### Result
- Frontend receives stale data alerts
- Detection time halved (60s → 30s)
- Better user awareness of connection issues

---

## Patch Option 3: TCP Keepalive

**Impact:** LOW-MEDIUM | **Risk:** VERY LOW | **Lines:** ~3

### Problem
No protection against idle connection drops at TCP layer.

### Solution

**File:** `libs/cTrader-Layer/src/core/sockets/CTraderSocket.ts` (source file)

#### Change: Add socket options (line 32)
```typescript
// BEFORE in connect() method:
const socket = tls.connect({
    host: this.#host,
    port: this.#port,
});

// AFTER:
const socket = tls.connect({
    host: this.#host,
    port: this.#port,
    keepAlive: true,
    keepAliveInitialDelay: 10000,
});
```

**Note:** After editing source file, rebuild: `npm run build` from `libs/cTrader-Layer/`

### Result
TCP layer sends keepalive probes after 10s of inactivity, preventing idle connection drops.

---

## Patch Option 4: Reconnection Visibility

**Impact:** LOW | **Risk:** VERY LOW | **Lines:** ~4

### Problem
UI cannot show reconnection progress to users during retry attempts.

### Solution

**File:** `services/tick-backend/CTraderSession.js`

#### Change: Emit reconnection state (line 141)
```javascript
// BEFORE:
scheduleReconnect() {
    this.reconnection.scheduleReconnect(() => this.connect());
}

// AFTER:
scheduleReconnect() {
    const attempt = this.reconnection.reconnectAttempts + 1;
    const delay = Math.min(
        this.reconnection.reconnectDelay * Math.pow(2, this.reconnection.reconnectAttempts),
        60000
    );
    this.emit('reconnecting', { attempt, delay });
    this.reconnection.scheduleReconnect(() => this.connect());
}
```

### Result
Frontend can display "Reconnecting... (attempt X, delay Ys)" to users.

---

## Implementation Order

Apply patches incrementally:

1. **Option 1** - Critical foundation (enables other patches to work properly)
2. **Option 2** - Adds visibility (depends on Option 1 working properly)
3. **Option 3** - Adds resilience (independent)
4. **Option 4** - UX improvement (nice-to-have)

---

## Comparison: Patches vs Full Refactor

| Metric | All Patches | Full Refactor |
|--------|-------------|---------------|
| **Lines Changed** | ~20 | ~-110 |
| **T-Shirt Size** | XXS | XS |
| **Files Modified** | 4 | 6 |
| **Files Deleted** | 0 | 1 |
| **Risk Level** | Low | Low-Medium |
| **Time to Value** | Immediate | Longer |
| **Architectural Debt** | Remains | Eliminated |
| **Testing Scope** | Focused | Broader |
| **Rollback** | Trivial | Moderate |

---

## Decision Matrix

| Factor | Patches | Full Refactor |
|--------|---------|---------------|
| **Immediate problem resolution** | ✅ Yes | ⚠️ Later |
| **Minimal risk** | ✅ Yes | ⚠️ Moderate |
| **Eliminates tech debt** | ❌ No | ✅ Yes |
| **Framework-First compliance** | ⚠️ Partial | ✅ Full |
| **Can be applied incrementally** | ✅ Yes | ❌ No |
| **Easy to rollback** | ✅ Yes | ⚠️ Moderate |

---

## Recommended Approach

### Option A: Incremental Patch-Then-Refactor
1. Apply all patches (immediate stability)
2. Monitor in production
3. Schedule refactor when convenient

### Option B: Patches Only
1. Apply patches
2. Accept architectural debt
3. Revisit if new issues arise

### Option C: Full Refactor (from assessment doc)
1. Skip patches
2. Execute Framework-First Refactor
3. Eliminate abstraction layer entirely

---

## Files Referenced

| File | Lines | Purpose |
|------|-------|---------|
| `libs/cTrader-Layer/build/src/core/CTraderConnection.js` | 157 | Connection wrapper (needs emit calls) |
| `libs/cTrader-Layer/src/core/sockets/CTraderSocket.ts` | 53 | Socket wrapper (needs keepalive) |
| `services/tick-backend/CTraderSession.js` | 210 | cTrader session orchestration |
| `services/tick-backend/TradingViewSession.js` | 188 | TradingView session |
| `services/tick-backend/WebSocketServer.js` | 215 | Client WebSocket server |
| `services/tick-backend/HealthMonitor.js` | 44 | Staleness detection |

---

## Related Documents

- `backend-connection-management-assessment.md` - Full architectural assessment with Framework-First Refactor recommendation
- `backend-connection-refactor-plan.md` - Detailed implementation plan for full refactor

---

**Last Updated:** 2026-02-05
