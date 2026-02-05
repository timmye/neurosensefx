# Backend Connection Management - Framework-First Refactor Plan

**Status:** Planning Complete | Implementation Pending
**Created:** 2026-02-03
**Reference:** docs/backend-connection-management-assessment.md

---

## Overview

The backend connection architecture contains an unnecessary abstraction layer (`libs/cTrader-Layer/`) that causes silent connection failures. The wrapper layers (`CTraderSocket.ts`, `CTraderConnection.ts`) swallow socket events, preventing proper reconnection detection.

This plan implements a **Framework-First Refactor** that removes the abstraction layer and uses native Node.js `tls.connect()` directly in `CTraderSession.js`. The result is net -110 lines of code, improved Crystal Clarity compliance, and reliable connection failure detection.

**Key Decision:** Phased refactor with test-first approach. Tests validate behavior before refactoring begins, ensuring correctness and enabling safe rollback via feature flag.

---

## Planning Context

### Decision Log

| Decision | Reasoning Chain |
|----------|-----------------|
| **Phased Refactor over Minimal Patch** | Patch treats symptoms not root cause | Abstraction layer is the problem | Removing it achieves Crystal Clarity compliance |
| **Test-First Approach** | No backend unit tests exist today | Refactoring changes core connection behavior | Tests catch regressions before they reach production |
| **Property-Based Unit Tests** | Connection logic has thresholds (backoff, staleness) | Property tests cover wide input space | Few tests catch edge cases humans miss |
| **Real Dependencies for Integration** | Integration tests validate end-user behavior | Mocks don't catch real socket behavior | Testcontainers approach validates actual TLS connection |
| **Socket Destroy for Failure Tests** | Half-open sockets are the silent failure mode | `socket.destroy()` without close event simulates this | Simpler than network simulation (iptables/tc) |
| **Feature Flag Rollout** | Refactor removes files - hard to rollback | Feature flag enables gradual rollout | Can revert to old code by flipping flag |
| **Native tls.connect() over Wrapper** | Wrapper adds no value and breaks events | Native socket supports keepalive and timeouts | Framework-First principle: use what Node provides |
| **TCP Keepalive Enabled** | Silent failures occur when network drops | Keepalive detects idle connections | 60s initial delay matches cTrader session timeout |
| **HealthMonitor Threshold 30s** | Original was 60s staleness detection | 30s provides faster user feedback | Trade-off: more frequent reconnection attempts for better UX |
| **Event Emission Pattern** | Original code orphaned stale/tick_resumed events | WebSocketServer never listened | Wiring events enables user-visible status |

### Rejected Alternatives

| Alternative | Why Rejected |
|-------------|--------------|
| Minimal Patch (fix handlers only) | Leaves broken abstraction in place, tech debt remains |
| Aggressive Full Replace (big bang) | No intermediate rollback points, highest risk |
| Event Bus Architecture | Adds abstraction layer, violates Framework-First |
| State Machine Pattern | Over-engineering for simple connected/disconnected states |
| Keep Custom Heartbeat | Native WebSocket ping/pong is Framework-First |

### Constraints & Assumptions

**Technical:**
- Node.js native `tls.connect()` supports all cTrader requirements
- cTrader API supports reconnection after socket drop
- TCP keepalive is supported at OS level
- Property-based testing using `fast-check` library

**Organizational:**
- Tests must pass before each refactor milestone
- Feature flag enables safe rollout
- Backend can be restarted without data loss

**Dependencies:**
- `@reiryoku/ctrader-layer` package will be simplified (not removed)
- Standalone scripts (`basket-historical-reconstructor.cjs`, `stream-real.cjs`) require import updates

**Default Conventions Applied:**
- `<default-conventions domain="testing">`: Integration tests with real dependencies, property-based unit tests
- `<default-conventions domain="testing-strategy">`: Property-based for unit, real deps for integration

### Known Risks

| Risk | Mitigation | Anchor |
|------|------------|--------|
| Breaking change to standalone scripts | Update imports in Milestone 5 | `scripts/basket-historical-reconstructor.cjs:28` imports CTraderConnection |
| No rollback plan (files deleted) | Feature flag enables old code path | `services/tick-backend/CTraderSession.js:4` |
| Missing test coverage | Milestone 1 creates tests first | No backend tests exist today |
| Frontend doesn't handle stale events | Milestone 4 adds broadcast | `services/tick-backend/WebSocketServer.js:215` |
| TradingViewSession similar pattern | Document as acceptable variance | Uses external `tradingview-ws` library |
| Feature flag complexity | Simple boolean flag in CTraderSession | New config: `USE_NATIVE_SOCKET` |

---

## Invisible Knowledge

### Architecture

```
BEFORE (Broken):
┌─────────────────────────────────────────────────────────────┐
│  CTraderSession (210 lines)                                 │
│    └─→ CTraderConnection (157 lines, wrapper)               │
│          └─→ CTraderSocket (53 lines, silent handlers)      │
│                └─→ tls.connect() (native)                   │
└─────────────────────────────────────────────────────────────┘
              HealthMonitor emits stale events ────────┐
                                                        │
WebSocketServer ──X (doesn't listen)                    │
                                                        ▼
                                                    (orphaned)

AFTER (Framework-First):
┌─────────────────────────────────────────────────────────────┐
│  CTraderSession (~120 lines)                                │
│    ├─→ tls.connect() (direct, native)                      │
│    ├─→ CTraderProtocol (protobuf utility)                  │
│    └─→ HealthMonitor (wired events) ──────┐               │
└─────────────────────────────────────────────┼───────────────┘
                                               │
                              WebSocketServer ◄┘ (broadcasts to frontend)
                                               │
                                               ▼
                                        User sees status
```

### Data Flow

```
Connection Lifecycle:
connect() → tls.connect() → socket.on('connect') → handleConnect()
                                                ↓
                            socket.on('close') → handleDisconnect()
                                                ↓
                                    emit('disconnected') → WebSocketServer
                                                ↓
                                            Reconnection scheduled

Data Flow:
socket.on('data') → protobuf.decode() → handleTick()
                            ↓
                    healthMonitor.recordTick()
                            ↓
                    emit('tick') → WebSocketServer → Frontend

Staleness Detection:
healthMonitor.checkStaleness() → no ticks for 30s → emit('stale')
                                                        ↓
                            CTraderSession.on('stale') → WebSocketServer.broadcast()
                                                        ↓
                                            Frontend displays warning
```

### Why This Structure

The original architecture used cTrader-Layer as an abstraction layer, but this violated Framework-First principles:
- The wrapper added no value over native `tls.connect()`
- Event handlers were empty no-ops ("Silence is golden"), breaking event propagation
- Each layer swallowed events, creating an "event cascade failure"

The refactor removes the abstraction and uses native framework capabilities directly:
- **Direct socket management**: No intermediate layers to lose events
- **Framework-First**: Leverages Node.js built-in `tls` module
- **Wired events**: HealthMonitor events flow to WebSocketServer to frontend
- **Simpler**: Fewer files, fewer lines, clearer intent

### Invariants

- Socket `close` event MUST trigger reconnection attempt
- Socket `error` event MUST be logged and trigger reconnection
- HealthMonitor `stale` event MUST be broadcast to frontend
- HealthMonitor `tick_resumed` event MUST be broadcast to frontend
- TCP keepalive MUST be enabled on all sockets
- Reconnection MUST use exponential backoff (1s → 2s → 4s → 8s → 16s → 60s max)
- Staleness threshold is 30 seconds (faster than original 60s)

### Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Remove abstraction layer | Simpler, fewer bugs, Framework-First | One-time migration effort |
| Test-first approach | Safety, regression detection | Longer initial timeline |
| 30s staleness threshold | Faster user feedback | More reconnection attempts |
| Native tls.connect() | Full control, no wrapper overhead | More direct socket management |
| Feature flag | Safe rollback | Code complexity (two paths) |

---

## Milestones

### Milestone 1: Test Infrastructure

**Files**:
- `services/tick-backend/tests/connection-lifecycle.test.js` (NEW)
- `services/tick-backend/tests/staleness-detection.test.js` (NEW)
- `services/tick-backend/tests/reconnection-logic.test.js` (NEW)
- `services/tick-backend/tests/integration/ctrader-session-integration.test.js` (NEW)
- `services/tick-backend/tests/integration/half-open-socket-simulation.test.js` (NEW)
- `services/tick-backend/package.json` (MODIFY - add test dependencies)

**Flags**:
- `testing`: All tests must pass before refactor begins

**Requirements**:
- Create backend test directory structure
- Add `fast-check` for property-based tests
- Add `node:test` for integration tests
- Write tests for CURRENT implementation (before refactor)
- All tests must pass with existing code

**Acceptance Criteria**:
- `npm test` in services/tick-backend passes all tests
- Property-based tests cover backoff calculation and staleness thresholds
- Integration tests validate full connection lifecycle
- Half-open socket simulation validates silent failure detection

**Tests**:
- **Test files**: See Files list above
- **Test type**: Property-based (unit), Integration (real deps)
- **Backing**: user-specified
- **Scenarios**:
  - Normal: Successful connection, data flow, reconnection
  - Edge: Max retries exhausted, zero delay, concurrent reconnections
  - Error: Socket destroy without close event, authentication failure

**Code Intent**:
- Create test directory `services/tick-backend/tests/`
- Add test dependencies to `package.json`: `fast-check`, `node:test`
- Write connection lifecycle tests covering connect, close, error events
- Write staleness detection tests using property-based approach
- Write reconnection logic tests for exponential backoff
- Write integration tests with real cTrader connection
- Write half-open socket simulation (socket.destroy without close)
- Add test script to package.json: `"test": "node --test tests/**/*.test.js"`

**Code Changes**: (Developer to fill after plan approval)

---

### Milestone 2: Protocol Utilities Extraction

**Files**:
- `services/tick-backend/utils/CTraderProtocol.js` (NEW)
- `services/tick-backend/CTraderSession.js` (MODIFY - imports)
- `libs/cTrader-Layer/src/core/CTraderConnection.ts` (MODIFY - export utilities)
- `libs/cTrader-Layer/src/core/encoder-decoder/CTraderEncoderDecoder.ts` (COPY)
- `libs/cTrader-Layer/src/core/protobuf/CTraderProtobufReader.ts` (COPY)

**Flags**:
- `conformance`: Ensure utilities match Crystal Clarity patterns

**Requirements**:
- Extract protobuf encode/decode utilities from cTrader-Layer
- Create standalone protocol utility module
- Update CTraderSession to import new utilities
- Keep cTrader-Layer package (simplified, not removed)

**Acceptance Criteria**:
- CTraderSession imports from `utils/CTraderProtocol.js`
- Protobuf encode/decode works identically to before
- All existing tests pass
- No changes to observable behavior

**Tests**:
- **Test files**: Extends Milestone 1 tests
- **Test type**: Integration
- **Backing**: user-specified
- **Scenarios**:
  - Normal: Protobuf encode/decode produces same results
  - Edge: Empty payload, malformed message
  - Error: Invalid protobuf data

**Code Intent**:
- Create new file `services/tick-backend/utils/CTraderProtocol.js`
- Copy `encode()` and `decode()` methods from CTraderEncoderDecoder
- Copy protobuf utility methods from CTraderProtobufReader
- Export as module: `module.exports = { encode, decode, getPayloadTypeByName }`
- Update CTraderSession.js line 4: Change import from `@reiryoku/ctrader-layer` to `./utils/CTraderProtocol.js`
- Keep cTrader-Layer package.json entry (will simplify in later milestone)
- Add JSDoc comments explaining protocol utilities are for cTrader message format

**Code Changes**: (Developer to fill after plan approval)

---

### Milestone 3: Direct Socket Integration

**Files**:
- `services/tick-backend/CTraderSession.js` (MODIFY - major refactor)
- `services/tick-backend/.env.example` (MODIFY - add USE_NATIVE_SOCKET flag)

**Flags**:
- `error-handling`: Socket error paths are critical
- `needs-rationale`: TCP keepalive threshold needs justification
- `conformance`: Follow Crystal Clarity Framework-First principle

**Requirements**:
- Refactor CTraderSession to use native `tls.connect()` directly
- Implement socket event handlers (connect, close, error, data)
- Add TCP keepalive with 60s initial delay
- Add feature flag `USE_NATIVE_SOCKET` for safe rollout
- Remove CTraderConnection wrapper usage
- Keep all existing behavior (authentication, symbol loading, heartbeat)

**Acceptance Criteria**:
- CTraderSession connects using native `tls.connect()`
- Socket events trigger appropriate handlers
- TCP keepalive enabled on socket
- Feature flag allows switching between old and new code
- All existing tests pass
- New tests for socket event handling pass

**Tests**:
- **Test files**: Extends Milestone 1 tests
- **Test type**: Integration
- **Backing**: user-specified
- **Scenarios**:
  - Normal: Successful connection with native socket
  - Edge: Feature flag off uses old code, flag on uses new
  - Error: Socket error triggers reconnection

**Code Intent**:
- In CTraderSession.js `connect()` method:
  - Add feature flag check: `if (process.env.USE_NATIVE_SOCKET !== 'true') { /* old code */ }`
  - For new code path: Use `tls.connect()` directly instead of CTraderConnection
  - Add socket options: `{ keepAlive: true, keepAliveInitialDelay: 60000 }`
  - Register event handlers: `socket.on('connect', ...)`, `socket.on('close', ...)`, `socket.on('error', ...)`, `socket.on('data', ...)`
- Remove `this.connection = new CTraderConnection(...)` usage
- Keep authentication, symbol loading, heartbeat logic unchanged
- Add `handleSocketClose()` and `handleSocketError()` methods
- Update `handleDisconnect()` to work with native socket
- Add `.env.example` entry: `USE_NATIVE_SOCKET=false` (default off for safety)

**Code Changes**: (Developer to fill after plan approval)

---

### Milestone 4: HealthMonitor Event Wiring

**Files**:
- `services/tick-backend/CTraderSession.js` (MODIFY - wire HealthMonitor events)
- `services/tick-backend/WebSocketServer.js` (MODIFY - add event handlers)
- `services/tick-backend/HealthMonitor.js` (MODIFY - reduce threshold to 30s)

**Flags**:
- `error-handling`: Staleness is an error condition
- `needs-rationale`: 30s threshold needs justification

**Requirements**:
- Wire HealthMonitor `stale` and `tick_resumed` events in CTraderSession
- Add event handlers in WebSocketServer for these events
- Broadcast staleness status to frontend
- Reduce staleness threshold from 60s to 30s

**Acceptance Criteria**:
- CTraderSession emits `stale` event when HealthMonitor detects staleness
- CTraderSession emits `tick_resumed` event when data resumes
- WebSocketServer broadcasts `stale` status to frontend
- WebSocketServer broadcasts `connected` status on tick_resumed
- Staleness threshold is 30 seconds
- New tests for event wiring pass

**Tests**:
- **Test files**: Extends Milestone 1 tests
- **Test type**: Integration
- **Backing**: user-specified
- **Scenarios**:
  - Normal: Staleness detected and broadcast, recovery broadcast
  - Edge: Staleness threshold at exactly 30s
  - Error: Multiple stale/resume cycles

**Code Intent**:
- In CTraderSession.js constructor:
  - Add `this.healthMonitor.on('stale', () => this.handleStale())`
  - Add `this.healthMonitor.on('tick_resumed', () => this.handleTickResumed())`
- Add `handleStale()` method: Emit `stale` event to WebSocketServer
- Add `handleTickResumed()` method: Emit `tick_resumed` event to WebSocketServer
- In WebSocketServer.js constructor:
  - Add `this.cTraderSession.on('stale', () => this.handleStale())`
  - Add `this.cTraderSession.on('tick_resumed', () => this.handleTickResumed())`
- Add `handleStale()` method in WebSocketServer: Broadcast `{ type: 'status', status: 'stale' }`
- Add `handleTickResumed()` method in WebSocketServer: Broadcast `{ type: 'status', status: 'connected' }`
- In HealthMonitor.js: Change default `stalenessMs` from 60000 to 30000

**Code Changes**: (Developer to fill after plan approval)

---

### Milestone 5: Cleanup & Documentation

**Files**:
- `libs/cTrader-Layer/src/core/sockets/CTraderSocket.ts` (DELETE)
- `libs/cTrader-Layer/src/core/CTraderConnection.ts` (SIMPLIFY)
- `scripts/basket-historical-reconstructor.cjs` (MODIFY - update imports)
- `services/tick-backend/stream-real.cjs` (MODIFY - update imports)
- `services/tick-backend/CLAUDE.md` (UPDATE)
- `services/tick-backend/README.md` (CREATE)
- `docs/backend-connection-refactor-complete.md` (CREATE)

**Flags**:
- `conformance`: Ensure Crystal Clarity compliance

**Requirements**:
- Delete CTraderSocket.ts (no longer needed)
- Simplify CTraderConnection.ts to protocol utilities only
- Update standalone script imports
- Update documentation
- Enable feature flag by default (USE_NATIVE_SOCKET=true)

**Acceptance Criteria**:
- CTraderSocket.ts deleted (53 lines removed)
- CTraderConnection.ts simplified (~50 lines, protocol utilities only)
- Standalone scripts import from new locations
- CLAUDE.md updated with new structure
- README.md documents connection architecture
- All tests pass
- Net -110 lines achieved

**Tests**:
- **Test files**: Extends Milestone 1 tests
- **Test type**: Integration
- **Backing**: user-specified
- **Scenarios**:
  - Normal: Standalone scripts work with new imports
  - Edge: None (cleanup milestone)

**Code Intent**:
- Delete `libs/cTrader-Layer/src/core/sockets/CTraderSocket.ts`
- Simplify `libs/cTrader-Layer/src/core/CTraderConnection.ts`: Remove socket management, keep only protobuf utilities
- Update `scripts/basket-historical-reconstructor.cjs`: Change import to `../../services/tick-backend/utils/CTraderProtocol.js`
- Update `services/tick-backend/stream-real.cjs`: Change import to `./utils/CTraderProtocol.js`
- Update `services/tick-backend/.env.example`: Change `USE_NATIVE_SOCKET=true` (enable by default)
- Create `services/tick-backend/README.md`: Document connection architecture, event flow, testing
- Update `services/tick-backend/CLAUDE.md`: Add files index
- Create `docs/backend-connection-refactor-complete.md`: Summary of changes, metrics, verification

**Code Changes**: (Developer to fill after plan approval)

---

### Milestone 6: Documentation

**Delegated to**: @agent-technical-writer (mode: post-implementation)

**Source**: `## Invisible Knowledge` section of this plan

**Files**:
- `services/tick-backend/CLAUDE.md` (UPDATE)
- `services/tick-backend/README.md` (CREATE)

**Requirements**:
- CLAUDE.md: Tabular index format (WHAT/WHEN columns)
- README.md: Self-contained architecture documentation
- No external references (summarize inline)
- Architecture diagrams match Invisible Knowledge

**Acceptance Criteria**:
- CLAUDE.md is pure navigation index
- README.md exists with architecture, data flow, invariants, tradeoffs
- README.md is self-contained (no links to docs/ directories)
- All invisible knowledge captured

**Source Material**: `## Invisible Knowledge` section of this plan

---

## Milestone Dependencies

```
M1 (Test Infrastructure)
    │
    ├──→ M2 (Protocol Utilities)
    │           │
    │           └──→ M3 (Direct Socket Integration)
    │                       │
    │                       └──→ M4 (HealthMonitor Event Wiring)
    │                                   │
    │                                   └──→ M5 (Cleanup & Documentation)
    │                                               │
    │                                               └──→ M6 (Documentation)
    │
M1 must pass before any refactor milestone begins.
```

---

## Testing Strategy Summary

| Test Type | Tool | Backing | Coverage |
|-----------|------|---------|----------|
| Property-based Unit | `fast-check` | user-specified | Backoff calculation, staleness thresholds |
| Integration | `node:test` | user-specified | Full connection lifecycle with real cTrader |
| Socket Failure | Programmatic destroy | user-specified | Half-open socket detection |
| E2E | `playwright` (existing) | doc-derived | Extend existing tests for staleness UI |

---

## Success Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Total Lines (backend connection) | 420 | 310 | -110 |
| Files | 3 (CTraderSession + 2 wrappers) | 2 (CTraderSession + Protocol) | -1 |
| Crystal Clarity Compliance | Violates | Complies | 100% |
| Test Coverage (backend) | 0% | >80% | >80% |
| Silent Failure Detection | None | 30s staleness | <30s |
| Time to Detect Disconnect | >60s (or never) | ~30s | <30s |

---

## Rollback Plan

**Feature Flag Rollback:**
1. Set `USE_NATIVE_SOCKET=false` in environment
2. Restart backend service
3. System reverts to old CTraderConnection wrapper

**Git Revert:**
1. If feature flag not available, revert commit
2. Restore deleted files (CTraderSocket.ts, CTraderConnection.ts)
3. Restore old imports in standalone scripts
4. Restart backend service

**Post-Rollback Verification:**
1. Run test suite: `npm test`
2. Run E2E tests: `npx playwright test`
3. Verify connection status in frontend
4. Monitor for silent failures

---

**Last Updated:** 2026-02-03
