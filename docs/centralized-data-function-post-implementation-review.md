# Centralized Data Function: Post-Implementation Review

**Date:** 2026-03-28
**Scope:** Assessment of the centralized data store implementation across all 6 phases
**Status:** All phases delivered; 6 issues identified for remediation

---

## Implementation Summary

All 6 phases of the centralized data function plan were completed:

| Phase | Component | Net Effect |
|-------|-----------|------------|
| 1 | `marketDataStore.js` (new) | +520 lines, single source of truth per symbol |
| 2 | Backend latency instrumentation | +25 lines across DataRouter, MessageBuilder, HealthMonitor |
| 3 | PriceTicker migration | Reactive store binding replaces manual subscription |
| 4 | FloatingDisplay migration | Removed 3 composable imports |
| 5 | FxBasketDisplay migration | 313→171 lines (46% reduction) |
| 6 | dataContracts.js update | Latency + schema type definitions |

## What's Working

- **Single source of truth**: Each symbol has one writable store, shared across components
- **Reference counting**: `subscribeToSymbol()` deduplicates WebSocket subscriptions
- **3-point latency tracking**: `receivedAt` → `sentAt` → `clientReceivedAt` gives backend/network/e2e breakdown
- **Schema versioning**: `v: '1.0.0'` on all messages enables future version negotiation
- **Dev-mode validation**: Catches malformed messages without production overhead
- **Symbol change handling**: Proper unsubscribe/resubscribe with stale data clearing

## Issues Found

### #1: `getConnectionStatus()` never re-computes [Functional]

**File:** `src/stores/marketDataStore.js:348-357`
**Severity:** Functional bug — connection status indicator shows stale state

`getConnectionStatus()` uses `derived([], ...)` with an empty dependency array. This means it fires once on creation and never re-computes. When `ConnectionManager.status` changes (e.g., disconnect → reconnect), the derived store doesn't update.

### #2: `recordLatency()` / `getLatencyStats()` are orphaned [Functional]

**File:** `src/stores/marketDataStore.js:359-392`
**Severity:** Functional bug — latency statistics always return null

`handleStoreUpdate()` calculates latency per-tick and stores it in the store's state, but never calls `recordLatency()` to populate the `latencySamples` map. `getLatencyStats()` always returns `{ p50: null, p95: null, p99: null, avg: null }`.

### #3: Heartbeat timing mismatch [Functional, Pre-existing]

**Files:** `services/tick-backend/WebSocketServer.js:66`, `src/lib/connection/connectionHandler.js`
**Severity:** Causes unnecessary reconnection cycles during idle periods

Backend sends heartbeats every 5s, but frontend `connectionHandler` has a 2s stale timeout. During idle periods (no tick data), the frontend falsely declares connections stale every 5 seconds and triggers reconnection cycles.

### #4: Unused `tick` import [Cleanup]

**File:** `src/components/FxBasketDisplay.svelte:2`
**Severity:** Trivial — unused import

`tick` is imported from Svelte but never used in the component.

### #5: Dead composables [Cleanup]

**Files:** `src/composables/useWebSocketSub.js`, `src/composables/useDisplayState.js`, `src/composables/useDataCallback.js`
**Severity:** Dead code — no component imports these anymore

After the migration, all three components use `marketDataStore.js` directly. These composables are dead weight.

### #6: Dead `processSymbolData` path in displayDataProcessor.js [Cleanup]

**File:** `src/lib/displayDataProcessor.js`
**Severity:** Dead code — duplicated normalization logic

`processSymbolData()` duplicates logic now in `marketDataStore.normalizeData()`. Only `getWebSocketUrl` and `formatSymbol` are still imported from this file. These utilities should be extracted and the dead code removed.

## Architectural Notes (Deferred)

These are not bugs but improvements for future consideration:

- **marketDataStore.js at 520 lines**: The plan's threshold for splitting was 300. Mixed concerns (WebSocket management, FX basket state machine, store CRUD, latency tracking) should eventually be split into `marketData/` subdirectory.
- **FX basket callback pattern**: `subscribeBasket()` uses imperative callbacks rather than Svelte's reactive `derived()` stores. Works but not idiomatic Svelte.
- **Redundant `connect()` calls**: All three components call `connectionManager.connect()` on mount; only the first matters since it's a singleton.

## Issue Discovered During Quality Check

### Market Profile Data Not Wired to Components [Pre-existing]

**Files:** `src/components/PriceTicker.svelte`, `src/components/FloatingDisplay.svelte`
**Severity:** Feature gap — market profile visualization may not update

`lastMarketProfileData` in both components is only ever set to `null` (on symbol change, refresh, cleanup). The store's `marketProfile` field is populated from `initialMarketProfile` in symbolDataPackage, but the components never read it from the store. Additionally, `profileUpdate` messages from the backend are not handled by `subscribeToSymbol()`'s callback (which only handles `symbolDataPackage`, `tick`, and `error`).

This was a gap in the original migration. The fix would require:
1. Reading `lastData.marketProfile` from the store in a reactive statement, or
2. Adding `profileUpdate` handling to the subscription callback in `marketDataStore.js`

## Resolution Tracking

| # | Issue | Resolution |
|---|-------|-----------|
| 1 | getConnectionStatus never re-computes | Fixed — writable store with status callback |
| 2 | recordLatency orphaned | Fixed — called from handleStoreUpdate |
| 3 | Heartbeat timing mismatch | Fixed — frontend timeout 2s → 10s |
| 4 | Unused tick import | Fixed — removed from FxBasketDisplay |
| 5 | Dead composables | Fixed — deleted 5 files, updated docs |
| 6 | Dead processSymbolData | Fixed — slimmed displayDataProcessor to utilities only |

## Files Changed

| File | Change |
|------|--------|
| `src/stores/marketDataStore.js` | Fixed getConnectionStatus (writable + callback), wired recordLatency |
| `src/lib/connection/connectionHandler.js` | heartbeatTimeoutMs 2000 → 10000 |
| `src/services/tick-backend/WebSocketServer.js` | Updated heartbeat comment |
| `src/components/FxBasketDisplay.svelte` | Removed unused `tick` import |
| `src/lib/displayDataProcessor.js` | Removed dead code, kept getWebSocketUrl + formatSymbol |
| `src/composables/useWebSocketSub.js` | Deleted |
| `src/composables/useDisplayState.js` | Deleted |
| `src/composables/useDataCallback.js` | Deleted |
| `src/composables/useSymbolData.js` | Deleted |
| `src/composables/useDisplayHandlers.js` | Deleted |
| `src/composables/CLAUDE.md` | Updated to reflect deprecation |
| `src/composables/README.md` | Updated to reflect deprecation |
