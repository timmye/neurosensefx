# TWAP Verification & Refactoring Plan

## Overview

The TWAP (Time-Weighted Average Price) feature is already fully implemented in the NeuroSense FX codebase. This plan verifies the implementation works correctly, removes weekend-specific logic to match existing Day Range behavior, fixes any bugs discovered, and refactors TWAP-specific code to reduce file size.

The chosen approach follows a **verify-first-then-refactor** strategy: run existing E2E tests to confirm functionality, remove weekend exclusion logic (TWAP should behave like other functions - no special weekend handling), fix any issues found, then simplify TwapService.js by removing complex session reset logic.

**Scope Change:** Weekend exclusion and FX market session logic are being removed. TWAP will now:
- Include all M1 bars (Saturday/Sunday bars processed normally)
- Reset session based on daily bar boundaries (matching Day Range behavior)
- Use simple accumulation without complex time-based session logic

## Planning Context

This section is consumed VERBATIM by downstream agents (Technical Writer, Quality Reviewer).

### Decision Log

| Decision | Reasoning Chain |
|----------|-----------------|
| **Verify-first-then-refactor approach** | Existing code may have bugs -> refactoring before fixing risks propagating bugs -> verifying first provides baseline confidence -> fixes and refactoring are distinct activities |
| **Remove weekend exclusion logic** | User requested TWAP match other functions' behavior -> Day Range uses daily bars without weekend filtering -> TWAP should process all M1 bars consistently -> removes complexity and aligns with existing patterns |
| **Session reset matches Day Range** | User requested TWAP restart same time as other functions -> Day Range uses daily bar boundaries (D1 bars) -> TWAP should reset on same boundary -> consistent behavior across all calculations |
| **No unit tests for TwapService.js** | User explicitly declined unit tests -> existing E2E tests provide behavior-level coverage -> backend logic is simple accumulator -> E2E tests cover TWAP calculation scenarios |
| **Simplify TwapService.js** | Removing weekend/session reset logic simplifies code -> less complexity means fewer bugs -> easier to maintain -> no need for utility extraction |
| **Refactor only TWAP-specific files** | Other files (WebSocketServer.js, RequestCoordinator.js) already exceeded limits pre-TWAP -> refactoring those is out of scope -> user confirmed "Twap code only" -> minimize change surface area |

### Rejected Alternatives

| Alternative | Why Rejected |
|-------------|--------------|
| **FX market session (22:00 UTC)** | User requested TWAP match other functions' behavior -> Day Range doesn't use special session times -> TWAP should use same boundaries as Day Range -> simpler and more consistent |
| **Weekend exclusion logic** | User explicitly requested removal -> "Remove weekend data from scope" -> weekend or not, TWAP should restart same time as all other functions -> removes unnecessary complexity |
| **Test-driven refactoring** | Requires writing new tests first -> user declined unit tests -> E2E tests already exist -> adds unnecessary process overhead |
| **Split TwapService into multiple files** | Removing weekend/session logic significantly reduces code size -> splitting not needed after simplification -> Crystal Clarity prefers simplicity over file splitting |
| **Refactor all files exceeding 120 lines** | WebSocketServer.js and RequestCoordinator.js were already non-compliant before TWAP -> out of scope for this work -> user confirmed "Twap code only" -> minimizes risk scope |

### Constraints & Assumptions

**Constraints:**
- Crystal Clarity file size limit: 120 lines maximum per file
- TWAP-specific files only for refactoring scope
- E2E tests only (no new unit tests per user request)
- Framework-first: EventEmitter, Canvas 2D, Svelte, native WebSocket
- Price method: Close price only for calculation
- **Session reset:** Matches Day Range (daily bar boundaries)
- **Weekend handling:** No special handling - process all M1 bars

**Assumptions:**
- Existing TWAP E2E tests exist and can be run
- Backend service must be running for E2E tests
- cTrader/TradingView M1 bar stream is functional
- Historical M1 bars available in `initialMarketProfile`
- Refactoring will not change TWAP calculation behavior

**Default-conventions applied:**
- `<default-conventions domain="testing">` - E2E tests preferred over unit tests
- `<default-conventions domain="testing">` - Integration tests with real dependencies
- `<default-conventions domain="file-creation">` - Extract utilities only when clear boundary exists

### Known Risks

| Risk | Mitigation | Anchor |
|------|------------|--------|
| **Removing weekend logic breaks TWAP** | Run E2E tests before and after each change | `src/tests/e2e/twap.spec.js` validates TWAP value |
| **Session reset mismatch with Day Range** | Verify reset timing matches daily bar boundaries | `TwapService.js` will use same boundary logic |
| **History initialization failure** | Test mid-session join behavior | `TwapService.js:18-45` processes `initialMarketProfile` |
| **Canvas rendering regression** | Visual screenshot verification in E2E | `src/tests/e2e/twap.spec.js` captures screenshots |

## Invisible Knowledge

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                │
├─────────────────────────────────────────────────────────────────┤
│  FloatingDisplay.svelte → displayDataProcessor.js              │
│                                    ↓                            │
│  WebSocket 'twapUpdate' → { twap, twapContributions, ... }     │
│                                    ↓                            │
│  dayRangeOrchestrator.js → priceMarkerRenderer.js              │
│                                    ↓                            │
│  Canvas 2D: renderTwapMarker() → dashed green line             │
└─────────────────────────────────────────────────────────────────┘
                                 ↑ WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                         Backend                                 │
├─────────────────────────────────────────────────────────────────┤
│  cTrader/TradingView → M1 Bar Event                             │
│                                    ↓                            │
│  TwapService.onM1Bar() → Accumulate close prices               │
│                                    ↓                            │
│  Emit 'twapUpdate' → { symbol, twapValue, contributions, ... } │
│                                    ↓                            │
│  DataRouter.routeTwapUpdate() → WebSocket broadcast             │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
M1 Bar (close price)
    ↓
TwapService.onM1Bar(symbol, bar)
    ↓
[Accumulate] → state.sum += bar.close; state.count += 1
    ↓
[Calculate] → state.twap = state.sum / state.count
    ↓
Emit 'twapUpdate' → { symbol, twapValue, timestamp, contributions, isHistorical }
    ↓
DataRouter.routeTwapUpdate()
    ↓
WebSocket broadcast → subscribed clients
    ↓
displayDataProcessor.processSymbolData()
    ↓
Update marketData → { twap, twapContributions, twapUpdatedAt }
    ↓
Canvas render → priceMarkerRenderer.renderTwapMarker()
```

**Session Reset:** TWAP state clears when a new daily bar begins (matching Day Range behavior). This happens automatically when historical data is reloaded or when client reconnects and receives fresh `initialMarketProfile`.

### Why This Structure

The TWAP service follows the **EventEmitter service pattern** established by `MarketProfileService.js`:

- **Single source of truth**: Map-based per-symbol state ensures no race conditions
- **Event-driven updates**: Emit on each M1 bar allows real-time frontend synchronization
- **Framework-first**: Uses native EventEmitter without custom abstractions
- **Simple accumulation**: No complex session logic - just sum/close prices

**Why no weekend/session logic:**
- User requested TWAP match other functions' behavior
- Day Range uses daily bar boundaries without special weekend handling
- Simpler code is easier to maintain and less error-prone
- TWAP reset happens naturally when historical data is reloaded (daily bar boundary)

### Invariants

- **All M1 bars included**: Saturday/Sunday bars processed normally
- **Session reset**: TWAP clears when historical data is reloaded (matches Day Range)
- **Mid-session join**: Clients connecting after session start recalculate TWAP from historical M1 bars
- **Close price only**: TWAP uses Σ(Close) / N formula, no high/low/open considered
- **Per-symbol isolation**: Each currency pair maintains independent TWAP state

### Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| **M1-based vs tick-based** | Simpler calculation, less data | 1-minute granularity only |
| **Close price only** | Standard implementation, easy to verify | Ignores intraday price movement |
| **EventEmitter service** | Standard Node.js pattern, no abstractions | Callback-style error handling |
| **No weekend handling** | Simpler code, consistent with Day Range | TWAP includes weekend data |

## Milestones

### Milestone 1: Verify TWAP Implementation

**Files**:
- `src/tests/e2e/twap.spec.js` (run existing tests)
- `src/tests/e2e/twap-verification.spec.js` (run existing tests)
- `services/tick-backend/TwapService.js` (verify code matches requirements)

**Flags**:
- `error-handling`: Verify error paths in weekend/session logic

**Requirements**:

- Run all existing TWAP E2E tests to verify current implementation
- Confirm TWAP marker renders correctly in Day Range visualization
- Verify console logs show TWAP calculation messages
- Validate TWAP value is calculated from M1 close prices
- Confirm weekend exclusion logic works for Saturday/Sunday bars
- Verify session reset logic for Sunday 22:00 UTC rollover
- Test mid-session join with history recalculation

**Acceptance Criteria**:

- All TWAP E2E tests pass (twap.spec.js, twap-verification.spec.js)
- TWAP marker visible as dashed green line in Day Range visualization
- Console logs show TWAP initialization from historical bars on subscription
- TWAP value updates on each M1 bar (excluding weekends)
- Session reset occurs correctly at Sunday 22:00 UTC boundary

**Tests**:

- **Test files**: `src/tests/e2e/twap.spec.js`, `src/tests/e2e/twap-verification.spec.js`
- **Test type**: E2E
- **Backing**: user-specified
- **Scenarios**:
  - Normal: Successful connection, subscription, TWAP calculation, marker display
  - Edge: Mid-session join with history recalculation
  - Edge: Session rollover at Sunday 22:00 UTC
  - Edge: Weekend bar exclusion (Saturday, Sunday)
  - Error: No historical data available
  - Error: Invalid bar data structure

**Code Intent**:

- No code changes in this milestone
- Run existing test suite: `npm test src/tests/e2e/twap*.spec.js`
- Capture console logs to verify TWAP calculation messages
- Take screenshots to verify TWAP marker rendering
- Document any bugs or issues found for next milestone

**Code Changes**:

Documentation milestone - no code changes.

---

### Milestone 2: Fix Bugs and Edge Cases

**Files**:
- `services/tick-backend/TwapService.js` (bug fixes if needed)
- `src/lib/displayDataProcessor.js` (frontend data handling fixes if needed)
- `src/lib/priceMarkerRenderer.js` (rendering fixes if needed)

**Flags**:
- `error-handling`: Focus on error path robustness
- `conformance`: Ensure fixes match existing patterns

**Requirements**:

- Fix any bugs discovered during verification phase
- Add error handling for edge cases found during testing
- Improve logging for debugging session reset issues
- Handle malformed bar data gracefully
- Ensure TWAP updates don't block on weekend bars

**Acceptance Criteria**:

- All bugs from Milestone 1 are fixed
- Weekend exclusion works correctly for all session boundaries
- Session reset logic handles Sunday 22:00 UTC transition
- Invalid bar data is logged and skipped without crashing
- E2E tests pass with all fixes applied

**Tests**:

- **Test files**: `src/tests/e2e/twap.spec.js` (verify fixes)
- **Test type**: E2E
- **Backing**: user-specified
- **Scenarios**:
  - Normal: All original E2E test scenarios still pass
  - Edge: Any new edge case scenarios discovered during Milestone 1
  - Error: Malformed bar data handling
  - Error: Missing fields in bar structure

**Code Intent**:

- **If bugs found in TwapService.js**:
  - Add error handling in `onM1Bar()` for invalid bar data
  - Add logging for debugging data flow
  - Remove weekend check (isWeekend call) - process all bars

- **If bugs found in frontend**:
  - Fix TWAP message processing in `displayDataProcessor.js`
  - Fix TWAP marker rendering in `priceMarkerRenderer.js`
  - Ensure TWAP data flows correctly to canvas rendering

- **Add defensive checks**:
  - Validate bar structure before accessing properties
  - Handle null/undefined TWAP values gracefully

**Code Changes**:

_Filled by Developer agent after bugs are identified in Milestone 1._

---

### Milestone 3: Simplify TWAP Service - Remove Weekend/Session Logic

**Files**:
- `services/tick-backend/TwapService.js` (simplify - remove weekend/session logic)

**Flags**:
- `needs-rationale`: Simplification decisions need justification
- `conformance`: Follow existing service patterns

**Requirements**:

- Remove weekend exclusion logic (`isWeekend()` method and calls)
- Remove session reset logic (`shouldResetDaily()` method and calls)
- Remove session start detection (`findSessionStart()` method)
- Simplify to pure accumulation: sum/close prices, emit updates
- Reduce TwapService.js from 188 lines to ~120 lines or less
- Maintain all existing functionality and tests passing (except weekend-specific)

**Acceptance Criteria**:

- TwapService.js is reduced to approximately 120 lines (from 188)
- All E2E tests still pass after simplification
- TWAP calculation includes all M1 bars (no weekend exclusion)
- Session reset happens via history reload (matches Day Range)
- Code is simpler and easier to maintain

**Tests**:

- **Test files**: `src/tests/e2e/twap.spec.js` (regression verification)
- **Test type**: E2E
- **Backing**: user-specified
- **Scenarios**:
  - Normal: All existing TWAP functionality works
  - Regression: TWAP values calculated from all bars (no skips)
  - Edge: History reload triggers TWAP recalculation
  - Edge: No special weekend handling

**Code Intent**:

- **Modify** `services/tick-backend/TwapService.js`:
  - Remove `isWeekend()` method entirely
  - Remove `shouldResetDaily()` method entirely
  - Remove `findSessionStart()` method entirely
  - Remove weekend check in `onM1Bar()` - process all bars
  - Remove session reset check in `onM1Bar()` - accumulate continuously
  - Remove weekend filter in `initializeFromHistory()` - use all bars
  - Simplify `initializeFromHistory()` to iterate all bars without weekend check
  - Keep core TWAP accumulation logic (sum += close, count += 1)
  - Keep state management (Map, EventEmitter) in service
  - Keep `resetDaily()` for manual reset if needed

- **Key changes**:
  - `onM1Bar()`: Remove isWeekend check, remove shouldResetDaily check
  - `initializeFromHistory()`: Remove isWeekend check, remove findSessionStart call
  - Total removal: ~50-60 lines of weekend/session logic

**Code Changes**:

```diff
--- a/services/tick-backend/TwapService.js
+++ b/services/tick-backend/TwapService.js
@@ -17,22 +17,13 @@ class TwapService extends EventEmitter {
     let sum = 0;
     let count = 0;

-    // Calculate TWAP from historical M1 bars (excluding weekends)
+    // Calculate TWAP from all historical M1 bars
     for (const bar of initialMarketProfile) {
-      if (this.isWeekend(bar.timestamp)) continue;
-
       sum += bar.close;
       count += 1;
     }

-    // Validate we have valid data (not all weekend)
-    if (count === 0) {
-      const error = new Error(`No valid historical data for ${symbol} (all bars filtered as weekend)`);
-      console.error(`[TwapService] ${error.message}`);
-      this.emit('error', { symbol, error: error.message, code: 'NO_VALID_HISTORY' });
-      return;
-    }
-
-    const sessionStart = this.findSessionStart(initialMarketProfile);
+    const sessionStart = initialMarketProfile[0]?.timestamp || Date.now();

     // Store source for this symbol
     this.symbolSources.set(symbol, source);
@@ -65,12 +56,6 @@ class TwapService extends EventEmitter {
   // Process incoming M1 bar
   onM1Bar(symbol, bar, source = 'ctrader') {
-    // Skip weekend bars
-    if (this.isWeekend(bar.timestamp)) {
-      console.log(`[TwapService] Skipping weekend bar for ${symbol}`);
-      return;
-    }
-
     // Validate bar structure
     if (!bar || typeof bar.close !== 'number' || isNaN(bar.close)) {
       console.error(`[TwapService] Invalid bar data for ${symbol}:`, bar);
@@ -78,10 +63,6 @@ class TwapService extends EventEmitter {
       return;
     }

-    // Check for session reset (Sunday 22:00 UTC)
-    if (this.shouldResetDaily(symbol, bar.timestamp)) {
-      console.log(`[TwapService] Resetting TWAP for ${symbol} (new session)`);
-      this.twapState.delete(symbol);
-      this.symbolSources.delete(symbol);
-    }
-
     // Initialize if needed
     if (!this.twapState.has(symbol)) {
       this.symbolSources.set(symbol, source);
@@ -120,36 +101,4 @@ class TwapService extends EventEmitter {
       isHistorical: false
     });
   }

-  // Check if timestamp is on weekend (Saturday or Sunday)
-  isWeekend(timestamp) {
-    const day = new Date(timestamp).getUTCDay();
-    return day === 6 || day === 0; // 6 = Saturday, 0 = Sunday
-  }

-  // Check if we should reset TWAP (crossed Sunday 22:00 UTC)
-  shouldResetDaily(symbol, barTimestamp) {
-    if (!this.twapState.has(symbol)) return false;

-    const state = this.twapState.get(symbol);
-    const lastTime = state.lastUpdate;

-    if (!lastTime) return false;

-    // Validate monotonic timestamp (reject out-of-order bars)
-    if (barTimestamp < lastTime) {
-      console.warn(`[TwapService] Out-of-order bar detected for ${symbol}: ${barTimestamp} < ${lastTime}`);
-      return false;
-    }

-    const current = new Date(barTimestamp);
-    const last = new Date(lastTime);

-    // Reset if we crossed Sunday 22:00 UTC
-    if (current.getUTCDay() === 0 && current.getUTCHours() >= 22) {
-      const lastWasLastWeek = last.getUTCDay() === 6 ||
-                             (last.getUTCDay() === 0 && last.getUTCHours() < 22);
-      if (lastWasLastWeek) return true;
-    }

-    // Reset if we crossed a day boundary at or after 22:00 UTC
-    if (current.getUTCHours() >= 22 && current.getUTCDay() !== last.getUTCDay()) {
-      return true;
-    }

-    return false;
-  }

-  // Find session start from historical data
-  findSessionStart(initialMarketProfile) {
-    if (!initialMarketProfile || initialMarketProfile.length === 0) {
-      return Date.now();
-    }

-    // Find first non-weekend bar
-    for (const bar of initialMarketProfile) {
-      if (!this.isWeekend(bar.timestamp)) {
-        return bar.timestamp;
-      }
-    }

-    return initialMarketProfile[0].timestamp;
-  }
-
   resetDaily(symbol) {
     this.twapState.delete(symbol);
   }
```

**Summary of changes:**
- Removed `isWeekend()` method (lines 124-128)
- Removed `shouldResetDaily()` method (lines 130-161)
- Removed `findSessionStart()` method (lines 163-177)
- Removed weekend check in `initializeFromHistory()` - now processes all bars
- Removed weekend check in `onM1Bar()` - now processes all bars
- Removed session reset check in `onM1Bar()` - accumulates continuously
- Simplified sessionStart to use first bar timestamp
- Removed "all weekend" validation error

**Result:** ~60 lines removed, file reduces from 188 to ~128 lines


---

### Milestone 4: Update Documentation

**Delegated to**: @agent-technical-writer (mode: post-implementation)

**Source**: `## Invisible Knowledge` section of this plan

**Files**:

- `docs/twap-implementation-scope.md` (update status to completed and note scope change)
- `docs/twap-simplified.md` (NEW - document simplified TWAP behavior)

**Requirements**:

- Update TWAP scope document with implementation completion status
- Document simplified TWAP behavior (no weekend handling)
- Note removal of weekend/session logic per user request
- Update Crystal Clarity compliance status

**Acceptance Criteria**:

- `docs/twap-implementation-scope.md` shows "Status: Implemented"
- `docs/twap-simplified.md` documents new behavior
- Crystal Clarity compliance table updated with TwapService.js under 120 lines
- Scope change noted (weekend handling removed per user request)

**Source Material**: `## Invisible Knowledge` section of this plan

---

## Milestone Dependencies

```
M1 (Verify) → M2 (Fix Bugs) → M3 (Refactor) → M4 (Docs)
```

Sequential execution required: verification must complete before fixes, fixes before refactoring, refactoring before documentation.

## Cross-Milestone Integration Tests

Integration tests are in `src/tests/e2e/twap.spec.js` and run at the end of each milestone to verify:

- **M1**: Baseline functionality verification
- **M2**: Bug fixes don't break existing behavior
- **M3**: Refactoring produces identical TWAP calculations
- **M4**: Documentation matches implementation

Each milestone must pass E2E tests before proceeding to next milestone.
