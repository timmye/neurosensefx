# Backend Connection Management - Assessment & Solution Options

**Date:** 2026-02-03
**Status:** Architect Review Complete | Implementation Decision Pending
**Reference:** Generated via codebase-analysis skill + Architect agent review

---

## Executive Summary

**ARCHITECT REVIEW FINDING:** The proposed solutions (Options A-D) treat **symptoms, not root causes**. The fundamental issue is an **unnecessary abstraction layer** (`libs/cTrader-Layer/`) that violates Crystal Clarity's "Framework-First" principle.

**RECOMMENDATION:** Skip patch-based options. Execute **Framework-First Refactor** that removes the abstraction layer entirely.

**Impact:** Net **-110 lines** (reduction) vs. +43 lines for best patch option.

---

## Problem Statement

Backend connections do not have reliable management:
- Connection drops without reconnection
- Silent failures with unknown cause
- No clear detection of socket-layer issues

---

## Critical Issues Identified (Symptoms)

| Issue | Severity | Location | Impact |
|-------|----------|----------|--------|
| **Silent socket failures** | P0 | `CTraderSocket.ts` | Network drops undetected for >60s |
| **Event propagation failure** | P0 | `CTraderConnection.ts:#onClose()` | Silent no-op, no events emitted |
| **Unhandled HealthMonitor events** | P1 | `WebSocketServer.js` | `stale`/`tick_resumed` emitted but never handled |
| **No TCP keepalive** | P1 | `CTraderSocket.ts` | No protection against idle connection drops |
| **No socket read timeout** | P2 | `CTraderConnection.ts` | Hanging connections not detected |
| **Custom heartbeat complexity** | P2 | `CTraderSession.js` | Replaces native WebSocket ping/pong |

---

## ROOT CAUSE ANALYSIS (Architect Assessment)

### Root Cause #1: Inappropriate Abstraction Layer

`libs/cTrader-Layer/` creates unnecessary wrapper around Node.js native TLS sockets:

```typescript
// CTraderSocket.ts (53 lines) - Thin wrapper with NO added value
export class CTraderSocket {
    public onOpen(): void { /* Silence is golden */ }
    public onClose(): void { /* Silence is golden */ }
    public onError(): void { /* Silence is golden */ }
}
```

**Framework-First violation:** This wrapper *removes* functionality by swallowing events.

### Root Cause #2: Event Chain Broken by Design

```
tls.TLSSocket → CTraderSocket (no-op handlers) → CTraderConnection (silent #onClose) → CTraderSession
```

Each layer breaks event propagation - "event cascade failure" pattern.

### Root Cause #3: HealthMonitor Architecture Mismatch

`HealthMonitor` emits events that are never wired:
```javascript
// Emits but nobody listens:
this.emit('stale', { session: this.sessionName });
this.emit('tick_resumed', { session: this.sessionName });
```

### Root Cause #4: Connection Lifecycle Confusion

Three concerns conflated without clear separation:
1. **Socket lifecycle** (TLS connection state)
2. **Authentication state** (cTrader protocol auth)
3. **Data staleness** (application-level health)

---

## Originally Proposed Options (Now Considered Patches)

### Option A: Minimal Fix (Patch Critical Gaps)
**T-Shirt:** XS | **Lines:** ~45 | **Assessment:** Treating symptoms only

### Option B: Robust Connection Management
**T-Shirt:** S | **Lines:** ~90 | **Assessment:** Better detection, but doesn't fix root cause

### Option B+D: Combined Framework-First (Previously Recommended)
**T-Shirt:** XS | **Lines:** ~43 | **Assessment:** Best of patches, but incomplete

### Option C: Full Connection State Machine
**T-Shirt:** M | **Lines:** ~200 | **Assessment:** Over-engineering

### Option D: Framework-First Heartbeat
**T-Shirt:** XS | **Lines:** ~10 | **Assessment:** Correct direction, but not enough

---

## ARCHITECT RECOMMENDED: Framework-First Refactor

### Concept

Remove the abstraction layer entirely. Use native `tls` and `EventEmitter` directly in `CTraderSession.js`. Treat cTrader-Layer as protocol utility library only.

### Architecture Change

```
BEFORE (Broken):
┌─────────────────────────────────────────────────────────────┐
│  CTraderSession                                             │
│    └─→ CTraderConnection (157 lines, wrapper)               │
│          └─→ CTraderSocket (53 lines, silent handlers)      │
│                └─→ tls.connect() (native)                   │
└─────────────────────────────────────────────────────────────┘

AFTER (Framework-First):
┌─────────────────────────────────────────────────────────────┐
│  CTraderSession (~120 lines)                                │
│    ├─→ tls.connect() (direct, native)                      │
│    ├─→ CTraderProtocol (protobuf utility only)             │
│    └─→ HealthMonitor (wired events)                        │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Changes

| Component | Change | Lines |
|-----------|--------|-------|
| `CTraderSocket.ts` | **DELETE** | -53 |
| `CTraderConnection.ts` | Simplify to protocol utility only | -100 |
| `CTraderSession.js` | Direct socket management | +80 |
| WebSocketServer | Wire HealthMonitor events | +15 |
| HealthMonitor | Reduce threshold to 30s | +3 |
| **Net Change** | | **-110 lines** |

### Sample Code (Framework-First Approach)

```javascript
// CTraderSession.js - Direct framework usage
class CTraderSession extends EventEmitter {
    async connect() {
        const socket = tls.connect({
            host: process.env.HOST,
            port: Number(process.env.PORT),
            // Framework-First socket options:
            keepAlive: true,
            keepAliveInitialDelay: 10000,
        });

        // Direct event handling - no broken abstraction chain
        socket.on('connect', () => this.handleConnect());
        socket.on('close', () => this.handleDisconnect());
        socket.on('error', (err) => this.handleError(err));
        socket.on('data', (data) => this.handleData(data));

        this.socket = socket;
        this.protocol = new CTraderProtocol();
    }

    handleDisconnect() {
        this.emit('disconnected');
        this.healthMonitor.stop();
        if (this.shouldReconnect) {
            this.reconnection.scheduleReconnect(() => this.connect());
        }
    }
}
```

---

## Alternative Architectural Approaches

### Alt 1: Unified Connection Manager Pattern
**Crystal Score:** 9/10 | Apply frontend's modular pattern to backend

Frontend already has Crystal Clarity aligned connection management:
- `ConnectionHandler` (72 lines)
- `ReconnectionHandler` (41 lines)
- `SubscriptionManager` (108 lines)
- `ConnectionManager` (118 lines)

**Could** be shared between frontend/backend.

### Alt 2: Event-Driven Architecture with Event Bus
**Crystal Score:** 5/10 | Adds abstraction, not Framework-First

Keep EventEmitter but add centralized event bus with explicit lifecycle management.

### Alt 3: State Machine-Based Connection Management
**Crystal Score:** 6/10 | Maintainable but not Simple

Explicit states: `DISCONNECTED → CONNECTING → AUTHENTICATED → STREAMING`

### Alt 4: Minimal Patch to cTrader-Layer
**Crystal Score:** 8/10 | Simple but doesn't address broader issues

Make handlers assignable instead of empty no-ops.

### Alt 5: Replace cTrader-Layer with Direct WebSocket
**Crystal Score:** 10/10 | Eliminate abstraction entirely

Use native Node.js `tls` + `protobufjs` directly.

---

## Crystal Clarity Compliance Comparison

| Metric | Option A | Option B | Option B+D | Option C | **Framework-First Refactor** |
|--------|----------|----------|------------|----------|------------------------------|
| **Lines Added** | +45 | +90 | +43 | +200 | **-110 (net reduction)** |
| **T-Shirt Size** | XS | S | XS | M | **XS** |
| **Simple** | ⚠️ Patches on broken foundation | ❌ Adds monitoring complexity | ✅ Good | ❌ Over-engineered | **✅ Excellent** |
| **Performant** | ✅ No change | ⚠️ Monitoring overhead | ✅ Native ping/pong | ⚠️ State machine overhead | **✅ Native framework** |
| **Maintainable** | ❌ Tech debt remains | ⚠️ More code to maintain | ✅ Less custom code | ❌ New abstraction | **✅ Removes abstraction** |
| **Framework-First** | ❌ Custom patterns | ❌ Custom patterns | ✅ Uses native ping/pong | ❌ Custom state machine | **✅ Pure framework** |

---

## Implementation Phases (Framework-First Refactor)

### Phase 1: Direct Socket Integration (Critical Path)
- Refactor `CTraderSession.js` to use `tls.connect()` directly
- Move protobuf utilities from cTrader-Layer to tick-backend
- Wire HealthMonitor events properly
- **Estimate:** ~80 lines changed, P0

### Phase 2: Remove Abstraction Layer
- Delete `CTraderSocket.ts` (53 lines)
- Simplify `CTraderConnection.ts` to protocol utilities only
- Update all imports
- **Estimate:** ~60 lines changed, P1

### Phase 3: Add Native Socket Options
- TCP keepalive
- Socket read timeout
- Native ping/pong (if cTrader supports it)
- **Estimate:** ~10 lines added, P1

### Phase 4: User-Visible Status
- Broadcast stale/tick_resumed to frontend
- Update status display components
- **Estimate:** ~20 lines added, P2

---

## Critical Files for Implementation

| File | Current Role | Target Role | Reason for Change |
|------|--------------|-------------|-------------------|
| `services/tick-backend/CTraderSession.js` | Uses cTrader-Layer wrapper | Direct socket management | Root cause location |
| `libs/cTrader-Layer/src/core/CTraderConnection.ts` | Connection abstraction | Protocol utility only | Remove socket management |
| `libs/cTrader-Layer/src/core/sockets/CTraderSocket.ts` | Socket wrapper | **DELETE** | Adds no value, breaks events |
| `services/tick-backend/WebSocketServer.js` | Event orchestration | Add stale event handlers | Wire orphaned events |
| `services/tick-backend/HealthMonitor.js` | Staleness detection | Wire events to sessions | Events currently orphaned |

---

## Frontend Connection Pattern (Reference)

**Location:** `src/lib/connection/`

Frontend already implements Crystal Clarity aligned pattern:
- `ConnectionHandler.js` (72 lines) - WebSocket lifecycle
- `ReconnectionHandler.js` (41 lines) - Exponential backoff
- `SubscriptionManager.js` (108 lines) - Message dispatch
- `ConnectionManager.js` (118 lines) - Facade orchestrator

**Pattern:** Callback-based (not EventEmitter), Framework-First

---

## Decision Matrix

| Approach | Lines | T-Shirt | Crystal Score | Risk | Recommendation |
|----------|-------|---------|---------------|------|----------------|
| Option A: Minimal Patch | +45 | XS | 6/10 | Low | Patch only |
| Option B: Robust | +90 | S | 7/10 | Low-Med | Better patch |
| Option B+D: Combined | +43 | XS | 8/10 | Low | Best patch |
| Option C: State Machine | +200 | M | 4/10 | Medium | Over-engineered |
| **Framework-First Refactor** | **-110** | **XS** | **10/10** | **Low** | **✅ RECOMMENDED** |
| Alt 1: Unified Pattern | -50 | XS | 9/10 | Low | Good alternative |
| Alt 5: Replace cTrader-Layer | -150 | XS | 10/10 | Medium | Most aggressive |

---

## Recommendation

**SKIP Options A-D. Execute Framework-First Refactor.**

**Rationale:**
1. The abstraction layer is the root cause
2. Options A-D are patches on symptoms
3. Refactor is smaller than any option (+43 vs -110 lines)
4. Framework-First compliance achieved
5. Testing becomes simpler with fewer layers

---

## Files Referenced

**Backend (to refactor):**
| File | Lines | Purpose |
|------|-------|---------|
| `services/tick-backend/CTraderSession.js` | 210 | cTrader connection orchestration |
| `services/tick-backend/TradingViewSession.js` | 188 | TradingView WebSocket client |
| `services/tick-backend/WebSocketServer.js` | 215 | Client-facing WebSocket server |
| `services/tick-backend/utils/ReconnectionManager.js` | 53 | Exponential backoff logic |
| `services/tick-backend/HealthMonitor.js` | 44 | Staleness detection |

**cTrader-Layer (to remove/simplify):**
| File | Lines | Purpose |
|------|-------|---------|
| `libs/cTrader-Layer/src/core/CTraderConnection.ts` | 157 | Connection wrapper (to simplify) |
| `libs/cTrader-Layer/src/core/sockets/CTraderSocket.ts` | 53 | Socket wrapper (to delete) |

**Frontend (reference pattern):**
| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/connection/connectionHandler.js` | 72 | WebSocket lifecycle |
| `src/lib/connection/reconnectionHandler.js` | 41 | Reconnection logic |
| `src/lib/connection/subscriptionManager.js` | 108 | Message routing |
| `src/lib/connectionManager.js` | 118 | Facade orchestrator |

---

## Next Steps

1. ✅ Document assessment (this file)
2. ✅ Architect agent review completed
3. ✅ Alternative approaches explored
4. ⏳ User decision on implementation approach
5. ⏳ Implement approved solution

---

**Last Updated:** 2026-02-03 (Architect review incorporated)
