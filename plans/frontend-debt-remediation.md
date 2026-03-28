# Frontend Debt Remediation Plan

> Plan ID: `frontend-debt-remediation-57-findings`
> Source: `docs/analysis/frontend-debt-assessment.md` (57 verified findings)
> Status: EXECUTED — all 6 milestones deployed, quality review passed with fixes applied

## Overview

Fix 57 frontend debt findings across 6 phased milestones. Each milestone is independently deployable.

**Finding breakdown**: 2 bugs, 8 legacy artifacts, 17 dead code, 15 design debt, 12 performance inefficiencies, 5 cross-cutting.

## Deployment Waves

| Wave | Milestones | Parallel? |
|------|-----------|-----------|
| 1 | M-001 (bugs) | No |
| 2 | M-002 (debug logs) | No |
| 3 | M-003 (dead code) | No |
| 4 | M-004 (connection), M-005 (market profile) | Yes |
| 5 | M-006 (polish) | No |

## Constraints

- C-001: Each fix isolated and testable
- C-002: Preserve active API surfaces (only remove dead exports)
- C-003: No backend API changes
- C-004: No new dependencies
- C-005: No CSS/styling overhaul

## Excluded Findings (3)

| Finding | Reason |
|---------|--------|
| F25 (119-line god function mini profile) | Architectural refactor exceeds debt remediation scope |
| F26 (4 color palettes) | Requires UX/design decision beyond technical fix |
| F50 partial (#0a0a0a scattering) | Partial coverage via constants; full consolidation needs theming system |

## Milestones

### M-001: Fix Functional Bugs (Wave 1)

**3 code intents, 3 code changes**

| ID | Finding | File | Change |
|----|---------|------|--------|
| CI-M-001-001 | #1 (reconnection double-count) | `connectionManager.js` | Add `reconnectScheduled` flag; check in onError/onClose before incrementing attempts |
| CI-M-001-002 | S2 (basket timeout leak) | `marketDataStore.js` | Call `clearTimeout(sm.timeoutId)` before deleting state machine from Map |
| CI-M-001-003 | #5 (FAILED initial state) | `marketDataStore.js` | Add `IDLE` state to `BasketState` enum; update initial state |

### M-002: Gate Debug Logs Behind DEV (Wave 2)

**6 code intents, 6 code changes**

| ID | Finding | File | Change |
|----|---------|------|--------|
| CI-M-002-001 | #2 | `connectionHandler.js` | Wrap 14 `[DEBUGGER:]` logs in `import.meta.env.DEV` guards |
| CI-M-002-002 | #2 | `Workspace.svelte` | Wrap 10 `[DEBUGGER:]` logs in DEV guards |
| CI-M-002-003 | #2 | `App.svelte` | Wrap 3 import-step logs in DEV guards |
| CI-M-002-004 | #2 | `main.js` | Wrap 2 bootstrap logs in DEV guards |
| CI-M-002-005 | #2 | `dayRangeOrchestrator.js` | Wrap 6 render-frame logs in DEV guards |
| CI-M-002-006 | Additional | `canvasStatusRenderer.js` | Wrap 2 status-render logs in DEV guards |

### M-003: Remove Dead Code (Wave 3)

**13 code intents, 13 code changes**

| ID | Finding | Change |
|----|---------|--------|
| CI-M-003-001 | #3 | Remove 5 unused derived store factories from `marketDataStore.js` |
| CI-M-003-002 | #13 | Remove unused `BASKET_DEFINITIONS` and `getPairPrice` imports |
| CI-M-003-003 | #35 | Delete entire `visualizationRegistry.js` file |
| CI-M-003-004 | #36 | Delete entire `dayRange.js` file |
| CI-M-003-005 | S5 | Delete entire `interactionSetup.js` file |
| CI-M-003-006 | #38 | Remove dead re-exports from `visualizers.js` |
| CI-M-003-007 | #14 | Remove unused latency pipeline (circular buffer + percentile) |
| CI-M-003-008 | #27, #28 | Remove unused `calculateIntensity`, `getIntensityLevel` exports from `calculations.js` |
| CI-M-003-009 | #30 | Remove unused `drawBackground` export from `rendering.js` |
| CI-M-003-010 | #31 | Remove unused `renderMarketProfileError` export from `orchestrator.js` |
| CI-M-003-011 | #32 | Remove commented-out POC rendering block from `orchestrator.js` |
| CI-M-003-012 | #33 | Remove unused `priceToY` and `yToPrice` exports from `scaling.js` |
| CI-M-003-013 | #10 | Remove dead `subscribeCoordinated()` and `resubscribeSymbol()` from `connectionManager.js` |

### M-004: Harden Connection Layer (Wave 4)

**6 code intents, 12 code changes**

| ID | Finding | File | Change |
|----|---------|------|--------|
| CI-M-004-001 | #7 | `connectionManager.js` | Add `sendRaw()` method with null-check for disconnected state |
| CI-M-004-002 | #6 | `Workspace.svelte` | Add `addSystemSubscription()` to facade; replace direct SubscriptionManager access |
| CI-M-004-003 | S1, S4 | `connectionHandler.js` | Add `stopHeartbeatCheck()` + `ws = null` to onError handler |
| CI-M-004-004 | #8 | `connectionManager.js` | Add cleanup for `statusCallbacks` on disconnect |
| CI-M-004-005 | #9 | `subscriptionManager.js` | Fix `pendingSubscriptions` flush to preserve re-queued items |
| CI-M-004-006 | S3 | `marketDataStore.js` | Gate `window.marketDataStore` debug bridge with `import.meta.env.DEV` |

### M-005: Clean Up Market Profile & Visualization (Wave 4, parallel with M-004)

**19 code intents, 21 code changes**

| ID | Finding | Change |
|----|---------|--------|
| CI-M-005-001 | #39 | Remove redundant `clearRect` before opaque `fillRect` in `visualizers.js` |
| CI-M-005-002 | #43 | Remove unused `finalTpo` from `expandArea` return in `calculations.js` |
| CI-M-005-003 | S7 | Replace `Math.min/max` spread with `reduce` (8 instances across market profile) |
| CI-M-005-004 | #17 | Add retry limit (100) to RAF loop in `FxBasketDisplay.svelte` |
| CI-M-005-005 | #20 | Extract handlers from reactive IIFE in `FloatingDisplay.svelte` |
| CI-M-005-006 | #24 | Debounce localStorage writes in `PriceMarkerManager.svelte` |
| CI-M-005-007 | #19 | Fix duplicate `resizeObserver.disconnect()` in `PriceTicker.svelte` |
| CI-M-005-008 | #22 | Gate `window.fxBasketDebug` with DEV in `FxBasketDisplay.svelte` |
| CI-M-005-009 | #18 | Use `createInteractConfig` from `interactSetup.js` in `FxBasketDisplay.svelte` |
| CI-M-005-010 | #21 | Read DPR fresh on resize in `FxBasketDisplay.svelte` |
| CI-M-005-011 | #23 | Remove dead `flashPriceEnabled` prop and CSS from `PriceTicker.svelte` |
| CI-M-005-012 | #29 | Remove unused `intensity` parameter from `getIntensityColor` in `calculations.js`; update caller in `rendering.js` |
| CI-M-005-013 | #34 | Inline `createPriceScale` to `createDayRangePriceScale` in `scaling.js` |
| CI-M-005-014 | #37 | Extract `resolveAxisX` shared utility for 4+ copy-paste instances |
| CI-M-005-015 | #41 | Replace `getState()` temp subscription with Svelte `get()` |
| CI-M-005-016 | #47 | Extract `#FFD700` to `DELTA_MARKER_COLOR` constant in `displayCanvasRenderer.js` |
| CI-M-005-017 | #8 (partial) | Add FxBasketDisplay statusCallback unsubscribe cleanup |
| CI-M-005-018 | #15 | Replace hard-coded `'fx-basket-main'` key with unique subscription keys |
| CI-M-005-019 | #4 | Selective basket recomputation (only recalculate affected currency) |

### M-006: Low-Priority Polish (Wave 5)

**8 code intents, 0 code changes (deferred to execution)**

| ID | Finding | Change |
|----|---------|--------|
| CI-M-006-001 | #16 | Add deprecation logging to legacy field fallbacks in `normalizeData` (KEEP fallbacks) |
| CI-M-006-002 | #42 | Remove unused `schemaVersion` field |
| CI-M-006-003 | S6 | Remove dead return fields from `calculateDimensions` (keep only width + startX) |
| CI-M-006-004 | #44 | Extract magic numbers to named constants in `scaling.js` |
| CI-M-006-005 | #50 partial | Extract `0.75` axis ratio to named constant |
| CI-M-006-006 | #48 | Use `SYSTEM_FONT_FAMILY` constant in `displayCanvasRenderer.js` |
| CI-M-006-007 | #49 | Consolidate `SYSTEM_FONT_FAMILY` to single definition |
| CI-M-006-008 | #45 | Remove backward-compatibility comment referencing deleted modules |

## Risks

| ID | Description | Mitigation |
|----|-------------|------------|
| R-001 | Dead exports consumed by uncommitted code | 5-agent verification confirmed zero consumers |
| R-002 | Reconnection flag interaction with visibility change | Separate code paths; flag only guards onError/onClose pair |
| R-003 | BasketState.IDLE breaks code checking `state === FAILED` as initial condition | Grep all BasketState consumers before change |
| R-004 | cTrader backend still sends legacy field names | Keep fallbacks with deprecation logging (CI-M-006-001) |

## Executor Notes (from QR code review)

The following issues were identified during plan-code QR but not all could be verified due to rate limits. The executor should be aware:

1. **M-004 duplicate code_changes**: Some M-004 code_change IDs may appear twice with different diff content. Executor should verify diffs against actual source before applying.
2. **Post-M-002 line drift**: M-004 diffs for `connectionHandler.js` and `Workspace.svelte` reference pre-M-002 state (before debug logs removed). Context lines may not match after M-002 runs. Adjust accordingly.
3. **Empty import**: CC-CI-M-003-007 may produce `import { } from '...'`. Remove the entire import line instead.
4. **M-006 has no code_changes**: Executor will need to generate diffs from the code_intent descriptions.
5. **rendering.js caller update**: When removing `intensity` param from `getIntensityColor`, also update the caller at `rendering.js:28` to stop passing the extra argument.
6. **onStale path**: `reconnectScheduled` flag covers onError/onClose but not onStale. Timer-based stale detection is unlikely to fire simultaneously with error events.
7. **Workspace reinit log**: CC-CI-M-004-002 may remove an operational (non-debug) log. Keep or DEV-gate it.

## Files Modified (26 unique)

`connectionManager.js`, `connectionHandler.js`, `reconnectionHandler.js`, `subscriptionManager.js`, `marketDataStore.js`, `Workspace.svelte`, `App.svelte`, `main.js`, `dayRangeOrchestrator.js`, `FxBasketDisplay.svelte`, `FloatingDisplay.svelte`, `PriceTicker.svelte`, `PriceMarkerManager.svelte`, `orchestrator.js` (marketProfile), `calculations.js`, `rendering.js`, `scaling.js`, `visualizers.js`, `displayCanvasRenderer.js`, `canvasStatusRenderer.js`, `dataContracts.js`

**Files deleted**: `visualizationRegistry.js`, `dayRange.js`, `interactionSetup.js`
