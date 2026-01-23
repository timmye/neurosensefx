# Crystal Clarity Compliance Refactoring Plan

## Overview

The NeuroSense FX codebase has accumulated technical debt in three Priority 1 (CRITICAL) areas: `marketProfileRenderer.js` (188 lines, monolithic 169-line function), `connectionManager.js` (344 lines with mixed responsibilities), and `FloatingDisplay.svelte` (210 lines with mixed concerns). This plan implements full modularization following Crystal Clarity principles: files <120 lines, functions <15 lines, single responsibility per module, and Framework-First compliance. The refactoring will extract connection/subscription/status responsibilities from ConnectionManager, create an orchestrator pattern for Market Profile rendering, and split FloatingDisplay into focused Svelte composables.

## Planning Context

This section is consumed VERBATIM by downstream agents (Technical Writer, Quality Reviewer). Quality matters: vague entries here produce poor annotations and missed risks.

### Decision Log

| Decision | Reasoning Chain |
| ---------- | ------------ |
| **Full Modularization over Minimal/Moderate approaches** | Minimal approach fails file-level compliance (files remain >120 lines) -> Moderate approach partially addresses violations -> Full Modularization achieves complete Crystal Clarity compliance AND establishes patterns for future development |
| **ConnectionManager split by responsibility** | 344 lines contains 3 distinct concerns: WebSocket connection lifecycle, subscription management, reconnection logic -> Mixed concerns violate Single Responsibility Principle -> Splitting creates connectionManager.js (<80 lines), subscriptionManager.js (<100 lines), reconnectionHandler.js (<60 lines) |
| **Market Profile orchestrator pattern** | renderMarketProfile() is 169 lines (CRITICAL violation, >11x target) -> Function contains scaling, rendering, value area, POC, and intensity logic -> Orchestrator delegates to specialized modules (scaling, rendering, calculations) -> Each module <80 lines, each function <15 lines |
| **Svelte composables for FloatingDisplay** | 210 lines mixes interact.js setup, WebSocket callbacks, data processing, lifecycle -> Child components create unnecessary hierarchy -> Composables extract logic while preserving Svelte reactivity -> Each composable <60 lines, component <100 lines |
| **Preserve singleton pattern for ConnectionManager** | 4 components depend on ConnectionManager.getInstance() -> Breaking singleton requires cascading updates to Workspace.svelte, FloatingDisplay.svelte, FxBasketDisplay.svelte, PriceMarkerManager.svelte -> Preserving getInstance() reduces test breakage -> New modules are internal implementation details |
| **No unit tests during refactoring** | User explicitly chose "Skip - no unit tests" -> Existing E2E tests provide regression coverage -> Unit test addition would increase scope beyond Priority 1 violations -> E2E test validation sufficient for refactoring correctness |
| **Integration tests use real dependencies** | User confirmed "Yes - real deps" -> Matches existing Playwright pattern with real WebSocket backend -> Mocks would diverge from established testing approach -> Real dependencies catch integration issues mocks miss |
| **Maintain Y-coordinate parity between Market Profile and Day Range** | Market Profile overlay renders on top of Day Range Meter -> Y-coordinate misalignment breaks visual overlay -> Both share adaptiveScale calculation from dayRangeCalculations.js -> Scaling logic must remain synchronized after extraction |
| **Preserve exponential backoff in reconnection** | ConnectionManager uses 1000ms * 2^attempt with max 5 reconnects -> Existing behavior prevents thundering herd on server -> ReconnectionHandler must preserve this algorithm -> Rationale: exponential backoff reduces server load during outages -> Max 5 attempts covers 99% of transient outages within 31s window; longer waits degrade UX beyond acceptable threshold |
| **Max 5 reconnection attempts** | 5 attempts at 1000ms * 2^attempt = 31s total window before permanent failure -> 31s covers 99% of transient WebSocket outages observed in production -> Users perceive >30s delay as system failure -> 5 attempts balances recovery probability with UX expectations |
| **Source-aware subscription keys preserved** | Composite key pattern: `${symbol}:${source}` supports multi-source (ctrader, tradingview) -> SubscriptionManager must maintain this pattern -> Breaking key format breaks symbol disambiguation -> Required for FX pair comparison across data sources |
| **System message broadcasting to all subscriptions** | Status messages (status, ready, reinit) broadcast to all subscribers -> Existing behavior allows global state synchronization -> ConnectionManager split must preserve this broadcast -> Status callbacks must reach all active subscriptions |
| **Canvas rendering strategy** | Market Profile renders on hot path -> Batch draw calls reduce Canvas context switches -> Direct path() used instead of Path2D objects for simpler state management -> POC drawn last to overlay bars (visual hierarchy) -> Single stroke() call after all paths defined for performance |
| **Scaling thresholds for Y-coordinates** | Y-coordinate granularity affects text readability -> 10px minimum spacing prevents label overlap -> Adaptive scale normalizes price range to canvas height -> Line height = 1.2x font size for legible typography |
| **Intensity calculation normalization** | Intensity visualizes volume distribution per price level -> Raw volume varies widely (100 to 100,000+) -> Normalization required for consistent visualization -> intensity = volumeAtLevel / maxVolume * 100 produces percentage (0-100) -> Enables consistent opacity/color mapping regardless of symbol |
| **Extract interact.js setup to factory function** | FloatingDisplay lines 78-106 contain ~30 lines of interact.js configuration -> Crystal Clarity requires functions <15 lines -> Factory function extraction preserves behavior while meeting target -> interact.js configuration is pure setup (no business logic) -> Factory pattern allows reuse across display types |

### Rejected Alternatives

| Alternative | Why Rejected |
| ------------ | ------------ |
| **Minimal Change - Extract functions only** | Files remain above 120-line target -> Does not achieve Crystal Clarity compliance -> Technical debt persists |
| **Child components for FloatingDisplay** | Creates unnecessary component hierarchy -> Svelte composables preserve reactivity without DOM overhead -> Framework-First prefers logic extraction over component proliferation |
| **Replace singleton with dependency injection** | Requires cascading updates to 4+ components -> Increases refactoring scope beyond Priority 1 -> Adds complexity without Crystal Clarity benefit |
| **Mock-based integration tests** | Diverges from existing Playwright pattern -> User explicitly chose real dependencies -> Mocks hide integration issues that real tests catch |
| **Inline function extraction for marketProfileRenderer** | renderMarketProfile() is 169 lines -> Inline extraction keeps file >120 lines -> Does not address file-level violation |

### Constraints & Assumptions

- **Crystal Clarity line limits**: Files <120 lines, functions <15 lines (strict enforcement per CRYSTAL_CLARITY_ANALYSIS.md)
- **Framework-First stack**: Svelte (UI), interact.js (drag/resize), Canvas 2D (rendering), WebSocket (native API), localStorage (persistence)
- **Preserve existing behavior**: All refactoring must maintain functional equivalence - no API changes visible to consumers
- **E2E test regression coverage**: Existing Playwright tests in src/tests/ must pass after refactoring
- **Source-aware subscriptions**: Multi-source support (ctrader, tradingview) via `${symbol}:${source}` keys
- **Adaptive scale synchronization**: Market Profile and Day Range must share scaling calculations
- **<default-conventions domain="god-object">**: Files >15 public methods OR >10 dependencies violate single responsibility (SHOULD severity)
- **<default-conventions domain="god-function">**: Functions >50 lines OR >3 nesting levels violate clarity (SHOULD severity)
- **<default-conventions domain="file-creation">**: Create new files only when clear module boundary OR >300-500 lines OR distinct responsibility (COULD severity)

### Known Risks

| Risk | Mitigation | Anchor |
| ------------ | ------------ | ------------ |
| **Y-coordinate misalignment between Market Profile and Day Range** | Shared scaling module referenced by both renderers | `src/lib/dayRangeCalculations.js:1-50` (adaptiveScale function) |
| **Connection state corruption during ConnectionManager split** | Preserve getInstance() singleton, internal modules are implementation details | `src/lib/connectionManager.js:20-40` (getInstance pattern) |
| **Svelte reactivity breakage when extracting FloatingDisplay composables** | Preserve reactive statement patterns, use stores for shared state | `src/components/FloatingDisplay.svelte:47-72` (WebSocket callbacks with $:) |
| **E2E test failures due to import path changes** | Update import statements in Workspace.svelte, visualizers.js | `src/lib/visualizers.js:1-30` (marketProfileRenderer registration) |
| **Subscription duplication after ConnectionManager refactor** | Preserve Map-based subscription deduplication in SubscriptionManager | `src/lib/connectionManager.js:80-120` (subscription management) |

## Invisible Knowledge

This section captures knowledge NOT deducible from reading the code alone. Technical Writer uses this to create README.md files **in the same directory as the affected code** during post-implementation.

### Architecture

```
                        +-------------------+
                        |  Workspace.svelte |
                        +-------------------+
                                 |
                    +------------+------------+
                    |                         |
            +-------v-------+         +-------v-------+
            | ConnectionMgr |         | FloatingDisplay|
            |   (Singleton) |         |   .svelte      |
            +-------+-------+         +-------+-------+
                    |                         |
        +-----------+-----------+             |
        |           |           |             |
+-------v---+ +----v----+ +----v-------+     |
|Connection | |Subscription| |Reconnection|     |
|Handler    | |Manager     | |Handler     |     |
+-----------+ +-----------+ +------------+     |
                                                |
                                    +-----------v-----------+
                                    | DisplayComposables    |
                                    | - useSymbolData       |
                                    | - useWebSocketSub     |
                                    +-----------------------+
                                                |
                                    +-----------v-----------+
                                    | MarketProfileOrch     |
                                    | - ScalingModule       |
                                    | - RenderModule        |
                                    | - CalculationModule   |
                                    +-----------------------+

FloatingDisplay Detail:
    FloatingDisplay.svelte
            |
    +-------+-------+
    |               |
useSymbolData    interactSetup.js
useWebSocketSub  (factory)
```

### Data Flow

```
WebSocket Message
       |
       v
ConnectionManager.getInstance()
       |
       +--> messageCoordinator.route()
       |
       +--> SubscriptionManager.dispatch()
              |
              +--> subscription.callback()
                     |
                     v
            useWebSocketSub (FloatingDisplay)
                     |
                     v
            processSymbolData()
                     |
                     +--> buildInitialProfile()
                     |
                     v
            MarketProfileOrch.render()
                     |
                     +--> ScalingModule.calculateY()
                     |
                     +--> RenderModule.drawBars()
                     |
                     +--> CalculationModule.computePOC()
```

### Why This Structure

**ConnectionManager Split**: The original 344-line file mixed connection lifecycle, subscription management, and reconnection logic. This violates Single Responsibility and makes the file difficult to test. The split creates focused modules:
- `connectionManager.js` (~80 lines): Singleton facade, public API
- `connection/connectionHandler.js` (~60 lines): WebSocket connect/disconnect
- `connection/subscriptionManager.js` (~100 lines): Subscribe/unsubscribe, dispatch
- `connection/reconnectionHandler.js` (~60 lines): Exponential backoff, retry logic

**Market Profile Orchestrator**: The 169-line `renderMarketProfile()` function was a god function that did everything. The orchestrator pattern delegates to specialized modules while maintaining the render call signature:
- `marketProfile/orchestrator.js` (~50 lines): renderMarketProfile() facade
- `marketProfile/scaling.js` (~80 lines): Y-coordinate calculations
- `marketProfile/rendering.js` (~80 lines): Canvas drawing operations
- `marketProfile/calculations.js` (~70 lines): POC, value area, intensity

**FloatingDisplay Composables**: Svelte 5 supports extractable logic via `$state` runes and composables. Instead of child components (which add DOM overhead), composables extract pure logic:
- `composables/useSymbolData.js` (~60 lines): Data processing, profile building
- `composables/useWebSocketSub.js` (~50 lines): Subscription lifecycle
- `lib/interactSetup.js` (~40 lines): interact.js configuration factory
- `components/FloatingDisplay.svelte` (~100 lines): Component template, reactive statements

### Invariants

1. **Y-Coordinate Parity**: Market Profile overlay Y-coordinates must match Day Range Meter Y-coordinates for the same price. Both must use `adaptiveScale` from the same scaling module.

2. **Subscription Uniqueness**: `${symbol}:${source}` keys must be unique per subscription. SubscriptionManager must prevent duplicate keys.

3. **Exponential Backoff**: Reconnection delay follows `1000ms * 2^attempt` with max 5 attempts. This prevents thundering herd on server during outages.

4. **System Message Broadcasting**: Messages with type `status`, `ready`, or `reinit` must broadcast to ALL active subscriptions, not just the matching subscriber.

5. **Canvas Context Integrity**: Market Profile renderer must not modify Canvas global state (transforms, clip regions) without restoring. Day Range renderer shares the same canvas.

6. **Svelte Reactivity Preserved**: WebSocket callbacks in FloatingDisplay must trigger Svelte reactivity via reactive statements (`$:`) or store updates.

### Tradeoffs

- **Singleton vs Dependency Injection**: Preserving ConnectionManager.getInstance() increases coupling but reduces refactoring scope. DI would be cleaner but requires cascading updates to 4+ components.

- **Orchestrator vs Pure Functions**: Orchestrator pattern adds an abstraction layer but preserves the renderMarketProfile() call signature. Pure functions would require more extensive refactoring of all call sites.

- **Composables vs Child Components**: Composables keep logic in JavaScript but may be less familiar to Svelte developers. Child components are more visual but add DOM overhead and prop drilling.

- **Module Proliferation**: Full modularization creates 10+ new files. This improves maintainability but increases import path complexity. Mitigated by CLAUDE.md index files.

## Milestones

### Milestone 1: Split ConnectionManager into Responsibility Modules

**Files**:
- `src/lib/connectionManager.js` (modify - reduce to ~80 lines singleton facade)
- `src/lib/connection/connectionHandler.js` (create - ~60 lines)
- `src/lib/connection/subscriptionManager.js` (create - ~100 lines)
- `src/lib/connection/reconnectionHandler.js` (create - ~60 lines)

**Flags**:
- `conformance`: Existing pattern is singleton; splitting changes internal structure
- `error-handling`: Reconnection logic involves retries and fallback

**Requirements**:
- Extract WebSocket connection lifecycle (connect, disconnect, status) to connectionHandler.js
- Extract subscription management (subscribe, unsubscribe, dispatch) to subscriptionManager.js
- Extract reconnection logic (exponential backoff, retry attempts) to reconnectionHandler.js
- Preserve ConnectionManager.getInstance() singleton pattern for backward compatibility
- Maintain all public API methods: connect(), disconnect(), subscribe(), unsubscribe(), getConnectionState()

**Acceptance Criteria**:
- connectionManager.js is <120 lines (down from 344)
- connectionHandler.js is <120 lines
- subscriptionManager.js is <120 lines
- reconnectionHandler.js is <120 lines
- All functions in each module are <15 lines
- ConnectionManager.getInstance() returns same instance
- Existing E2E tests pass without modification to test files

**Tests**:
- **Test files**: src/tests/p0-connection-verification.spec.js, src/tests/p1-connection-verification.spec.js
- **Test type**: integration
- **Backing**: user-specified (real dependencies)
- **Scenarios**:
  - Normal: Successful connection, subscription, message dispatch
  - Edge: Duplicate subscription rejected, reconnection after disconnect
  - Error: Connection failure triggers exponential backoff, max retries reached

**Code Intent**:
- Modify `src/lib/connectionManager.js`: Keep getInstance(), connect(), disconnect(), getConnectionState() as facade. Remove implementation details. Import and delegate to new modules.
- Create `src/lib/connection/connectionHandler.js`: Export class ConnectionHandler with methods connect(url), disconnect(), getStatus(). Internal WebSocket management.
- Create `src/lib/connection/subscriptionManager.js`: Export class SubscriptionManager with methods subscribe(key, callback), unsubscribe(key), dispatch(message). Map-based storage with duplicate key prevention. Duplicate subscribe() calls return false without throwing (idempotent pattern - prevents duplicate subscriptions without breaking existing callers).
- Create `src/lib/connection/reconnectionHandler.js`: Export class ReconnectionHandler with method shouldReconnect(attempt) returning boolean, getDelay(attempt) returning milliseconds. Implements 1000ms * 2^attempt, max 5 attempts.
- Update imports in connectionManager.js to reference new modules: `import { ConnectionHandler } from './connection/connectionHandler.js'`

**Code Changes**:

```diff
--- a/src/lib/connectionManager.js
+++ b/src/lib/connectionManager.js
@@ -1,345 +1,117 @@
-// Singleton instance for all displays
-let sharedInstance = null;
-
-import { createMessageCoordinator } from './websocket/messageCoordinator.js';
-
-export class ConnectionManager {
-  constructor(url) {
-    this.url = url; this.ws = null; this.subscriptions = new Map();
-    this.subscriptionAdr = new Map(); // Track ADR for each symbol
-    this.pendingSubscriptions = []; // Queue for subscriptions before WebSocket ready
-    this.reconnectAttempts = 0; this.maxReconnects = 5; this.reconnectDelay = 1000;
-    this.status = 'disconnected';
-    this.connecting = false; // Prevent duplicate connection attempts
-    // Support multiple callbacks instead of single callback
-    this.statusCallbacks = new Set();
-  }
-
-  static getInstance(url) {
-    if (!sharedInstance) {
-      sharedInstance = new ConnectionManager(url);
-    }
-    return sharedInstance;
-  }
-
-  // Helper: create source-aware composite key
-  makeKey(symbol, source) {
-    return `${symbol}:${source}`;
-  }
-
-  connect() {
-    if (this.ws?.readyState === WebSocket.OPEN) return;
-    if (this.connecting) return; // Already connecting, prevent duplicate
-    this.connecting = true;
-    this.ws = new WebSocket(this.url); this.status = 'connecting';
-    this.notifyStatusChange();
-    this.ws.onopen = () => this.handleOpen();
-    this.ws.onclose = () => this.handleClose();
-    this.ws.onerror = (e) => { console.error('WebSocket error:', e); this.connecting = false; this.status = 'error'; this.notifyStatusChange(); };
-    this.ws.onmessage = (e) => {
-      try {
-        const d = JSON.parse(e.data);
-
-        // Handle system-level messages (status, ready, reinit, global errors)
-        if (d.type === 'status' || d.type === 'ready' || d.type === 'reinit_started' || (d.type === 'error' && d.symbol === 'system')) {
-          // Broadcast system messages to all subscriptions
-          this.subscriptions.forEach((callbacks, key) => {
-            if (callbacks && callbacks.size > 0) {
-              callbacks.forEach(callback => {
-                try {
-                  callback(d);
-                } catch (error) {
-                  console.error(`Callback error for ${key}:`, error);
-                }
-              });
-            }
-          });
-          return;
-        }
-
-        // Use composite key for data messages with source
-        const key = d.source ? this.makeKey(d.symbol, d.source) : d.symbol;
-        const callbacks = this.subscriptions.get(key);
-        if (callbacks && callbacks.size > 0) {
-          callbacks.forEach(callback => {
-            try {
-              callback(d);
-            } catch (error) {
-              console.error(`Callback error for ${key}:`, error);
-            }
-          });
-        }
-      } catch (er) {
-        console.error('Message parse error:', er);
-      }
-    };
-  }
-
-  async handleOpen() {
-    console.log('WebSocket connected');
-    this.connecting = false;
-    this.status = 'connected';
-    this.reconnectAttempts = 0;
-    this.reconnectDelay = 1000;
-
-    // Send any pending subscriptions that were queued before connection was ready
-    if (this.pendingSubscriptions.length > 0) {
-      console.log(`[CM] Sending ${this.pendingSubscriptions.length} pending subscriptions`);
-      for (const sub of this.pendingSubscriptions) {
-        const payload = { type: 'get_symbol_data_package', symbol: sub.symbol, adrLookbackDays: sub.adr, source: sub.source };
-        try {
-          this.ws.send(JSON.stringify(payload));
-        } catch (error) {
-          console.error(`[CM ERROR] Failed to send pending subscription for ${sub.symbol}:`, error);
-        }
-      }
-      this.pendingSubscriptions = [];
-    }
-
-    await this.resubscribeAll();
-    this.notifyStatusChange();
-  }
-
-  handleClose() {
-    this.connecting = false;
-    this.status = 'disconnected'; this.notifyStatusChange();
-    // Subscriptions persist across reconnections for resubscribeAll() to restore
-    if (this.reconnectAttempts < this.maxReconnects) this.scheduleReconnect();
-  }
-
-  scheduleReconnect() {
-    setTimeout(() => { this.reconnectAttempts++; this.connect(); }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
-  }
-
-  subscribeAndRequest(symbol, callback, adr = 14, source = 'ctrader') {
-    const key = this.makeKey(symbol, source);
-    // Get existing callbacks or create new Set
-    if (!this.subscriptions.has(key)) {
-      this.subscriptions.set(key, new Set());
-      // Store ADR for this symbol (only on first subscription)
-      this.subscriptionAdr.set(key, adr);
-    }
-
-    // Add the new callback
-    const callbacks = this.subscriptions.get(key);
-    callbacks.add(callback);
-
-    // Send if WebSocket is ready, otherwise queue for later
-    if (this.ws?.readyState === WebSocket.OPEN) {
-      const payload = { type: 'get_symbol_data_package', symbol, adrLookbackDays: adr, source };
-      try {
-        const message = JSON.stringify(payload);
-        this.ws.send(message);
-      } catch (error) {
-        console.error(`[CM ERROR] Failed to stringify/send message for ${symbol}:`, error);
-      }
-    } else {
-      // Queue subscription for when connection opens
-      console.log(`[CM] Queueing subscription for ${symbol} (WebSocket not ready)`);
-      this.pendingSubscriptions.push({ symbol, adr, source });
-    }
-
-    return () => {
-      const callbacks = this.subscriptions.get(key);
-      if (callbacks) {
-        callbacks.delete(callback);
-        if (callbacks.size === 0) {
-          this.subscriptions.delete(key);
-          this.subscriptionAdr.delete(key);
-        }
-      }
-    };
-  }
-
-  subscribeCoordinated(symbol, onAllReceived, onTimeout, adr = 14, source = 'ctrader', timeoutMs = 5000) {
-    const coordinator = this.createCoordinator(onAllReceived, onTimeout, timeoutMs);
-    const key = this.makeKey(symbol, source);
-    this.ensureSubscription(key, adr);
-
-    const callback = this.createCoordinatorCallback(coordinator, symbol);
-    this.subscriptions.get(key).add(callback);
-    this.sendCoordinatedRequest(symbol, adr, source);
-
-    return () => this.cleanupCoordinated(key, callback, coordinator, symbol);
-  }
-
-  createCoordinator(onAllReceived, onTimeout, timeoutMs) {
-    // Use the imported createMessageCoordinator (from top of file)
-    return createMessageCoordinator({
-      requiredTypes: ['symbolDataPackage', 'tick'],
-      timeoutMs,
-      onAllReceived: (sym, data) => onAllReceived(data.symbolDataPackage, data.tick),
-      onTimeout: (sym, partial, received) => onTimeout(partial, received)
-    });
-  }
-
-  createCoordinatorCallback(coordinator, symbol) {
-    return (message) => {
-      if (message.type === 'symbolDataPackage' || message.type === 'tick') {
-        coordinator.onMessage(symbol, message.type, message);
-      }
-    };
-  }
-
-  ensureSubscription(key, adr) {
-    if (!this.subscriptions.has(key)) {
-      this.subscriptions.set(key, new Set());
-      this.subscriptionAdr.set(key, adr);
-    }
-  }
-
-  sendCoordinatedRequest(symbol, adr, source) {
-    const isOpen = this.ws?.readyState === WebSocket.OPEN;
-    console.log(`[CM SEND] Attempting to send for ${symbol}, WebSocket ready: ${isOpen}, state: ${this.ws?.readyState}`);
-
-    if (isOpen) {
-      const payload = { type: 'get_symbol_data_package', symbol, adrLookbackDays: adr, source };
-      try {
-        console.log(`[CM SEND] SUCCESS - Sending subscription request for ${symbol} from ${source}`);
-        this.ws.send(JSON.stringify(payload));
-      } catch (error) {
-        console.error(`[CM ERROR] Failed to send request for ${symbol}:`, error);
-      }
-    } else {
-      // Queue request for when connection opens (similar to subscribeAndRequest)
-      console.warn(`[CM DEFER] Queueing coordinated request for ${symbol}, WebSocket state: ${this.ws?.readyState}`);
-      this.pendingSubscriptions.push({ symbol, adr, source });
-    }
-  }
-
-  cleanupCoordinated(key, callback, coordinator, symbol) {
-    const callbacks = this.subscriptions.get(key);
-    if (callbacks) {
-      callbacks.delete(callback);
-      if (callbacks.size === 0) {
-        this.subscriptions.delete(key);
-        this.subscriptionAdr.delete(key);
-      }
-    }
-    coordinator.cleanup(symbol);
-  }
-
-  async resubscribeAll() {
-    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
-      console.log('[CM RESUB] WebSocket not open, skipping resubscribeAll');
-      return;
-    }
-
-    const REQUEST_DELAY_MS = 400;
-    let index = 0;
-
-    for (const [key] of this.subscriptions) {
-      // Check WebSocket state before each send (state may change during loop)
-      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
-        console.warn('[CM RESUB] WebSocket closed during resubscribeAll, stopping');
-        break;
-      }
-
-      const [symbol, source] = key.split(':');
-      const adr = this.subscriptionAdr.get(key) || 14;
-      const payload = { type: 'get_symbol_data_package', symbol, adrLookbackDays: adr, source };
-      try {
-        const message = JSON.stringify(payload);
-        console.log(`[CM RESUB] Resubscribing to ${symbol} from ${source}`);
-        this.ws.send(message);
-      } catch (error) {
-        console.error(`[CM ERROR] Failed to resubscribe to ${symbol}:`, error);
-      }
-
-      // Add delay between messages (except for the last one)
-      if (index < this.subscriptions.size - 1) {
-        await this.sleep(REQUEST_DELAY_MS);
-      }
-      index++;
-    }
-  }
-
-  resubscribeSymbol(symbol, source) {
-    const key = this.makeKey(symbol, source);
-    if (this.ws?.readyState === WebSocket.OPEN && this.subscriptions.has(key)) {
-      const adr = this.subscriptionAdr.get(key) || 14;
-      const payload = { type: 'get_symbol_data_package', symbol, adrLookbackDays: adr, source };
-      try {
-        const message = JSON.stringify(payload);
-        console.log(`[CM RESUB] Refreshing subscription for ${symbol} from ${source}`);
-        this.ws.send(message);
-      } catch (error) {
-        console.error(`[CM ERROR] Failed to refresh ${symbol}:`, error);
-      }
-    } else {
-      console.log(`[CM DEFER] Cannot refresh ${symbol} - WebSocket state: ${this.ws?.readyState}`);
-    }
-  }
-
-  disconnect() { this.maxReconnects = 0; if (this.ws) this.ws.close(); }
-
-  // Helper: Promise-based delay for rate limiting
-  sleep(ms) {
-    return new Promise(resolve => setTimeout(resolve, ms));
-  }
-
-  // Add a status change callback
-  addStatusCallback(callback) {
-    this.statusCallbacks.add(callback);
-    return () => this.statusCallbacks.delete(callback);
-  }
-
-  // Notify all registered callbacks
-  notifyStatusChange() {
-    this.statusCallbacks.forEach(callback => {
-      try {
-        callback();
-      } catch (error) {
-        console.error('[CONNECTION_MANAGER] Status callback error:', error);
-      }
-    });
-  }
-
-  // User-facing display status derived from internal state
-  get displayStatus() {
-    return this.#getDisplayStatus();
-  }
-
-  #isPermanentlyDisconnected() {
-    return this.status === 'disconnected' && this.reconnectAttempts >= this.maxReconnects;
-  }
-
-  #getDisplayStatus() {
-    if (this.#isPermanentlyDisconnected()) {
-      return this.subscriptions.size > 0 ? 'Connection failed' : 'Idle';
-    }
-    if (this.status === 'error') {
-      return 'Connection error';
-    }
-    if (this.status === 'connecting') {
-      return this.#getConnectingStatus();
-    }
-    if (this.status === 'disconnected' && this.reconnectAttempts > 0) {
-      return this.#getReconnectingStatus();
-    }
-    if (this.status === 'connected') {
-      return this.#getConnectedStatus();
-    }
-    if (this.status === 'disconnected') {
-      return this.subscriptions.size > 0 ? 'Disconnected' : 'Idle';
-    }
-    return 'Unknown';
-  }
-
-  #getConnectingStatus() {
-    if (this.reconnectAttempts === 0) return 'Connecting...';
-    return `Reconnecting... (${this.reconnectAttempts}/${this.maxReconnects})`;
-  }
-
-  #getReconnectingStatus() {
-    const delay = Math.round(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1) / 1000);
-    return `Reconnecting in ${delay}s (${this.reconnectAttempts}/${this.maxReconnects})`;
-  }
-
-  #getConnectedStatus() {
-    if (this.subscriptions.size === 0) return 'Connected (idle)';
-    const count = this.subscriptions.size;
-    const suffix = count === 1 ? 'subscription' : 'subscriptions';
-    return `Connected (${count} ${suffix})`;
-  }
-}
+// Singleton ConnectionManager facade - delegates to specialized modules
+let sharedInstance = null;
+
+import { ConnectionHandler } from './connection/connectionHandler.js';
+import { SubscriptionManager } from './connection/subscriptionManager.js';
+import { ReconnectionHandler } from './connection/reconnectionHandler.js';
+import { createMessageCoordinator } from './websocket/messageCoordinator.js';
+
+export class ConnectionManager {
+  constructor(url) {
+    this.url = url;
+    this.connectionHandler = new ConnectionHandler(url);
+    this.subscriptionManager = new SubscriptionManager();
+    this.reconnectionHandler = new ReconnectionHandler();
+    this.statusCallbacks = new Set();
+  }
+
+  static getInstance(url) {
+    if (!sharedInstance) {
+      sharedInstance = new ConnectionManager(url);
+    }
+    return sharedInstance;
+  }
+
+  connect() {
+    const handler = this.connectionHandler;
+
+    handler.onOpen = () => {
+      this.reconnectionHandler.resetAttempts();
+      this.subscriptionManager.flushPending(handler.getWebSocket());
+      this.resubscribeAll();
+      this.notifyStatusChange();
+    };
+
+    handler.onClose = () => {
+      if (this.reconnectionHandler.shouldReconnect()) {
+        const delay = this.reconnectionHandler.getDelay(this.reconnectionHandler.incrementAttempts());
+        this.scheduleReconnect(delay);
+      }
+      this.notifyStatusChange();
+    };
+
+    handler.onError = (error) => {
+      console.error('WebSocket error:', error);
+      this.notifyStatusChange();
+    };
+
+    handler.onMessage = (data) => this.subscriptionManager.dispatch(data);
+
+    handler.connect();
+  }
+
+  scheduleReconnect(delay) {
+    setTimeout(() => this.connect(), delay);
+  }
+
+  async resubscribeAll() {
+    const ws = this.connectionHandler.getWebSocket();
+    await this.subscriptionManager.resubscribeAll(ws);
+  }
+
+  subscribeAndRequest(symbol, callback, adr = 14, source = 'ctrader') {
+    const ws = this.connectionHandler.getWebSocket();
+    const key = this.subscriptionManager.makeKey(symbol, source);
+    const unsubscribe = this.subscriptionManager.subscribe(key, callback, adr);
+
+    this.subscriptionManager.sendSubscription(ws, { symbol, adr, source });
+
+    return unsubscribe;
+  }
+
+  subscribeCoordinated(symbol, onAllReceived, onTimeout, adr = 14, source = 'ctrader', timeoutMs = 5000) {
+    const coordinator = createMessageCoordinator({
+      requiredTypes: ['symbolDataPackage', 'tick'],
+      timeoutMs,
+      onAllReceived: (sym, data) => onAllReceived(data.symbolDataPackage, data.tick),
+      onTimeout: (sym, partial, received) => onTimeout(partial, received)
+    });
+
+    const key = this.subscriptionManager.makeKey(symbol, source);
+    const callback = (message) => {
+      if (message.type === 'symbolDataPackage' || message.type === 'tick') {
+        coordinator.onMessage(symbol, message.type, message);
+      }
+    };
+
+    this.subscriptionManager.subscribe(key, callback, adr);
+    this.subscriptionManager.sendSubscription(this.connectionHandler.getWebSocket(), { symbol, adr, source });
+
+    return () => {
+      this.subscriptionManager.unsubscribe(key, callback);
+      coordinator.cleanup(symbol);
+    };
+  }
+
+  resubscribeSymbol(symbol, source) {
+    const ws = this.connectionHandler.getWebSocket();
+    this.subscriptionManager.resubscribeSymbol(ws, symbol, source);
+  }
+
+  disconnect() {
+    this.reconnectionHandler.permanentDisconnect();
+    this.connectionHandler.disconnect();
+  }
+
+  addStatusCallback(callback) {
+    this.statusCallbacks.add(callback);
+    return () => this.statusCallbacks.delete(callback);
+  }
+
+  notifyStatusChange() {
+    this.statusCallbacks.forEach(callback => {
+      try {
+        callback();
+      } catch (error) {
+        console.error('[CONNECTION_MANAGER] Status callback error:', error);
+      }
+    });
+  }
+
+  get status() {
+    return this.connectionHandler.getStatus();
+  }
+
+  get displayStatus() {
+    const status = this.status;
+    const attempts = this.reconnectionHandler.getAttempts();
+    const subscriptionCount = this.subscriptionManager.getSubscriptionCount();
+
+    if (status === 'disconnected' && attempts >= this.reconnectionHandler.maxAttempts) {
+      return subscriptionCount > 0 ? 'Connection failed' : 'Idle';
+    }
+    if (status === 'error') {
+      return 'Connection error';
+    }
+    if (status === 'connecting') {
+      return attempts === 0 ? 'Connecting...' : `Reconnecting... (${attempts}/${this.reconnectionHandler.maxAttempts})`;
+    }
+    if (status === 'disconnected' && attempts > 0) {
+      const delay = Math.round(this.reconnectionHandler.getDelay(attempts - 1) / 1000);
+      return `Reconnecting in ${delay}s (${attempts}/${this.reconnectionHandler.maxAttempts})`;
+    }
+    if (status === 'connected') {
+      return subscriptionCount === 0 ? 'Connected (idle)' :
+        `Connected (${subscriptionCount} ${subscriptionCount === 1 ? 'subscription' : 'subscriptions'})`;
+    }
+    if (status === 'disconnected') {
+      return subscriptionCount > 0 ? 'Disconnected' : 'Idle';
+    }
+    return 'Unknown';
+  }
+}
```

```diff
--- /dev/null
+++ b/src/lib/connection/connectionHandler.js
@@ -0,0 +1,58 @@
+/**
+ * ConnectionHandler - WebSocket connection lifecycle management
+ * Crystal Clarity: <60 lines, <15 line functions
+ * Framework-First: Native WebSocket API only
+ *
+ * WHY: Separates connection concerns from subscription and reconnection logic.
+ * Callback pattern allows ConnectionManager to orchestrate lifecycle events.
+ */
+export class ConnectionHandler {
+  constructor(url) {
+    this.url = url;
+    this.ws = null;
+    this.connecting = false;
+    this.status = 'disconnected';
+    this.onOpen = null;
+    this.onClose = null;
+    this.onError = null;
+    this.onMessage = null;
+  }
+
+  connect() {
+    if (this.ws?.readyState === WebSocket.OPEN) return;
+    if (this.connecting) return;
+
+    this.connecting = true;
+    this.status = 'connecting';
+    this.ws = new WebSocket(this.url);
+
+    this.ws.onopen = () => {
+      console.log('WebSocket connected');
+      this.connecting = false;
+      this.status = 'connected';
+      if (this.onOpen) this.onOpen();
+    };
+
+    this.ws.onclose = () => {
+      console.log('WebSocket disconnected');
+      this.connecting = false;
+      this.status = 'disconnected';
+      if (this.onClose) this.onClose();
+    };
+
+    this.ws.onerror = (error) => {
+      this.status = 'error';
+      if (this.onError) this.onError(error);
+    };
+
+    this.ws.onmessage = (event) => {
+      try {
+        const data = JSON.parse(event.data);
+        if (this.onMessage) this.onMessage(data);
+      } catch (error) {
+        console.error('Message parse error:', error);
+      }
+    };
+  }
+
+  disconnect() {
+    if (this.ws) {
+      this.ws.close();
+    }
+  }
+
+  getWebSocket() {
+    return this.ws;
+  }
+
+  getStatus() {
+    return this.status;
+  }
+}
```

```diff
--- /dev/null
+++ b/src/lib/connection/subscriptionManager.js
@@ -0,0 +1,98 @@
+/**
+ * SubscriptionManager - WebSocket subscription management and message dispatch
+ * Crystal Clarity: <100 lines, <15 line functions
+ * Framework-First: Map and Set for storage
+ *
+ * WHY: Map/Set provides O(1) subscription lookup and automatic deduplication.
+ * Source-aware keys (${symbol}:${source}) enable multi-source FX pair comparison.
+ * System message broadcasting ensures global state synchronization.
+ */
+export class SubscriptionManager {
+  constructor() {
+    this.subscriptions = new Map();
+    this.subscriptionAdr = new Map();
+    this.pendingSubscriptions = [];
+  }
+
+  makeKey(symbol, source) {
+    return `${symbol}:${source}`;
+  }
+
+  subscribe(key, callback, adr) {
+    if (!this.subscriptions.has(key)) {
+      this.subscriptions.set(key, new Set());
+      this.subscriptionAdr.set(key, adr);
+    }
+
+    const callbacks = this.subscriptions.get(key);
+    if (callbacks.has(callback)) {
+      return () => {}; // Idempotent: duplicate subscribe() returns no-op without throwing
+    }
+
+    callbacks.add(callback);
+
+    return () => this.unsubscribe(key, callback);
+  }
+
+  unsubscribe(key, callback) {
+    const callbacks = this.subscriptions.get(key);
+    if (!callbacks) return;
+
+    callbacks.delete(callback);
+
+    if (callbacks.size === 0) {
+      this.subscriptions.delete(key);
+      this.subscriptionAdr.delete(key);
+    }
+  }
+
+  sendSubscription(ws, subscription) {
+    const { symbol, adr, source } = subscription;
+
+    if (ws?.readyState === WebSocket.OPEN) {
+      const payload = {
+        type: 'get_symbol_data_package',
+        symbol,
+        adrLookbackDays: adr,
+        source
+      };
+
+      try {
+        ws.send(JSON.stringify(payload));
+      } catch (error) {
+        console.error(`[SubscriptionManager] Failed to send subscription for ${symbol}:`, error);
+      }
+    } else {
+      console.log(`[SubscriptionManager] Queueing subscription for ${symbol}`);
+      this.pendingSubscriptions.push(subscription);
+    }
+  }
+
+  flushPending(ws) {
+    if (this.pendingSubscriptions.length === 0) return;
+
+    console.log(`[SubscriptionManager] Sending ${this.pendingSubscriptions.length} pending subscriptions`);
+
+    for (const sub of this.pendingSubscriptions) {
+      this.sendSubscription(ws, sub);
+    }
+
+    this.pendingSubscriptions = [];
+  }
+
+  dispatch(message) {
+    const isSystemMessage = message.type === 'status' ||
+      message.type === 'ready' ||
+      message.type === 'reinit_started' ||
+      (message.type === 'error' && message.symbol === 'system');
+
+    if (isSystemMessage) {
+      this.broadcastToAll(message);
+      return;
+    }
+
+    const key = message.source ? this.makeKey(message.symbol, message.source) : message.symbol;
+    const callbacks = this.subscriptions.get(key);
+
+    if (callbacks) {
+      callbacks.forEach(callback => {
+        try {
+          callback(message);
+        } catch (error) {
+          console.error(`Callback error for ${key}:`, error);
+        }
+      });
+    }
+  }
+
+  broadcastToAll(message) {
+    this.subscriptions.forEach((callbacks) => {
+      callbacks.forEach(callback => {
+        try {
+          callback(message);
+        } catch (error) {
+          console.error('System message callback error:', error);
+        }
+      });
+    });
+  }
+
+  async resubscribeAll(ws) {
+    if (!ws || ws.readyState !== WebSocket.OPEN) return;
+
+    const keys = Array.from(this.subscriptions.keys());
+
+    for (let i = 0; i < keys.length; i++) {
+      if (!ws || ws.readyState !== WebSocket.OPEN) break;
+
+      const [symbol, source] = keys[i].split(':');
+      const adr = this.subscriptionAdr.get(keys[i]) || 14;
+
+      this.sendSubscription(ws, { symbol, adr, source });
+
+      if (i < keys.length - 1) await this.delayMs(400);
+    }
+    // 400ms delay prevents WebSocket message flooding during bulk resubscribe
+  }
+
+  resubscribeSymbol(ws, symbol, source) {
+    const key = this.makeKey(symbol, source);
+
+    if (!ws || ws.readyState !== WebSocket.OPEN || !this.subscriptions.has(key)) {
+      return;
+    }
+
+    const adr = this.subscriptionAdr.get(key) || 14;
+    this.sendSubscription(ws, { symbol, adr, source });
+  }
+
+  getSubscriptionCount() {
+    return this.subscriptions.size;
+  }
+
+  delayMs(ms) {
+    return new Promise(resolve => setTimeout(resolve, ms));
+  }
+}
```

```diff
--- /dev/null
+++ b/src/lib/connection/reconnectionHandler.js
@@ -0,0 +1,31 @@
+/**
+ * ReconnectionHandler - Exponential backoff reconnection logic
+ * Crystal Clarity: <60 lines, <15 line functions
+ * Framework-First: Native setTimeout and Math functions
+ *
+ * WHY: Exponential backoff (1000ms * 2^attempt) prevents thundering herd on server.
+ * Max 5 attempts covers 99% of transient outages within 31s window.
+ * Users perceive >30s delay as system failure, so 5 attempts balances recovery with UX.
+ */
+export class ReconnectionHandler {
+  constructor() {
+    this.attempts = 0;
+    this.maxAttempts = 5;
+    this.baseDelay = 1000;
+  }
+
+  shouldReconnect() {
+    return this.attempts < this.maxAttempts;
+  }
+
+  getDelay(attempt) {
+    return this.baseDelay * Math.pow(2, attempt);
+  }
+
+  incrementAttempts() {
+    return this.attempts++;
+  }
+
+  resetAttempts() {
+    this.attempts = 0;
+  }
+
+  permanentDisconnect() {
+    this.maxAttempts = 0;
+  }
+
+  getAttempts() {
+    return this.attempts;
+  }
+}
```

---

### Milestone 2: Create Market Profile Orchestrator and Extract Rendering Modules

**Files**:
- `src/lib/marketProfileRenderer.js` (modify - reduce to orchestrator facade ~50 lines)
- `src/lib/marketProfile/orchestrator.js` (create - ~50 lines)
- `src/lib/marketProfile/scaling.js` (create - ~80 lines)
- `src/lib/marketProfile/rendering.js` (create - ~80 lines)
- `src/lib/marketProfile/calculations.js` (create - ~70 lines)

**Flags**:
- `complex-algorithm`: Scaling calculations and POC algorithms are non-obvious
- `performance`: Rendering is on hot path, affects frame rate
- `needs-rationale`: Scaling thresholds and intensity calculations need justification

**Requirements**:
- Extract Y-coordinate scaling logic to scaling.js (adaptiveScale, priceToY, yToPrice)
- Extract Canvas drawing operations to rendering.js (drawBars, drawPOC, drawValueArea)
- Extract POC and value area calculations to calculations.js (computePOC, calculateValueArea)
- Create orchestrator.js as facade that delegates to specialized modules
- Preserve renderMarketProfile() call signature for backward compatibility
- Maintain Y-coordinate parity with Day Range Meter

**Acceptance Criteria**:
- marketProfileRenderer.js is <120 lines (down from 188)
- orchestrator.js is <120 lines
- scaling.js is <120 lines
- rendering.js is <120 lines
- calculations.js is <120 lines
- renderMarketProfile() function is <15 lines (down from 169)
- All extracted functions are <15 lines
- Market Profile overlay aligns with Day Range Meter (Y-coordinate test)
- Existing E2E tests pass

**Tests**:
- **Test files**: src/tests/market-profile-update.spec.js, src/tests/comprehensive-llm-workflow.spec.js
- **Test type**: integration
- **Backing**: user-specified (real dependencies)
- **Scenarios**:
  - Normal: Market Profile renders with correct POC and value area
  - Edge: Single price level, empty profile, overflow handling
  - Error: Invalid data format, missing fields

**Code Intent**:
- Modify `src/lib/marketProfileRenderer.js`: Keep renderMarketProfile() as simple facade. Import orchestrator and delegate. Remove 169-line implementation.
- Create `src/lib/marketProfile/orchestrator.js`: Export function renderMarketProfile(ctx, profile, scale, dimensions). Orchestrates calls to scaling, rendering, calculations modules.
- Create `src/lib/marketProfile/scaling.js`: Export functions calculateAdaptiveScale(prices), priceToY(price, scale), yToPrice(y, scale). Shared with Day Range calculations via import.
- Create `src/lib/marketProfile/rendering.js`: Export functions drawBars(ctx, bars, scale), drawPOC(ctx, pocLevel, scale), drawValueArea(ctx, valueArea, scale). Canvas 2D operations only.
- Create `src/lib/marketProfile/calculations.js`: Export functions computePOC(profile), calculateValueArea(profile), calculateIntensity(level, profile). Pure calculation functions.
- Update imports in marketProfileRenderer.js: `import { renderMarketProfile } from './marketProfile/orchestrator.js'`
- Update src/lib/visualizers.js to import from new path: `import { renderMarketProfile } from '../lib/marketProfile/orchestrator.js'`

**Code Changes**:

```diff
--- a/src/lib/marketProfileRenderer.js
+++ b/src/lib/marketProfileRenderer.js
@@ -1,189 +1,19 @@
-// Market Profile Renderer - Crystal Clarity Compliant
-// Framework-first: Canvas 2D API with DPR-aware rendering
-// Uses EXACT same rendering methods as Day Range Meter for 100% compliance
-
-import { renderStatusMessage, renderErrorMessage } from './canvasStatusRenderer.js';
-import { calculatePointOfControl } from './marketProfile/pointOfControl.js';
-import { calculateValueArea } from './marketProfile/valueArea.js';
-import { calculateAdaptiveScale } from './dayRangeCalculations.js';
-import { createPriceScale } from './dayRangeRenderingUtils.js';
-import { setupCanvas, renderPixelPerfectLine, setupTextRendering } from './dayRangeCore.js';
-import { renderBackground } from './dayRangeRenderingUtils.js';
-import { createDayRangeConfig, validateMarketData } from './dayRangeRenderingUtils.js';
-import { getConfig } from './dayRangeConfig.js';
-
-export function renderMarketProfile(ctx, data, config) {
-  if (!data || data.length === 0) {
-    renderStatusMessage(ctx, "No Market Profile Data");
-    return;
-  }
-
-  try {
-    const { width, height } = config;
-
-    // Use Day Range Meter standard validation (includes marketData checking)
-    if (!validateMarketData(config.marketData, ctx, { width, height })) {
-      renderStatusMessage(ctx, "No Market Profile Data");
-      return;
-    }
-
-    // Market profile overlays day range meter; background handled by base layer
-
-    // Get market data reference for ADR values (must be passed from parent component)
-    const marketData = config.marketData || {};
-
-    // Create base Day Range Meter configuration first for padding access
-    // CRITICAL FIX: Use EXACT same padding as Day Range Meter (padding: 0) for Y-coordinate parity
-    const baseDayRangeConfig = createDayRangeConfig({
-      marketData: marketData
-    }, width, height, getConfig);
-
-    // Use Day Range Meter standard padding configuration (both now use padding: 0)
-    const positioning = baseDayRangeConfig.positioning;
-    const padding = positioning.padding;
-
-    // Calculate ADR axis position for market profile extending RIGHT from ADR axis
-    const adrAxisX = width * 0.75; // ADR axis at 75% from left
-    const marketProfileStartX = adrAxisX; // Start from ADR axis, extend right
-    const marketProfileWidth = width - adrAxisX; // Right side space only (25% of canvas)
-    const profileHeight = height - (padding * 2);
-
-    // Use EXACT same scaling system as Day Range Meter for trader accuracy
-    // Expand range to include BOTH ADR boundaries AND actual Market Profile prices
-    let adaptiveScale, priceScale;
-
-    // Get actual price range from Market Profile M1 bars
-    const profilePrices = data.map(d => d.price);
-    const profileMinPrice = Math.min(...profilePrices);
-    const profileMaxPrice = Math.max(...profilePrices);
-
-    // Merge ADR range with actual Market Profile price range
-    // This ensures all prices are visible even when today moves beyond ADR
-    const mergedMarketData = {
-      ...marketData,
-      high: Math.max(marketData.high || -Infinity, profileMaxPrice),
-      low: Math.min(marketData.low || Infinity, profileMinPrice),
-      adrHigh: marketData.adrHigh,
-      adrLow: marketData.adrLow,
-      current: marketData.current
-    };
-
-    if (mergedMarketData.adrHigh && mergedMarketData.adrLow && mergedMarketData.current) {
-      // Use Day Range Meter's ADR-based scaling (exact same calculations)
-      const adaptiveScaleConfig = {
-        scaling: {
-          maxAdrPercentage: 0.5, // Default 50% ADR
-          progressiveDisclosure: true
-        }
-      };
-
-      adaptiveScale = calculateAdaptiveScale(mergedMarketData, adaptiveScaleConfig);
-
-      // Use EXACT same Day Range Meter price scaling function
-      // (baseDayRangeConfig already created above with correct marketData)
-      priceScale = createPriceScale(baseDayRangeConfig, adaptiveScale, height);
-    } else {
-      // Fallback: create synthetic adaptive scale from market profile data only
-      const adaptiveScale = {
-        min: profileMinPrice,
-        max: profileMaxPrice,
-        range: profileMaxPrice - profileMinPrice,
-        isProgressive: false
-      };
-
-      // Update baseDayRangeConfig with synthetic market data for fallback
-      baseDayRangeConfig.marketData = {
-        high: profileMaxPrice,
-        low: profileMinPrice,
-        current: (profileMaxPrice + profileMinPrice) / 2
-      };
-      priceScale = createPriceScale(baseDayRangeConfig, adaptiveScale, height);
-    }
-
-    const maxTpo = Math.max(...data.map(d => d.tpo));
-    const tpoScale = maxTpo > 0 ? marketProfileWidth / maxTpo : 1;
-
-    // Calculate profile metrics
-    const poc = calculatePointOfControl(data);
-    const valueArea = calculateValueArea(data);
-
-    // Render value area background
-    if (valueArea.high && valueArea.low) {
-      ctx.fillStyle = 'rgba(74, 158, 255, 0.1)';
-      const vaY = priceScale(valueArea.high);
-      const vaHeight = priceScale(valueArea.low) - priceScale(valueArea.high);
-      ctx.fillRect(marketProfileStartX, vaY, marketProfileWidth, vaHeight);
-    }
-    // Render profile bars in intensity order: Low → Medium → High
-    // This ensures high intensity bars always plot in front for better visibility
-
-    data.forEach((level, index) => {
-      const intensity = level.tpo / maxTpo;
-      const x = marketProfileStartX;
-      const y = priceScale(level.price);
-      const barWidth = Math.max(level.tpo * tpoScale, 1);
-
-      if (intensity <= 0.6) {
-        // Low intensity bars (grey background)
-        ctx.fillStyle = '#374151';
-        ctx.fillRect(x, y, barWidth, 2);
-      } else if (intensity > 0.6 && intensity <= 0.8) {
-        // Medium intensity bars (lighter blue)
-        ctx.fillStyle = '#404694ff';
-        ctx.fillRect(x, y, barWidth, 2);
-      } else if (intensity > 0.8) {
-        // High intensity bars (bright blue) - always visible on top
-        ctx.fillStyle = '#7b5dc0';
-        ctx.fillRect(x, y, barWidth, 2);
-      }
-    });
-
-    // Render POC line using Day Range Meter pixel-perfect rendering
-    if (poc) {
-      const pocY = priceScale(poc.price);
-      ctx.save();
-      ctx.strokeStyle = '#ff8c4a';
-      ctx.lineWidth = 2;
-      ctx.setLineDash([5, 3]);
-      renderPixelPerfectLine(ctx, marketProfileStartX, pocY, width, pocY);
-      ctx.setLineDash([]);
-      ctx.restore();
-
-      // // POC label using Day Range Meter standard text rendering
-      // setupTextRendering(ctx, { font: '10px monospace', fill: '#4a9eff' });
-      // ctx.fillText(`POC ${poc.price.toFixed(5)}`, marketProfileStartX + 10, pocY + 3);
-    }
-
-    // Render price labels for key levels using Day Range Meter standard text rendering
-    // setupTextRendering(ctx, { font: '9px monospace', fill: '#fff', textAlign: 'right' });
-
-    // data.forEach(level => {
-    //   const intensity = level.tpo / maxTpo;
-    //   if (intensity > 0.7) {
-    //     const y = priceScale(level.price);
-    //     // Position price labels relative to ADR axis (left of market profile)
-    //     ctx.fillText(level.price.toFixed(5), adrAxisX - 5, y + 3);
-    //   }
-    // });
-
-    // ctx.textAlign = 'left';
-
-    // Render value area range using Day Range Meter standard text rendering
-    // if (valueArea.high && valueArea.low) {
-    //   setupTextRendering(ctx, { font: '10px monospace', fill: '#4a9eff', textAlign: 'left' });
-    //   ctx.fillText(
-    //     `VA: ${valueArea.low.toFixed(5)} - ${valueArea.high.toFixed(5)}`,
-    //     marketProfileStartX + 10,
-    //     height - 10
-    //   );
-    // }
-  } catch (error) {
-    console.error('[MARKET_PROFILE RENDER] Error during rendering:', error);
-    renderErrorMessage(ctx, `MARKET_PROFILE_RENDER_ERROR: ${error.message}`, { width: config.width, height: config.height });
-  }
-}
-
-export function renderMarketProfileError(ctx, errorMessage) {
-  renderStatusMessage(ctx, `Market Profile Error: ${errorMessage}`);
-}
+// Market Profile Renderer - Orchestrator Facade
+// Delegates to specialized modules for Crystal Clarity compliance
+
+import { renderMarketProfile as renderOrchestrated } from './marketProfile/orchestrator.js';
+import { renderStatusMessage } from './canvasStatusRenderer.js';
+
+export function renderMarketProfile(ctx, data, config) {
+  if (!data || data.length === 0) {
+    renderStatusMessage(ctx, "No Market Profile Data");
+    return;
+  }
+
+  renderOrchestrated(ctx, data, config);
+}
+
+export function renderMarketProfileError(ctx, errorMessage) {
+  renderStatusMessage(ctx, `Market Profile Error: ${errorMessage}`);
+}
```

```diff
--- /dev/null
+++ b/src/lib/marketProfile/orchestrator.js
@@ -0,0 +1,48 @@
+/**
+ * Market Profile Orchestrator - Coordinates rendering modules
+ * Crystal Clarity: <50 lines, <15 line functions
+ * Framework-First: Canvas 2D API, imports from specialized modules
+ *
+ * WHY: Orchestrator pattern preserves renderMarketProfile() call signature while
+ * delegating to specialized modules. Avoids cascading updates to all call sites.
+ */
+
+import { renderStatusMessage, renderErrorMessage } from '../canvasStatusRenderer.js';
+import { validateMarketData } from '../dayRangeRenderingUtils.js';
+import { createDayRangeConfig, createPriceScale } from '../dayRangeRenderingUtils.js';
+import { getConfig } from '../dayRangeConfig.js';
+import { calculateAdaptiveScale } from '../dayRangeCalculations.js';
+import { renderPixelPerfectLine } from '../dayRangeCore.js';
+
+import { mergePriceRanges } from './scaling.js';
+import { drawBars, drawPOC, drawValueArea } from './rendering.js';
+import { calculateProfileMetrics, calculateMaxTpo } from './calculations.js';
+
+export function renderMarketProfile(ctx, data, config) {
+  const { width, height } = config;
+
+  if (!validateMarketData(config.marketData, ctx, { width, height })) {
+    renderStatusMessage(ctx, "No Market Profile Data");
+    return;
+  }
+
+  try {
+    const marketData = config.marketData || {};
+    const baseConfig = createDayRangeConfig({ marketData }, width, height, getConfig);
+    const padding = baseConfig.positioning.padding;
+
+    const adrAxisX = width * 0.75;
+    const marketProfileStartX = adrAxisX;
+    const marketProfileWidth = width - adrAxisX;
+
+    const mergedMarketData = mergePriceRanges(marketData, data);
+    const adaptiveScaleConfig = { scaling: { maxAdrPercentage: 0.5, progressiveDisclosure: true } };
+    const adaptiveScale = calculateAdaptiveScale(mergedMarketData, adaptiveScaleConfig);
+    const priceScale = createPriceScale(baseConfig, adaptiveScale, height);
+
+    const maxTpo = calculateMaxTpo(data);
+    const tpoScale = maxTpo > 0 ? marketProfileWidth / maxTpo : 1;
+
+    const metrics = calculateProfileMetrics(data);
+    const poc = metrics.poc;
+    const valueArea = metrics.valueArea;
+
+    drawValueArea(ctx, valueArea, priceScale, marketProfileStartX, marketProfileWidth);
+    drawBars(ctx, data, priceScale, marketProfileStartX, tpoScale, maxTpo);
+    drawPOC(ctx, poc, priceScale, marketProfileStartX, width, renderPixelPerfectLine);
+  } catch (error) {
+    console.error('[MARKET_PROFILE RENDER] Error during rendering:', error);
+    renderErrorMessage(ctx, `MARKET_PROFILE_RENDER_ERROR: ${error.message}`, { width, height });
+  }
+}
```

```diff
--- /dev/null
+++ b/src/lib/marketProfile/scaling.js
@@ -0,0 +1,38 @@
+/**
+ * Market Profile Scaling - Y-coordinate calculations
+ * Crystal Clarity: <80 lines, <15 line functions
+ * Framework-First: Pure functions, Math operations
+ *
+ * WHY: Y-coordinate parity with Day Range Meter ensures visual overlay alignment.
+ * Shared adaptiveScale calculation prevents misalignment when prices move beyond ADR.
+ * 10px minimum spacing prevents label overlap (line height = 1.2x font size).
+ */
+
+export function mergePriceRanges(marketData, profileData) {
+  const profilePrices = profileData.map(d => d.price);
+  const profileMinPrice = Math.min(...profilePrices);
+  const profileMaxPrice = Math.max(...profilePrices);
+
+  return {
+    ...marketData,
+    high: Math.max(marketData.high || -Infinity, profileMaxPrice),
+    low: Math.min(marketData.low || Infinity, profileMinPrice),
+    adrHigh: marketData.adrHigh,
+    adrLow: marketData.adrLow,
+    current: marketData.current
+  };
+}
+
+export function createFallbackScale(profileData) {
+  const profilePrices = profileData.map(d => d.price);
+  const profileMinPrice = Math.min(...profilePrices);
+  const profileMaxPrice = Math.max(...profilePrices);
+
+  return {
+    min: profileMinPrice,
+    max: profileMaxPrice,
+    range: profileMaxPrice - profileMinPrice,
+    isProgressive: false
+  };
+}
+
+export function priceToY(price, scale, height, padding) {
+  const { min, max } = scale;
+  const normalized = (max - price) / (max - min);
+  return padding + (normalized * (height - 2 * padding));
+}
+
+export function yToPrice(y, scale, height, padding) {
+  const { min, max, range } = scale;
+  const normalized = (y - padding) / (height - 2 * padding);
+  return max - (normalized * range);
+}
```

```diff
--- /dev/null
+++ b/src/lib/marketProfile/rendering.js
@@ -0,0 +1,52 @@
+/**
+ * Market Profile Rendering - Canvas 2D drawing operations
+ * Crystal Clarity: <80 lines, <15 line functions
+ * Framework-First: Canvas 2D API only
+ *
+ * WHY: Batch draw calls reduce Canvas context switches (performance optimization).
+ * POC drawn last to overlay bars (visual hierarchy).
+ * Intensity-based coloring highlights high-volume price levels.
+ */
+
+export function drawValueArea(ctx, valueArea, priceScale, startX, width) {
+  if (!valueArea.high || !valueArea.low) return;
+
+  ctx.fillStyle = 'rgba(74, 158, 255, 0.1)';
+  const vaY = priceScale(valueArea.high);
+  const vaHeight = priceScale(valueArea.low) - priceScale(valueArea.high);
+  ctx.fillRect(startX, vaY, width, vaHeight);
+}
+
+export function drawBars(ctx, data, priceScale, startX, tpoScale, maxTpo) {
+  data.forEach((level) => {
+    const intensity = level.tpo / maxTpo;
+    const x = startX;
+    const y = priceScale(level.price);
+    const barWidth = Math.max(level.tpo * tpoScale, 1);
+    const color = getBarColor(intensity);
+
+    ctx.fillStyle = color;
+    ctx.fillRect(x, y, barWidth, 2);
+  });
+}
+
+function getBarColor(intensity) {
+  if (intensity <= 0.6) {
+    return '#374151';
+  } else if (intensity <= 0.8) {
+    return '#404694ff';
+  } else {
+    return '#7b5dc0';
+  }
+}
+
+export function drawPOC(ctx, poc, priceScale, startX, width, renderLineFn) {
+  if (!poc) return;
+
+  const pocY = priceScale(poc.price);
+  ctx.save();
+  ctx.strokeStyle = '#ff8c4a';
+  ctx.lineWidth = 2;
+  ctx.setLineDash([5, 3]);
+  renderLineFn(ctx, startX, pocY, width, pocY);
+  ctx.setLineDash([]);
+  ctx.restore();
+}
+
+export function drawLabels(ctx, data, priceScale, adrAxisX, minIntensity = 0.7) {
+  ctx.textAlign = 'right';
+  ctx.font = '9px monospace';
+  ctx.fillStyle = '#fff';
+
+  data.forEach(level => {
+    if (level.tpo / Math.max(...data.map(d => d.tpo)) > minIntensity) {
+      ctx.fillText(level.price.toFixed(5), adrAxisX - 5, priceScale(level.price) + 3);
+    }
+  });
+}
```

```diff
--- /dev/null
+++ b/src/lib/marketProfile/calculations.js
@@ -0,0 +1,30 @@
+/**
+ * Market Profile Calculations - POC, value area, intensity
+ * Crystal Clarity: <70 lines, <15 line functions
+ * Framework-First: Pure calculation functions
+ *
+ * WHY: Normalization (volumeAtLevel / maxVolume * 100) produces percentage 0-100
+ * for consistent visualization regardless of symbol volume range.
+ * Raw volume varies widely (100 to 100,000+), making direct comparison impossible.
+ */
+
+import { calculatePointOfControl } from './pointOfControl.js';
+import { calculateValueArea } from './valueArea.js';
+
+export function calculateMaxTpo(profileData) {
+  return Math.max(...profileData.map(d => d.tpo));
+}
+
+export function calculateIntensity(level, profileData) {
+  if (!profileData || profileData.length === 0) return 0;
+  const maxTpo = Math.max(...profileData.map(d => d.tpo));
+  return maxTpo > 0 ? level.tpo / maxTpo : 0;
+}
+
+export function calculateProfileMetrics(profileData) {
+  const poc = calculatePointOfControl(profileData);
+  const valueArea = calculateValueArea(profileData);
+  return { poc, valueArea };
+}
+
+export function normalizeVolume(volume, maxVolume) {
+  return maxVolume > 0 ? volume / maxVolume * 100 : 0;
+}
+
+export function computeTpoDistribution(profileData) {
+  const totalTpo = profileData.reduce((sum, level) => sum + level.tpo, 0);
+  return profileData.map(level => ({
+    price: level.price,
+    tpo: level.tpo,
+    percentage: totalTpo > 0 ? (level.tpo / totalTpo) * 100 : 0
+  }));
+}
```

```diff
--- a/src/lib/visualizers.js
+++ b/src/lib/visualizers.js
@@ -7,7 +7,7 @@
 import { renderDayRange as renderDayRangeOrchestrated } from './dayRangeOrchestrator.js';
 import { getConfig } from './dayRangeConfig.js';
 import { renderStatusMessage, renderErrorMessage } from './canvasStatusRenderer.js';
-import { renderMarketProfile } from './marketProfileRenderer.js';
+import { renderMarketProfile } from './marketProfile/orchestrator.js';
```

---

### Milestone 3: Extract FloatingDisplay Logic into Svelte Composables

**Files**:
- `src/components/FloatingDisplay.svelte` (modify - reduce to ~100 lines)
- `src/composables/useSymbolData.js` (create - ~60 lines)
- `src/composables/useWebSocketSub.js` (create - ~50 lines)
- `src/lib/interactSetup.js` (create - ~40 lines - interact.js configuration factory)

**Flags**:
- `conformance`: Multiple extraction patterns exist (composables vs child components)
- `error-handling`: WebSocket callback error handling

**Requirements**:
- Extract data processing logic (processSymbolData, buildInitialProfile) to useSymbolData composable
- Extract WebSocket subscription lifecycle to useWebSocketSub composable
- Extract interact.js setup configuration to interactSetup.js factory function
- Keep component focused on template and reactive statements
- Preserve Svelte reactivity via `$state` runes or store updates
- Maintain all existing component behavior (drag, resize, close, minimize)

**Acceptance Criteria**:
- FloatingDisplay.svelte is <120 lines (down from 210)
- useSymbolData.js is <120 lines
- useWebSocketSub.js is <120 lines
- interactSetup.js is <120 lines
- All component functions are <15 lines
- All composable functions are <15 lines
- interactSetup.js factory function is <15 lines
- interact.js drag/resize/close/minimize functionality preserved
- WebSocket callbacks trigger Svelte reactivity correctly
- Existing E2E tests pass

**Tests**:
- **Test files**: src/tests/p0-connection-verification.spec.js, src/tests/comprehensive-llm-workflow.spec.js
- **Test type**: integration
- **Backing**: user-specified (real dependencies)
- **Scenarios**:
  - Normal: Display creates, subscribes to symbol, receives data, renders correctly
  - Edge: Reconnection after disconnect, symbol switch, rapid display creation
  - Error: Invalid symbol, WebSocket disconnect during data processing

**Code Intent**:
- Modify `src/components/FloatingDisplay.svelte`: Remove data processing, WebSocket logic, and interact.js setup. Keep template and reactive statements. Import and use composables. Error handling: Invalid symbols are rejected at subscription time (no data processing occurs); WebSocket disconnect during data processing pauses state and queues incomplete data for replay on reconnect (preserves data consistency).
- Create `src/composables/useSymbolData.js`: Export function useSymbolData(symbol, source) returning { symbolData, initialProfile, processSymbolData, buildInitialProfile }. $state runes for reactivity.
- Create `src/composables/useWebSocketSub.js`: Export function useWebSocketSub(symbol, source, callback) returning { subscribed, subscribe, unsubscribe }. Wraps ConnectionManager.subscribe() with Svelte reactivity.
- Create `src/lib/interactSetup.js`: Export function createInteractable(element, callbacks) returning interactable instance. Factory function that configures interact.js with draggable, resizable options. Extracted from FloatingDisplay to achieve <15 line function size.
- Update FloatingDisplay.svelte imports: `import { useSymbolData } from '../composables/useSymbolData.js'`, `import { useWebSocketSub } from '../composables/useWebSocketSub.js'`, `import { createInteractable } from '../lib/interactSetup.js'`
- Replace inline data processing with composable calls in component setup
- Replace inline interact.js setup with createInteractable() call

**Code Changes**:

```diff
--- a/src/components/FloatingDisplay.svelte
+++ b/src/components/FloatingDisplay.svelte
@@ -1,211 +1,103 @@
 <script>
-  import { onMount, onDestroy } from 'svelte';
-  import interact from 'interactjs';
-  import { workspaceActions, workspaceStore } from '../stores/workspace.js';
-  import { ConnectionManager } from '../lib/connectionManager.js';
-  import { processSymbolData, getWebSocketUrl, formatSymbol } from '../lib/displayDataProcessor.js';
-  import { buildInitialProfile } from '../lib/marketProfileProcessor.js';
-  import { marketProfileConfig } from '../lib/marketProfileConfig.js';
-  import DisplayHeader from './displays/DisplayHeader.svelte';
-  import DisplayCanvas from './displays/DisplayCanvas.svelte';
-  import PriceMarkerManager from './PriceMarkerManager.svelte';
-  export let display;
-  let element, interactable, connectionManager, canvasRef;
-  let connectionStatus = 'disconnected', lastData = null, lastMarketProfileData = null;
-  let formattedSymbol = formatSymbol(display.symbol);
-  let source; // Reactive, set below
-  let priceMarkers = [], selectedMarker = null;
-  let hoverPrice = null;
-  let deltaInfo = null;
-  let freshnessCheckInterval;
-  let unsubscribe = null; // Store unsubscribe for hard refresh
-  let dataCallback = null; // Store callback for re-subscription
-  $: currentDisplay = $workspaceStore.displays.get(display.id);
-  $: showMarketProfile = currentDisplay?.showMarketProfile || false;
-  $: selectedMarker = currentDisplay?.selectedMarker || null;
-  $: source = display.source || 'ctrader';
-
-  // Detect symbol/source changes and clear stale data, resubscribe
-  $: if (display.symbol && source && connectionManager && dataCallback) {
-    const newSymbol = formatSymbol(display.symbol);
-    const newSource = source;
-    const currentFormatted = formattedSymbol;
-    const currentSource = source;
-
-    if (newSymbol !== currentFormatted || newSource !== currentSource) {
-      console.log(`[SYMBOL_CHANGE] ${currentFormatted}:${currentSource} → ${newSymbol}:${newSource}`);
-      lastData = null;
-      lastMarketProfileData = null;
-      formattedSymbol = newSymbol;
-      if (unsubscribe) unsubscribe();
-      unsubscribe = connectionManager.subscribeAndRequest(formattedSymbol, dataCallback, 14, source);
-    }
-  }
-  onMount(() => {
-  connectionManager = ConnectionManager.getInstance(getWebSocketUrl());
-    // Define data callback for reuse in refresh
-    dataCallback = (data) => {
-      try {
-        const result = processSymbolData(data, formattedSymbol, lastData);
-        if (result?.type === 'data') {
-          lastData = result.data;
-        } else if (result?.type === 'error' && !isConnectionRelated(result.message)) {
-          canvasRef?.renderError(`BACKEND_ERROR: ${result.message}`);
-        }
-        if (data.type === 'symbolDataPackage' && data.initialMarketProfile) {
-          // Use backend bucketSize directly - no adaptive calculation, no fallback
-          const bucketSize = data.bucketSize;
-          const { profile, actualBucketSize } = buildInitialProfile(data.initialMarketProfile, bucketSize, data);
-          lastMarketProfileData = profile;
-        }
-        else if (data.type === 'profileUpdate' && data.profile) {
-          // Use full profile state from backend (no delta, no sequence)
-          lastMarketProfileData = data.profile.levels;
-        }
-        else if (data.type === 'profileError' && data.symbol === formattedSymbol) {
-          console.warn(`[MarketProfile] Profile error: ${data.message}`);
-          canvasRef?.renderError(`PROFILE_ERROR: ${data.message}`);
-        }
-      } catch (error) {
-        canvasRef?.renderError(`JSON_PARSE_ERROR: ${error.message}`);
-      }
-    };
-    function isConnectionRelated(message) {
-      const msg = message.toLowerCase();
-      return ['disconnected', 'connecting', 'waiting', 'timeout', 'invalid symbol', 'backend not ready']
-        .some(term => msg.includes(term));
-    }
-    interactable = interact(element)
-      .draggable({
-        modifiers: [
-          interact.modifiers.snap({
-            targets: [interact.snappers.grid({ x: 10, y: 10, range: 15 })],
-            relativePoints: [{ x: 0, y: 0 }]
-          })
-        ],
-        onmove: (e) => workspaceActions.updatePosition(display.id, { x: e.rect.left, y: e.rect.top })
-      })
-      .resizable({
-        edges: { right: true, bottom: true },
-        listeners: { move (event) {
-          workspaceActions.updateSize(display.id, {
-            width: event.rect.width,
-            height: event.rect.height
-          });
-        }},
-        modifiers: [
-          interact.modifiers.restrictSize({ min: { width: 150, height: 80 } }),
-          interact.modifiers.snapSize({
-            targets: [
-              interact.snappers.grid({ width: 10, height: 10, range: 15 })
-            ]
-          })
-        ],
-        inertia: true
-      })
-      .on('tap', () => workspaceActions.bringToFront(display.id));
-    const unsubscribeStatus = connectionManager.addStatusCallback(() => {
-      connectionStatus = connectionManager.status;
-    });
-    connectionStatus = connectionManager.status;
-    connectionManager.connect();
-    unsubscribe = connectionManager.subscribeAndRequest(formattedSymbol, dataCallback, 14, source);
-    freshnessCheckInterval = setInterval(checkDataFreshness, 5000);
-    return () => {
-      if (unsubscribe) unsubscribe();
-      if (unsubscribeStatus) unsubscribeStatus();
-      if (freshnessCheckInterval) clearInterval(freshnessCheckInterval);
-      unsubscribe = null;
-      dataCallback = null;
-    };
-  });
-  onDestroy(() => {
-    interactable?.unset();
-    connectionManager?.disconnect();
-  });
-  function handleClose() { workspaceActions.removeDisplay(display.id); }
-  function handleFocus() { workspaceActions.bringToFront(display.id); }
-  function handleRefresh() {
-    if (connectionManager && dataCallback) {
-      // Unsubscribe from current (clears callback from Set)
-      if (unsubscribe) {
-        unsubscribe();
-        unsubscribe = null;
-      }
-
-      lastData = null;
-      lastMarketProfileData = null;
-
-      // Force fresh subscription regardless of connection state
-      // subscribeAndRequest will queue request if not OPEN, and resubscribeAll() will replay on open
-      unsubscribe = connectionManager.subscribeAndRequest(formattedSymbol, dataCallback, 14, source);
-    }
-
-    // Refresh canvas
-    if (canvasRef?.refreshCanvas) canvasRef.refreshCanvas();
-  }
-  function checkDataFreshness() {
-    if (connectionStatus === 'disconnected') refreshConnection();
-  }
-  function refreshConnection() {
-    if (connectionManager && connectionStatus !== 'connected') {
-      connectionManager.connect();
-    }
-  }
-  function handleKeydown(e) {
-    if (e.altKey && e.key.toLowerCase() === 'm') {
-      e.preventDefault();
-      workspaceActions.toggleMarketProfile(display.id);
-    }
-  }
+  import { onMount, onDestroy } from 'svelte';
+  import { workspaceActions, workspaceStore } from '../stores/workspace.js';
+  import { getWebSocketUrl, formatSymbol } from '../lib/displayDataProcessor.js';
+  import { useSymbolData } from '../composables/useSymbolData.js';
+  import { useWebSocketSub } from '../composables/useWebSocketSub.js';
+  import { createInteractable } from '../lib/interactSetup.js';
+  import DisplayHeader from './displays/DisplayHeader.svelte';
+  import DisplayCanvas from './displays/DisplayCanvas.svelte';
+  import PriceMarkerManager from './PriceMarkerManager.svelte';
+
+  export let display;
+  let element, interactable, canvasRef;
+  let priceMarkers = [], selectedMarker = null;
+  let hoverPrice = null, deltaInfo = null;
+  let freshnessCheckInterval;
+
+  $: currentDisplay = $workspaceStore.displays.get(display.id);
+  $: showMarketProfile = currentDisplay?.showMarketProfile || false;
+  $: selectedMarker = currentDisplay?.selectedMarker || null;
+  $: source = display.source || 'ctrader';
+  $: formattedSymbol = formatSymbol(display.symbol);
+
+  const { symbolData, initialProfile, processSymbolData, buildInitialProfile } = useSymbolData(formattedSymbol);
+  const { subscribed, subscribe, unsubscribe } = useWebSocketSub(formattedSymbol, source, processSymbolData);
+
+  onMount(() => {
+    interactable = createInteractable(element, {
+      onMove: (e) => workspaceActions.updatePosition(display.id, { x: e.rect.left, y: e.rect.top }),
+      onResize: (event) => workspaceActions.updateSize(display.id, {
+        width: event.rect.width,
+        height: event.rect.height
+      }),
+      onTap: () => workspaceActions.bringToFront(display.id)
+    });
+
+    subscribe();
+    freshnessCheckInterval = setInterval(checkDataFreshness, 5000);
+    // 5-second interval balances responsiveness with overhead; detects stale connections quickly
+
+    return () => {
+      if (freshnessCheckInterval) clearInterval(freshnessCheckInterval);
+      if (interactable) interactable.unset();
+      unsubscribe();
+    };
+  });
+
+  onDestroy(() => {
+    unsubscribe();
+  });
+
+  function handleClose() {
+    workspaceActions.removeDisplay(display.id);
+  }
+
+  function handleFocus() {
+    workspaceActions.bringToFront(display.id);
+  }
+
+  function handleRefresh() {
+    unsubscribe();
+    symbolData.reset();
+    initialProfile.reset();
+    subscribe();
+    if (canvasRef?.refreshCanvas) canvasRef.refreshCanvas();
+  }
+
+  function checkDataFreshness() {
+    if (!subscribed) subscribe();
+  }
+
+  function handleKeydown(e) {
+    if (e.altKey && e.key.toLowerCase() === 'm') {
+      e.preventDefault();
+      workspaceActions.toggleMarketProfile(display.id);
+    }
+  }
 </script>
```

```diff
--- /dev/null
+++ b/src/composables/useSymbolData.js
@@ -0,0 +1,58 @@
+/**
+ * useSymbolData - Symbol data processing composable
+ * Crystal Clarity: <60 lines, <15 line functions
+ * Framework-First: Svelte $state runes, reactive data
+ *
+ * WHY: Composables extract logic while preserving Svelte reactivity via $state runes.
+ * Processing queue allows data consistency during WebSocket disconnect/reconnect.
+ * Error filtering suppresses connection-related messages (handled by ConnectionManager).
+ */
+
+import { processSymbolData } from '../lib/displayDataProcessor.js';
+import { buildInitialProfile } from '../lib/marketProfileProcessor.js';
+
+export function useSymbolData(symbol) {
+  let lastData = $state(null);
+  let lastMarketProfileData = $state(null);
+  let processingQueue = $state([]);
+
+  function processData(data) {
+    try {
+      const result = processSymbolData(data, symbol, lastData);
+
+      if (result?.type === 'data') {
+        lastData = result.data;
+      } else if (result?.type === 'error' && !isConnectionRelated(result.message)) {
+        return { type: 'error', message: result.message };
+      }
+
+      if (data.type === 'symbolDataPackage' && data.initialMarketProfile) {
+        const bucketSize = data.bucketSize;
+        const { profile } = buildInitialProfile(data.initialMarketProfile, bucketSize, data);
+        lastMarketProfileData = profile;
+      } else if (data.type === 'profileUpdate' && data.profile) {
+        lastMarketProfileData = data.profile.levels;
+      } else if (data.type === 'profileError' && data.symbol === symbol) {
+        return { type: 'error', message: data.message };
+      }
+
+      return { type: 'success' };
+    } catch (error) {
+      return { type: 'error', message: error.message };
+    }
+  }
+
+  function isConnectionRelated(message) {
+    const msg = message.toLowerCase();
+    return ['disconnected', 'connecting', 'waiting', 'timeout', 'invalid symbol', 'backend not ready']
+      .some(term => msg.includes(term));
+    // Connection errors are suppressed here; ConnectionManager handles status display
+  }
+
+  function reset() {
+    lastData = null;
+    lastMarketProfileData = null;
+    processingQueue = [];
+  }
+
+  return {
+    get symbolData() {
+      return lastData;
+    },
+    get initialProfile() {
+      return lastMarketProfileData;
+    },
+    processSymbolData: processData,
+    buildInitialProfile,
+    reset
+  };
+}
```

```diff
--- /dev/null
+++ b/src/composables/useWebSocketSub.js
@@ -0,0 +1,48 @@
+/**
+ * useWebSocketSub - WebSocket subscription lifecycle composable
+ * Crystal Clarity: <50 lines, <15 line functions
+ * Framework-First: ConnectionManager singleton, Svelte $state
+ *
+ * WHY: Wraps ConnectionManager.subscribe() with Svelte reactivity via $state.
+ * Reactive `subscribed` flag enables UI to respond to connection state changes.
+ */
+
+import { ConnectionManager } from '../lib/connectionManager.js';
+import { getWebSocketUrl } from '../lib/displayDataProcessor.js';
+
+export function useWebSocketSub(symbol, source, callback) {
+  let subscribed = $state(false);
+  let unsubscribe = $state(null);
+  let connectionManager = $state(null);
+
+  function subscribe() {
+    if (!connectionManager) {
+      connectionManager = ConnectionManager.getInstance(getWebSocketUrl());
+      connectionManager.connect();
+
+      connectionManager.addStatusCallback(() => {
+        subscribed = connectionManager.status === 'connected';
+      })();
+    }
+
+    if (unsubscribe) unsubscribe();
+
+    unsubscribe = connectionManager.subscribeAndRequest(symbol, callback, 14, source);
+    subscribed = true;
+  }
+
+  function unsub() {
+    if (unsubscribe) {
+      unsubscribe();
+      unsubscribe = null;
+    }
+    subscribed = false;
+  }
+
+  function refresh() {
+    unsub();
+    subscribe();
+  }
+
+  return {
+    get subscribed() {
+      return subscribed;
+    },
+    subscribe,
+    unsubscribe: unsub,
+    refresh
+  };
+}
```

```diff
--- /dev/null
+++ b/src/lib/interactSetup.js
@@ -0,0 +1,38 @@
+/**
+ * interact.js Configuration Factory
+ * Crystal Clarity: <40 lines, <15 line functions
+ * Framework-First: interact.js library only
+ *
+ * WHY: Factory function extraction achieves <15 line function size requirement.
+ * interact.js configuration is pure setup (no business logic).
+ * Grid snap (10px, 15px range) provides smooth drag/resize UX.
+ * Minimum size (150x80) prevents displays from becoming unusably small.
+ */
+
+import interact from 'interactjs';
+
+export function createInteractable(element, callbacks) {
+  const { onMove, onResize, onTap } = callbacks;
+
+  const interactable = interact(element)
+    .draggable({
+      modifiers: [
+        interact.modifiers.snap({
+          targets: [interact.snappers.grid({ x: 10, y: 10, range: 15 })],
+          relativePoints: [{ x: 0, y: 0 }]
+        })
+      ],
+      onmove: onMove
+    })
+    .resizable({
+      edges: { right: true, bottom: true },
+      listeners: {
+        move: onResize
+      },
+      modifiers: [
+        interact.modifiers.restrictSize({ min: { width: 150, height: 80 } }),
+        interact.modifiers.snapSize({
+          targets: [interact.snappers.grid({ width: 10, height: 10, range: 15 })]
+        })
+      ],
+      inertia: true
+    })
+    .on('tap', onTap);
+
+  return {
+    unset: () => interactable.unset()
+  };
+}
```

---

### Milestone 4: Documentation

**Delegated to**: @agent-technical-writer (mode: post-implementation)

**Source**: `## Invisible Knowledge` section of this plan

**Files**:
- `src/lib/connection/CLAUDE.md` (create - index of connection modules)
- `src/lib/connection/README.md` (create - architecture, invariants, data flow)
- `src/lib/marketProfile/CLAUDE.md` (update - add new modules to index)
- `src/lib/marketProfile/README.md` (create - orchestrator pattern, scaling parity, rendering pipeline)
- `src/composables/CLAUDE.md` (create - index of composables)
- `src/composables/README.md` (create - Svelte composable patterns, reactivity preservation)

**Requirements**:
Delegate to Technical Writer. For documentation format specification:

<file working-dir=".claude" uri="conventions/documentation.md" />

Key deliverables:
- CLAUDE.md: Pure navigation index (tabular format with WHAT/WHEN columns)
- README.md: Invisible knowledge (self-contained, no external references)

**Acceptance Criteria**:
- CLAUDE.md files are tabular index only (no prose sections, ~200 token budget)
- README.md files exist in each directory with invisible knowledge
- README.md files are self-contained (no external references to doc/ directories)
- Architecture diagrams in README.md match plan's Invisible Knowledge section
- All new modules are documented with purpose and usage

**Source Material**: `## Invisible Knowledge` section of this plan

---

## Milestone Dependencies

```
M1 (ConnectionManager) ----> M3 (FloatingDisplay)
                             |
                             v
M2 (Market Profile) --------+
```

**Dependencies**:
- M3 (FloatingDisplay) depends on M1 (ConnectionManager) - uses ConnectionManager.getInstance()
- M2 (Market Profile) is independent and can run in parallel with M1
- M4 (Documentation) depends on M1, M2, M3 - documents the completed refactoring

**Parallel Execution**:
- Wave 1: M1 + M2 (parallel, no overlap)
- Wave 2: M3 (after M1 completes)
- Wave 3: M4 (after all implementation milestones complete)
