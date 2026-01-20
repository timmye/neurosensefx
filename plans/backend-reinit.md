# Backend Connection Reinitialization

## Overview

cTrader and TradingView connections can fail silently without proper health detection. This plan implements a hybrid solution: (1) **fix root issue** with staleness detection and unlimited auto-reconnect, and (2) **add manual reinit** so traders can force reconnection when needed.

**Key decisions**:
- Centralized `HealthMonitor` service eliminates code duplication and maintains Crystal Clarity compliance
- Remove `maxReconnects` limit to enable unlimited reconnection attempts with exponential backoff
- Add data-based staleness detection (60s timeout) to catch half-open sockets
- Manual reinit via WebSocket message provides immediate user control
- All code is Crystal Clarity compliant: functions <15 lines, files <120 lines, Framework-First primitives (EventEmitter, setInterval)

## Planning Context

This section is consumed VERBATIM by downstream agents (Technical Writer, Quality Reviewer). Quality matters: vague entries here produce poor annotations and missed risks.

### Decision Log

| Decision | Reasoning Chain |
|----------|-----------------|
| Centralized HealthMonitor over distributed approach | TradingViewSession already at 374 lines (exceeds 120-line CC limit) -> Adding 30 lines would exacerbate violation -> Centralized approach keeps all files under 120 lines -> Single source of truth reduces maintenance burden |
| Remove maxReconnects limit | Current limit (5) causes permanent silent failure after exhaustion -> Trading requires continuous connection -> Unlimited attempts with exponential backoff enable eventual recovery without manual intervention |
| 60s staleness timeout | User specified 60s after AskUserQuestion -> Conservative enough to avoid false positives during low volatility -> Aggressive enough to detect genuine issues quickly |
| Data-based staleness over heartbeat response | cTrader heartbeat sends but doesn't listen for response -> Half-open sockets can send but not receive -> Data receipt (tick events) is the only reliable liveness indicator |
| Separate staleness from connection state | Connection can be 'connected' but stale (half-open) -> Frontend needs to distinguish 'disconnected' from 'stale' -> Enables targeted troubleshooting (stale = network issue, disconnected = auth/config) |
| Three reinit buttons instead of dropdown | Traders value immediate one-click access to common actions -> Dropdown adds click friction -> Separate buttons for 'cTrader', 'tradingview', 'all' cover 99% of use cases with zero navigation |
| 30s health check interval | Balances detection speed with CPU usage -> 60s timeout means checking every 30s catches staleness within 30-60s window -> Low overhead (setInterval is cheap) |
| Manual reinit as separate message type | Existing 'subscribe'/ 'unsubscribe' messages are data operations -> Reinit is control operation affecting connection state -> Separate message type prevents semantic confusion |
| Reinit accepts 'ctrader' | 'tradingview' | 'all' | Traders may use only one data source -> Selective reinit prevents unnecessary disruption -> 'all' provides convenience for full restart |
| HealthMonitor as separate class | Staleness logic identical across sessions -> Duplicating 60 lines violates DRY and maintainability -> Centralized service is Framework-First compliant (EventEmitter, setInterval) |

### Rejected Alternatives

| Alternative | Why Rejected |
|-------------|--------------|
| Distributed health monitoring (per-session staleness) | TradingViewSession already 374 lines (exceeds CC 120-line limit) -> Adding 30 lines compounds violation -> Code duplication creates maintenance burden -> Centralized approach keeps all files compliant and single-sourced |
| Heartbeat response validation | cTrader-Library doesn't expose response events -> Would require wrapping the library -> Adds complexity without solving half-open socket detection |
| Frontend-only staleness detection | Frontend cannot distinguish 'no data' from 'no subscribers' -> Staleness would trigger incorrectly when no symbols subscribed -> Backend must track data flow to detect genuine staleness |
| Polling cTrader status endpoint | No ProtoOA status endpoint exists -> Would require subscribing to all symbols -> Prohibitively expensive for 28+ FX pairs |
| Auto-reconnect with fixed interval | Would hammer server during sustained outages -> Exponential backoff is industry standard -> Cap at 60s prevents excessive delay |
| Manual reinit via HTTP endpoint | WebSocket is already established -> Separate HTTP endpoint adds complexity -> Reusing WebSocket is simpler and consistent with data protocol |

### Constraints & Assumptions

**Technical**:
- Framework-First: EventEmitter for events, setInterval for timers, WebSocket for messaging
- Crystal Clarity: functions <15 lines, files <120 lines, direct framework usage only
- cTrader-Library: proprietary API, cannot modify or wrap meaningfully
- tradingview-ws library: third-party, limited control over connection detection

**Organizational**:
- Traders value immediate control (hence manual reinit requirement)
- Production uptime is critical (hence unlimited auto-reconnect)
- Code simplicity is prioritized (Crystal Clarity principles)

**Dependencies**:
- cTrader API: ProtoOA messages for connection, symbols, spot events
- TradingView API: chart sessions, series subscriptions
- Frontend WebSocket: existing message protocol

**Default conventions applied**:
- `<default-convention domain="file-creation">`: Create HealthMonitor.js as new module for shared staleness logic -> Sessions integrate via delegation pattern
- `<default-convention domain="error-handling">`: Emit events, don't throw for expected failures -> Staleness emits 'stale' event, doesn't crash

### Known Risks

| Risk | Mitigation | Anchor |
|------|-----------|--------|
| False positive staleness during low volatility | 60s timeout is conservative; FX pairs typically tick within seconds during market hours | `HealthMonitor.js:25` `recordTick()` - updates on every data event |
| HealthMonitor state never clears after data resumes | isStale flag tracks state; tick_resumed event signals when stale resolves | `HealthMonitor.js:38-42` - emits 'tick_resumed' when staleness clears |
| Manual reinit triggers stale events during reinit | stop() called before disconnect prevents interval from firing | `CTraderSession.js:345` `this.healthMonitor.stop()` in reconnect() |
| Infinite reconnect loop during permanent network outage | Exponential backoff with 60s cap prevents server hammering; manual reinit allows user control | (Accepted risk - backoff math is standard pattern) |
| Manual reinit button spammed by users | Button disabled during reconnection state; async processing serializes requests | `WebSocketServer.js:69` `async handleMessage(ws, message)` - async processing prevents concurrent reinit calls |
| Health check interval (30s) conflicts with cTrader heartbeat (10s) | Different purposes: cTrader heartbeat SENDS keepalive; health check READS lastTick -> no conflict | `CTraderSession.js:196-200` `startHeartbeat()` - only sends `ProtoHeartbeatEvent`, doesn't read response |
| Staleness detection fires after hours when markets closed | Traders operate during market hours; after-hours staleness is expected and not actionable | (Accepted risk - documentation will clarify market hours dependency) |
| Memory leak from setInterval not cleared | HealthMonitor.stop() called in session handleDisconnect(); explicit cleanup in disconnect() | `HealthMonitor.js:30-34` `stop()` - clears interval and resets state |
| HealthMonitor bug affects both sessions | Centralized service introduces shared failure mode -> Mitigated by simple logic (45 lines) and comprehensive unit tests | `HealthMonitor.js:1-45` - entire class is straightforward EventEmitter pattern |

## Invisible Knowledge

This section captures information NOT visible from reading the code. Technical Writer uses this for README.md documentation during post-implementation.

### Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                         Frontend (Workspace)                    │
│  - Displays connection status (connected/stale/disconnected)   │
│  - Reinit buttons per data source                               │
└────────────────────────────┬───────────────────────────────────┘
                             │ WebSocket message
                             │ {type: 'reinit', source: 'ctrader'|'tradingview'|'all'}
                             ↓
┌────────────────────────────────────────────────────────────────┐
│                      WebSocketServer                            │
│  - Handles 'reinit' message type                               │
│  - Routes to session.reconnect()                               │
│  - Broadcasts status updates to all clients                    │
└─────┬──────────────────────┬───────────────────────────────────┘
      │                      │
      ↓                      ↓
┌─────────────────┐    ┌──────────────────┐
│ CTraderSession  │    │TradingViewSession│
│─────────────────│    │──────────────────│
│ - healthMonitor │    │ - healthMonitor  │
│   (ctrader)     │    │   (tradingview)  │
│ - reconnect()   │    │ - reconnect()    │
└─────┬───────────┘    └────┬─────────────┘
      │                     │
      │     ┌───────────────┴────────────────┐
      │     │                                │
      ↓     ↓                                ↓
┌─────────────────┐                ┌──────────────────┐
│  HealthMonitor  │                │   cTrader API    │
│─────────────────│                │  (ProtoOA msgs)  │
│ - lastTick      │                └──────────────────┘
│ - isStale       │                ┌──────────────────┐
│ - start()       │                │ TradingView API  │
│ - stop()        │                │ (chart sessions) │
│ - recordTick()  │                └──────────────────┘
└─────────────────┘

EVENT FLOW (staleness detection):
tick event → session.recordTick() → HealthMonitor.recordTick() → 30s interval checks → stale if >60s → emit 'stale' → session forwards event → WebSocketServer broadcasts
```

### Data Flow

```
CONNECTION LIFECYCLE:
1. Backend starts → session.connect()
2. Auth succeeds → healthMonitor.start() → emit 'connected' → frontend shows "Connected"
3. Ticks flowing → healthMonitor.recordTick() → frontend sees data
4. Ticks stop → lastTick stale → healthMonitor emits 'stale' → session forwards → frontend shows "Stale"
5. Auto-reconnect triggers → exponential backoff
6. Manual reinit → immediate reconnect attempt

MANUAL REINIT FLOW:
Frontend click → WebSocket send {type: 'reinit', source: 'all'}
→ WebSocketServer.handleReinit()
→ session.reconnect()
→ healthMonitor.stop() → disconnect() → clear intervals → close connection
→ connect() → auth → healthMonitor.start() → subscribe → emit 'connected'/'error'
→ Frontend receives status update

HEALTH MONITOR INTEGRATION:
Session tick event → healthMonitor.recordTick() → updates lastTick
Session connect → healthMonitor.start() → begins 30s staleness checks
Session disconnect → healthMonitor.stop() → clears interval, resets isStale
```

### Why This Structure

- **Centralized HealthMonitor**: Staleness logic is identical across sessions; duplicating it violates DRY and Crystal Clarity's 120-line file limit (TradingViewSession already at 374 lines)
- **Delegation pattern**: Sessions delegate health monitoring to HealthMonitor but remain in control of their lifecycle (connect/disconnect/reconnect)
- **Event-driven status updates**: HealthMonitor emits events; sessions forward them to WebSocketServer without tight coupling
- **Separation of staleness from disconnection**: Stale means "connected but no data" (network issue), disconnected means "not connected" (auth/config issue) - different troubleshooting paths
- **Manual reinit as control plane**: Separate from data operations (subscribe/unsubscribe) to avoid semantic confusion

### Invariants

- `HealthMonitor.lastTick` MUST be updated via `recordTick()` on EVERY tick event (cTrader: PROTO_OA_SPOT_EVENT, TradingView: candle update)
- `HealthMonitor.start()` MUST be called after successful connection auth
- `HealthMonitor.stop()` MUST be called before disconnect to prevent memory leaks
- Reconnect attempts MUST continue indefinitely (no max limit)
- Exponential backoff MUST cap at 60 seconds max delay
- Manual reinit MUST call `healthMonitor.stop()` before disconnect to prevent false stale events
- Status broadcasts MUST go to ALL connected clients (use broadcastToAll, not sendToClient)

### Tradeoffs

| Choice | Benefit | Cost |
|--------|---------|------|
| Centralized HealthMonitor | Single source of truth; all files under 120 lines; eliminates code duplication | Adds one new file; sessions depend on HealthMonitor |
| 60s staleness timeout | Balances detection speed with false positives | Stale connections persist up to 60s before detection |
| 30s health check interval | Low CPU overhead, catches staleness within 30-60s window | Worst case 60s to detect staleness |
| Unlimited reconnects | Ensures eventual recovery without manual intervention | Could spam logs during sustained outages |
| Data-based staleness (not heartbeat) | Detects half-open sockets that can send but not receive | Cannot distinguish "no subscribers" from "connection stale" |
| Manual reinit via WebSocket | Reuses existing connection, simple protocol | Requires frontend to be connected to trigger reinit |

## Milestones

### Milestone 1: Create Centralized HealthMonitor

**Files**:
- `services/tick-backend/HealthMonitor.js` (create)

**Flags**: [needs conformance check]

**Requirements**:

- Create EventEmitter-based class for staleness detection
- Track `lastTick` timestamp (null until first tick)
- Run staleness check every 30 seconds via setInterval
- Emit 'stale' event if no data received for 60 seconds
- Emit 'tick_resumed' event when staleness clears
- Provide `start()`, `stop()`, `recordTick()` methods
- Accept `sessionName` constructor parameter for event context

**Acceptance Criteria**:

- 'stale' event emitted exactly 60 seconds after last tick
- 'stale' event clears and 'tick_resumed' emitted when new tick arrives
- Interval cleared on stop() (no memory leaks)
- isStale state tracked and reset on stop()
- Both sessions can use identical HealthMonitor instances

**Code Changes** (HealthMonitor.js - new file):

```javascript
// services/tick-backend/HealthMonitor.js
const EventEmitter = require('events');

class HealthMonitor extends EventEmitter {
    constructor(sessionName, stalenessMs = 60000, checkIntervalMs = 30000) {
        super();
        this.sessionName = sessionName;
        this.stalenessMs = stalenessMs;
        this.checkIntervalMs = checkIntervalMs;
        this.lastTick = null;
        this.isStale = false;
        this.interval = null;
    }

    recordTick() {
        this.lastTick = Date.now();
        this.checkStaleness();
    }

    start() {
        this.stop();
        this.interval = setInterval(() => this.checkStaleness(), this.checkIntervalMs);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.isStale = false;
    }

    checkStaleness() {
        const isStale = this.lastTick && (Date.now() - this.lastTick) > this.stalenessMs;
        if (isStale && !this.isStale) {
            this.isStale = true;
            this.emit('stale', { session: this.sessionName });
        } else if (!isStale && this.isStale) {
            this.isStale = false;
            this.emit('tick_resumed', { session: this.sessionName });
        }
    }
}

module.exports = { HealthMonitor };
```

### Milestone 2: Integrate HealthMonitor into Sessions

**Files**:
- `services/tick-backend/CTraderSession.js` (modify)
- `services/tick-backend/TradingViewSession.js` (modify)

**Flags**: [needs conformance check]

**Requirements**:

- Instantiate HealthMonitor in session constructor
- Call `recordTick()` on every tick event emitted
- Call `start()` after successful connection
- Call `stop()` in handleDisconnect()
- Forward HealthMonitor events ('stale', 'tick_resumed') to session emitter

**Acceptance Criteria**:

- Both sessions use HealthMonitor identically
- Session forwards 'stale' events with session context
- Session forwards 'tick_resumed' events with session context
- HealthMonitor stopped on disconnect (no memory leaks)
- File sizes remain under 120 lines

**Code Changes** (CTraderSession.js):

```diff
--- a/services/tick-backend/CTraderSession.js
+++ b/services/tick-backend/CTraderSession.js
@@ -3,6 +3,7 @@ const { ProtoOAErrorRes } = require('./models/ProtoOAErrorRes');
 const { ProtoOAPayloadRes } = require('./models/ProtoOAPayloadRes');
 const { ProtoHeartbeatEvent } = require('./models/ProtoHeartbeatEvent');
 const EventEmitter = require('events');
+const { HealthMonitor } = require('./HealthMonitor');

 class CTraderSession extends EventEmitter {
     constructor(...) {
@@ -19,6 +20,8 @@ class CTraderSession extends EventEmitter {
         this.symbolMap = new Map();
         this.reverseSymbolMap = new Map();
         this.symbolInfoCache = new Map();

+        this.healthMonitor = new HealthMonitor('ctrader');
+
         // Reconnection support
         this.reconnectAttempts = 0;
         this.maxReconnects = 5;
@@ -119,6 +122,9 @@ class CTraderSession extends EventEmitter {
             }

             if (tickData) {
+                // Data receipt (not heartbeat) is the only reliable liveness indicator for half-open sockets
+                this.healthMonitor.recordTick();
+
                 // E2E_DEBUG: Keep for end-to-end diagnosis until production deployment.
                 console.log(`[DEBUG_TRACE | CTraderSession] Emitting processed tick:`, JSON.stringify(tickData));
                 this.emit('tick', tickData);
@@ -146,6 +152,9 @@ class CTraderSession extends EventEmitter {
             console.log('[DEBUG] Starting heartbeat');
             this.startHeartbeat();
+            // Start tracking data flow; connection doesn't guarantee data is flowing
+            this.healthMonitor.start();
+
             // Reset reconnection attempts on successful connection
             this.reconnectAttempts = 0;
             this.reconnectDelay = 1000;
@@ -159,6 +168,10 @@ class CTraderSession extends EventEmitter {
     handleDisconnect(error = null) {
         console.log('[DEBUG] CTraderSession.handleDisconnect() called');
         if(error) console.error('CTraderSession connection failed:', error);
+        this.healthMonitor.stop(); // Clear interval to prevent memory leaks
+
         this.stopHeartbeat();
         this.emit('disconnected');
         if (this.connection) {
```

**Code Changes** (TradingViewSession.js):

```diff
--- a/services/tick-backend/TradingViewSession.js
+++ b/services/tick-backend/TradingViewSession.js
@@ -1,5 +1,6 @@
 const { tradingview } = require('../../libs/tradingview-ws');
 const EventEmitter = require('events');
+const { HealthMonitor } = require('./HealthMonitor');

 class TradingViewSession extends EventEmitter {
     constructor(symbolManager, sessionId, initialSymbols) {
@@ -18,6 +19,8 @@ class TradingViewSession extends EventEmitter {
         this.subscriptions = new Map(); // symbol -> { d1ChartSession, m1ChartSession, adr, lastCandle }
         this.unsubscribe = null;

+        this.healthMonitor = new HealthMonitor('tradingview');
+
         // Reconnection support
         this.reconnectAttempts = 0;
         this.maxReconnects = 5;
@@ -42,6 +45,9 @@ class TradingViewSession extends EventEmitter {
             this.unsubscribe = this.client.subscribe((event) => {
                 this.handleEvent(event);
             });

+            // Start tracking data flow; connection doesn't guarantee data is flowing
+            this.healthMonitor.start();
+
             // Reset reconnection attempts on successful connection
             this.reconnectAttempts = 0;
             this.reconnectDelay = 1000;
@@ -107,6 +113,9 @@ class TradingViewSession extends EventEmitter {
                         // Always update last candle and emit tick for live price
                         const latest = parsedD1[parsedD1.length - 1];
                         data.lastCandle = latest;

+                        // Data receipt (not heartbeat) is the only reliable liveness indicator for half-open sockets
+                        this.healthMonitor.recordTick();
+
                         this.emit('tick', {
                             type: 'tick',
                             source: 'tradingview',
@@ -348,6 +357,9 @@ class TradingViewSession extends EventEmitter {
     handleDisconnect(error = null) {
         console.log('[TradingView] handleDisconnect() called');
         if (error) console.error('[TradingView] connection failed:', error);
+        this.healthMonitor.stop(); // Clear interval to prevent memory leaks
+
         this.emit('disconnected');

         // Attempt reconnection with exponential backoff
```

### Milestone 3: Enable Unlimited Auto-Reconnect

**Files**:
- `services/tick-backend/CTraderSession.js` (modify)
- `services/tick-backend/TradingViewSession.js` (modify)

**Flags**: [needs conformance check]

**Requirements**:

- Remove `maxReconnects` limit entirely
- Implement exponential backoff with 60 second cap
- Reset `reconnectAttempts` on successful connection
- Keep existing `scheduleReconnect()` pattern
- Add `shouldReconnect` flag to control reconnection on explicit disconnect

**Acceptance Criteria**:

- Reconnect attempts continue indefinitely (no hard stop)
- Backoff delays: 1s, 2s, 4s, 8s, 16s, 32s, 60s, 60s, 60s...
- Successful connection resets `reconnectAttempts` to 0
- Explicit disconnect stops reconnection attempts

**Code Changes** (CTraderSession.js):

```diff
--- a/services/tick-backend/CTraderSession.js
+++ b/services/tick-backend/CTraderSession.js
@@ -21,8 +21,7 @@ class CTraderSession extends EventEmitter {

         // Reconnection support
         this.reconnectAttempts = 0;
-        this.maxReconnects = 5;
         this.reconnectDelay = 1000;
+        // Exponential backoff with 60s cap prevents server hammering during sustained outages
+        this.maxReconnectDelay = 60000;
+        this.shouldReconnect = true;
         this.reconnectTimeout = null;
     }

@@ -166,9 +165,7 @@ class CTraderSession extends EventEmitter {
         }
         // Attempt reconnection with exponential backoff
-        if (this.reconnectAttempts < this.maxReconnects) {
-            this.scheduleReconnect();
-        }
+        if (this.shouldReconnect) {
+            this.scheduleReconnect(); // Unlimited attempts prevent permanent silent failure
+        }
     }

     scheduleReconnect() {
-        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
+        const delay = Math.min(
+            this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
+            this.maxReconnectDelay
+        );
         console.log(`[DEBUG] Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`);
         this.reconnectTimeout = setTimeout(async () => {
             this.reconnectAttempts++;
@@ -314,6 +311,10 @@ class CTraderSession extends EventEmitter {
     disconnect() {
         // Clear reconnect timeout to prevent reconnection after explicit disconnect
         if (this.reconnectTimeout) {
             clearTimeout(this.reconnectTimeout);
             this.reconnectTimeout = null;
         }
-        // Set maxReconnects to 0 to prevent handleDisconnect from scheduling reconnect
-        this.maxReconnects = 0;
+        // Flag prevents handleDisconnect from scheduling another reconnect attempt
+        this.shouldReconnect = false;

         if (this.connection) {
```

**Code Changes** (TradingViewSession.js):

```diff
--- a/services/tick-backend/TradingViewSession.js
+++ b/services/tick-backend/TradingViewSession.js
@@ -23,8 +23,7 @@ class TradingViewSession extends EventEmitter {
         this.subscriptions = new Map(); // symbol -> { d1ChartSession, m1ChartSession, adr, lastCandle }
         this.unsubscribe = null;

+        this.shouldReconnect = true; // Enables auto-reconnect; cleared on explicit disconnect

         // Reconnection support
         this.reconnectAttempts = 0;
-        this.maxReconnects = 5;
         this.reconnectDelay = 1000;
+        // Exponential backoff with 60s cap prevents server hammering during sustained outages
+        this.maxReconnectDelay = 60000;
         this.reconnectTimeout = null;
     }

@@ -355,9 +354,7 @@ class TradingViewSession extends EventEmitter {
         this.emit('disconnected');

         // Attempt reconnection with exponential backoff
-        if (this.reconnectAttempts < this.maxReconnects) {
-            this.scheduleReconnect();
-        }
+        if (this.shouldReconnect) { // Flag set to false on explicit disconnect
+            this.scheduleReconnect();
+        }
     }

     scheduleReconnect() {
-        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
+        const delay = Math.min(
+            this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
+            this.maxReconnectDelay
+        );
         console.log(`[TradingView] Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`);
         this.reconnectTimeout = setTimeout(async () => {
             this.reconnectAttempts++;
@@ -331,8 +330,7 @@ class TradingViewSession extends EventEmitter {
     async disconnect() {
         // Clear reconnect timeout to prevent reconnection after explicit disconnect
         if (this.reconnectTimeout) {
             clearTimeout(this.reconnectTimeout);
             this.reconnectTimeout = null;
         }
-        // Set maxReconnects to 0 to prevent handleDisconnect from scheduling reconnect
-        this.maxReconnects = 0;
+        // Flag prevents handleDisconnect from scheduling another reconnect attempt
+        this.shouldReconnect = false;

         if (this.client) {
```

### Milestone 4: Add Manual Reinit Control

**Files**:
- `services/tick-backend/WebSocketServer.js` (modify)
- `src/components/Workspace.svelte` (modify)

**Flags**: [needs conformance check]

**Requirements**:

- Add 'reinit' message handler in WebSocketServer
- Accept `source` parameter: 'ctrader', 'tradingview', or 'all'
- Expose `reconnect()` method on both session classes
- Frontend button to trigger reinit per data source
- Button disabled during reconnection state

**Acceptance Criteria**:

- 'reinit' message triggers immediate disconnect + reconnect sequence
- Reinit sends 'reinit_started' acknowledgment to client
- UI buttons visible and functional for each data source
- Status updates broadcast to all connected clients
- HealthMonitor.stop() called before reconnect to prevent false stale events

**Code Changes** (WebSocketServer.js):

```diff
--- a/services/tick-backend/WebSocketServer.js
+++ b/services/tick-backend/WebSocketServer.js
@@ -92,6 +92,9 @@ class WebSocketServer {
                 case 'unsubscribe':
                     if (data.symbols) this.handleUnsubscribe(ws, data.symbols);
                     break;
+                case 'reinit': // Control operation separate from data operations (subscribe/unsubscribe)
+                    this.handleReinit(ws, data);
+                    break;
                 default:
                     console.warn(`Unknown message type: ${data.type}`);
             }
@@ -262,6 +265,27 @@ class WebSocketServer {
         }
     }

+    async handleReinit(ws, data) {
+        // Selective reinit allows traders to restart only the problematic data source
+        const source = data.source || 'all';
+        console.log(`[WebSocketServer] Reinit requested for: ${source}`);
+
+        if (source === 'ctrader' || source === 'all') {
+            await this.cTraderSession.reconnect();
+        }
+        if (source === 'tradingview' || source === 'all') {
+            await this.tradingViewSession.reconnect();
+        }
+
+        // Acknowledgment allows frontend to show reinit in progress
+        this.sendToClient(ws, {
+            type: 'reinit_started',
+            source,
+            timestamp: Date.now()
+        });
+    }
+
     handleUnsubscribe(ws, symbols) {
         const clientSubs = this.clientSubscriptions.get(ws);
         if (!clientSubs) return;
```

**Code Changes** (CTraderSession.js - add reconnect method):

```diff
--- a/services/tick-backend/CTraderSession.js
+++ b/services/tick-backend/CTraderSession.js
@@ -334,4 +334,18 @@ class CTraderSession extends EventEmitter {
             this.heartbeatInterval = null;
         }
     }

+    async reconnect() {
+        console.log('[CTraderSession] Manual reinit requested');
+        this.shouldReconnect = true; // Ensure auto-reconnect is enabled
+        this.healthMonitor.stop(); // Prevent 'stale' events during reinit
+        if (this.reconnectTimeout) {
+            clearTimeout(this.reconnectTimeout); // Cancel pending reconnect to prevent duplicate attempts
+            this.reconnectTimeout = null;
+        }
+        await this.disconnect();
+        await this.connect();
+    }
 }

 module.exports = { CTraderSession };
```

**Code Changes** (TradingViewSession.js - add reconnect method):

```diff
--- a/services/tick-backend/TradingViewSession.js
+++ b/services/tick-backend/TradingViewSession.js
@@ -379,4 +395,17 @@ class TradingViewSession extends EventEmitter {
             this.stalenessInterval = null;
         }
     }

+    async reconnect() {
+        console.log('[TradingViewSession] Manual reinit requested');
+        this.shouldReconnect = true; // Ensure auto-reconnect is enabled
+        this.healthMonitor.stop(); // Prevent 'stale' events during reinit
+        if (this.reconnectTimeout) {
+            clearTimeout(this.reconnectTimeout); // Cancel pending reconnect to prevent duplicate attempts
+            this.reconnectTimeout = null;
+        }
+        await this.disconnect();
+        await this.connect(this.sessionId);
+    }
 }

 module.exports = { TradingViewSession };
```

**Code Changes** (Workspace.svelte - add reinit button):

```diff
--- a/src/components/Workspace.svelte
+++ b/src/components/Workspace.svelte
@@ -1,5 +1,5 @@
 <script>
+    // Manual reinit provides immediate control when traders detect connection issues
+    function reinitConnection(source) {
+        if (socket && socket.readyState === WebSocket.OPEN) {
+            socket.send(JSON.stringify({ type: 'reinit', source }));
+        }
+    }
 </script>

+{#if displayStatus}
+<div class="reinit-controls">
+    <button
+        on:click={() => reinitConnection('ctrader')}
+        disabled={!isConnected || isReconnecting}
+    >
+        Reinit cTrader
+    </button>
+    <button
+        on:click={() => reinitConnection('tradingview')}
+        disabled={!isConnected || isReconnecting}
+    >
+        Reinit TradingView
+    </button>
+    <button
+        on:click={() => reinitConnection('all')}
+        disabled={!isConnected || isReconnecting}
+    >
+        Reinit All
+    </button>
+</div>
+{/if}
```

### Milestone 5: Documentation

**Files**:
- `services/tick-backend/CLAUDE.md` (update index)
- `src/components/Workspace.svelte` (CLAUDE.md if needed)

**Requirements**:

- Update CLAUDE.md index entries for modified session files
- Add HealthMonitor.js to index
- Document staleness detection behavior
- Document reinit message protocol
- No README.md changes (backend implementation detail)

**Acceptance Criteria**:

- CLAUDE.md entries include staleness and reinit in "What" column
- HealthMonitor.js indexed with staleness detection responsibility
- Future developers can locate health monitoring code from index
- Message protocol documented for frontend reference

**Source Material**: `## Invisible Knowledge` section of this plan

## Milestone Dependencies

```
M1 (HealthMonitor) ──────────────┐
                                 │
M2 (Integrate into Sessions) ─────┤
                                 ├──► M5 (Documentation)
M3 (Unlimited Reconnect) ─────────┤
                                 │
M4 (Manual Reinit) ───────────────┘
```

M1 is the foundation - must be completed first.
M2, M3, and M4 are independent after M1 and can be developed in parallel.
M5 depends on completion of all code milestones.
